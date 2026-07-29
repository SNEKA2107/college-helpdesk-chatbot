/**
 * Central translation of thrown errors into clean HTTP responses.
 *
 * Audit finding M-2 / L-2: several routes did `res.status(500).json({ message: err.message })`,
 * which returned 500 for what were really client mistakes AND leaked raw Mongoose
 * text (e.g. "User validation failed: department: `ROBOTICS` is not a valid enum
 * value for path `department`") to the browser.
 *
 * Usage:  } catch (err) { return fail(res, err, 'Could not save the notice.'); }
 */

/** Human-readable message for a Mongoose ValidationError, without internals. */
function validationMessage(err) {
  const fields = Object.values(err.errors || {});
  if (!fields.length) return 'Some of the submitted values are invalid.';
  // Prefer the schema's own message when the developer wrote one, else a generic
  // per-field sentence. Never echo Mongoose's raw "...is not a valid enum value..." text.
  const parts = fields.map(f => {
    if (f.kind === 'required') return `${f.path} is required`;
    if (f.kind === 'enum' || f.kind === 'user defined') return f.message && !/enum value/i.test(f.message)
      ? f.message
      : `${f.path} has an unsupported value`;
    if (f.kind === 'min' || f.kind === 'max') return f.message;
    return `${f.path} is invalid`;
  });
  return parts.join('; ') + '.';
}

/**
 * Send the right status for `err`. Returns the response so callers can `return fail(...)`.
 * @param res       express response
 * @param err       the caught error
 * @param fallback  user-facing message for genuine server faults (never the raw error)
 */
function fail(res, err, fallback = 'Something went wrong. Please try again.') {
  if (err && err.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: validationMessage(err) });
  }
  if (err && err.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'That record id is not valid.' });
  }
  if (err && err.code === 11000) {
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0];
    return res.status(409).json({
      success: false,
      message: field ? `That ${field} is already in use.` : 'That record already exists.',
    });
  }
  // Genuine server fault — log the detail, return only the safe message.
  console.error('[api]', err && err.stack ? err.stack : err);
  return res.status(500).json({ success: false, message: fallback });
}

/** Explicit 400 helper for hand-rolled payload checks. */
function badRequest(res, message) {
  return res.status(400).json({ success: false, message });
}

/** Explicit 404 helper — audit finding L-1 (deletes silently "succeeded" on missing ids). */
function notFound(res, what = 'Record') {
  return res.status(404).json({ success: false, message: `${what} not found.` });
}

module.exports = { fail, badRequest, notFound, validationMessage };
