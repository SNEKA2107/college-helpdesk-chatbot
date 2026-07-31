/**
 * Base64 data-URL upload validation, shared by every route that accepts a file.
 *
 * This is the validator that already lived in routes/leave.js, generalised. It
 * was the only upload path in the codebase that checked anything; assignments,
 * study materials, notice attachments, knowledge documents and profile photos
 * all accepted whatever MIME the client declared, so a text/html or SVG payload
 * could be stored and handed back from the download endpoints.
 *
 * Checks, in order:
 *   1. the value is a well-formed data URL
 *   2. the MIME inside the data URL is on the route's allowlist
 *   3. the client's separate `type` field agrees with it
 *   4. the base64 body is really base64
 *   5. the DECODED size is within the cap (base64 inflates by ~33%)
 *   6. the leading bytes match the declared type (a renamed .exe fails here)
 *   7. the filename is sanitised and its extension is allowed
 */

const MB = 1024 * 1024;

// Per-purpose allowlists. Documents are deliberately narrow; images exclude SVG
// because an SVG is an executable document in a browser, not an inert picture.
const DOCUMENT_TYPES = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
};

const IMAGE_TYPES = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
};

const ATTACHMENT_TYPES = {
  ...DOCUMENT_TYPES,
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.ms-powerpoint': ['ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
  'application/vnd.ms-excel': ['xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'text/plain': ['txt'],
  'application/zip': ['zip'],
};

// Magic bytes, checked against the decoded prefix. Office/zip formats are all
// PK.. containers, which is why they share a signature.
const SIGNATURES = {
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],                     // %PDF
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],                          // RIFF
  'application/zip': [[0x50, 0x4B, 0x03, 0x04], [0x50, 0x4B, 0x05, 0x06]],
  'application/msword': [[0xD0, 0xCF, 0x11, 0xE0]],
  'application/vnd.ms-powerpoint': [[0xD0, 0xCF, 0x11, 0xE0]],
  'application/vnd.ms-excel': [[0xD0, 0xCF, 0x11, 0xE0]],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [[0x50, 0x4B, 0x03, 0x04]],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': [[0x50, 0x4B, 0x03, 0x04]],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [[0x50, 0x4B, 0x03, 0x04]],
  // text/plain has no signature; it is validated by the decode step alone.
};

const DATA_URL = /^data:([a-zA-Z0-9.+/-]+);base64,([A-Za-z0-9+/=]+)$/;

function matchesSignature(buf, mime) {
  const sigs = SIGNATURES[mime];
  if (!sigs) return true;                    // no signature defined (text/plain)
  return sigs.some(sig => sig.every((b, i) => buf[i] === b));
}

/**
 * @param {string} dataUrl              the `data:<mime>;base64,<payload>` string
 * @param {string} name                 client-supplied filename
 * @param {string} declaredType         client-supplied MIME (must agree)
 * @param {object} opts
 * @param {object} opts.allowed         MIME -> [extensions] map
 * @param {number} opts.maxBytes        decoded size cap
 * @param {string} opts.label           noun used in error messages
 * @returns {{ok:true, fields:{data,name,type,size}}|{ok:false, error:string}}
 */
function validateUpload(dataUrl, name, declaredType, opts = {}) {
  const allowed = opts.allowed || DOCUMENT_TYPES;
  const maxBytes = opts.maxBytes || 5 * MB;
  const label = opts.label || 'File';
  const kinds = [...new Set(Object.values(allowed).flat())].join(', ').toUpperCase();

  if (typeof dataUrl !== 'string' || !dataUrl) {
    return { ok: false, error: `${label} must be a base64 data URL.` };
  }
  const m = DATA_URL.exec(dataUrl);
  if (!m) return { ok: false, error: `${label} must be a valid base64 data URL.` };

  const mime = m[1].toLowerCase();
  const b64 = m[2];

  if (!Object.prototype.hasOwnProperty.call(allowed, mime)) {
    return { ok: false, error: `${label} type not allowed. Use one of: ${kinds}.` };
  }
  if (declaredType && String(declaredType).toLowerCase() !== mime) {
    return { ok: false, error: `${label} type mismatch.` };
  }

  // Decoded-size guard BEFORE decoding, so an oversized payload is never buffered.
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  const byteLen = Math.floor(b64.length * 3 / 4) - padding;
  if (byteLen > maxBytes) {
    return { ok: false, error: `${label} is too large. Maximum size is ${Math.round(maxBytes / MB)} MB.` };
  }

  let head;
  try {
    head = Buffer.from(b64.slice(0, 64), 'base64');
  } catch {
    return { ok: false, error: `${label} contains invalid data.` };
  }
  if (!matchesSignature(head, mime)) {
    return { ok: false, error: `${label} contents do not match its declared type.` };
  }

  // Sanitise the filename: strip anything outside a safe set (which also removes
  // path separators and traversal sequences) and cap the length.
  const safeName = String(name || 'file')
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/\.{2,}/g, '.')
    .slice(0, 120);
  const ext = safeName.includes('.') ? safeName.split('.').pop().toLowerCase() : '';
  if (ext && !allowed[mime].includes(ext)) {
    return { ok: false, error: `${label} extension does not match its contents. Use: ${allowed[mime].join(', ')}.` };
  }

  return { ok: true, fields: { data: dataUrl, name: safeName, type: mime, size: byteLen } };
}

module.exports = { validateUpload, DOCUMENT_TYPES, IMAGE_TYPES, ATTACHMENT_TYPES, MB };
