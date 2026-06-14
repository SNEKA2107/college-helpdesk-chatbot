// Shared helpers for the Leave/OD supporting-document workflow (base64 in Mongo).
// Mirrors the server-side limits in backend/routes/leave.js.

export const MAX_DOC_BYTES = 3 * 1024 * 1024; // 3 MB
export const ALLOWED_DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const ALLOWED_EXT = ['pdf', 'jpg', 'jpeg', 'png'];

// Validate a File before reading it. Returns { ok, error? }.
export function validateUploadFile(file) {
  if (!file) return { ok: true };
  if (!ALLOWED_DOC_TYPES.includes(file.type)) {
    return { ok: false, error: 'Only PDF, JPG, or PNG files are allowed.' };
  }
  const ext = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : '';
  if (ext && !ALLOWED_EXT.includes(ext)) {
    return { ok: false, error: 'File extension not allowed. Use PDF, JPG, or PNG.' };
  }
  if (file.size > MAX_DOC_BYTES) {
    return { ok: false, error: 'File is too large. Maximum size is 3 MB.' };
  }
  return { ok: true };
}

// Read a File into a base64 data URL.
export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.readAsDataURL(file);
  });
}

// Convert a base64 data URL into an object URL (so the browser can preview/download
// without needing the auth header on the link itself).
export function dataUrlToObjectUrl(dataUrl) {
  const [head, b64] = dataUrl.split(',');
  const mime = (/data:([^;]+);/.exec(head) || [])[1] || 'application/octet-stream';
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return URL.createObjectURL(new Blob([arr], { type: mime }));
}

// Open a data URL in a new tab for preview.
export function previewDataUrl(dataUrl) {
  const url = dataUrlToObjectUrl(dataUrl);
  window.open(url, '_blank', 'noopener');
  // Revoke later — the new tab needs the URL alive briefly after opening.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// Trigger a download of a data URL with the given filename.
export function downloadDataUrl(dataUrl, filename) {
  const url = dataUrlToObjectUrl(dataUrl);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'document';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
