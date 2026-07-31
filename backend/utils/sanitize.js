/**
 * Shared input-hardening helpers.
 *
 * These existed in three or four route files each, in slightly different forms,
 * and the routes that most needed them were the ones that had missed out. They
 * live here now so every route applies the identical rule.
 */

/**
 * Coerce a query-string value to a string, or undefined when absent.
 *
 * Express parses the query string with `qs` in extended mode, so `?status[$ne]=x`
 * arrives as the OBJECT `{ $ne: 'x' }`. Assigning that straight into a Mongo
 * filter hands the caller an operator and widens the query past whatever the
 * route intended. Everything that reaches a filter goes through here first.
 *
 * Arrays are rejected rather than joined: a repeated parameter is a malformed
 * request, and silently taking the first element hides that from the caller.
 */
function coerceQuery(value) {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value) || typeof value === 'object') return undefined;
  const s = String(value).trim();
  return s === '' ? undefined : s;
}

/**
 * True when a query value was supplied but is not a usable scalar — lets a route
 * answer 400 instead of silently ignoring an operator-injection attempt.
 */
function isBadQueryValue(value) {
  return value !== undefined && value !== null && coerceQuery(value) === undefined;
}

/** Escape regex metacharacters so user input cannot alter the pattern's meaning. */
function escapeRegex(s) {
  return String(s == null ? '' : s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a case-insensitive "contains" RegExp from untrusted input.
 *
 * Escaping alone is not enough: an unescaped pattern like (a+)+$ costs minutes
 * of CPU per document, and Mongo evaluates it server-side across the collection.
 * Escaping removes the operators, and the length cap bounds the work even for a
 * pathological literal.
 */
const MAX_SEARCH = 64;
function searchRegex(input) {
  const term = String(input == null ? '' : input).trim().slice(0, MAX_SEARCH);
  if (!term) return null;
  return new RegExp(escapeRegex(term), 'i');
}

/** Strip HTML tags from a string; non-strings pass through untouched. */
function stripHtml(s) {
  return typeof s === 'string' ? s.replace(/<[^>]*>/g, '') : s;
}

/**
 * Escape a value for interpolation into an HTML document (outbound email).
 * stripHtml() removes markup on the way IN; this neutralises it on the way OUT,
 * which is what the notification templates need.
 */
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Copy only `fields` from `src`. The defence against mass assignment: a body
 * key that is not named here can never reach the database, so a caller cannot
 * set createdBy, accessCount, isHOD or a __proto__-prefixed dotted path.
 */
function pick(src, fields) {
  const out = {};
  if (!src || typeof src !== 'object') return out;
  for (const f of fields) {
    if (Object.prototype.hasOwnProperty.call(src, f) && src[f] !== undefined) out[f] = src[f];
  }
  return out;
}

/** Reject the keys Mongo/JS treat specially, wherever a body becomes an update. */
const FORBIDDEN_KEYS = ['__proto__', 'constructor', 'prototype'];
function hasUnsafeKeys(obj) {
  if (!obj || typeof obj !== 'object') return false;
  return Object.keys(obj).some(k => FORBIDDEN_KEYS.includes(k) || k.startsWith('$') || k.includes('.'));
}

module.exports = {
  coerceQuery, isBadQueryValue, escapeRegex, searchRegex, MAX_SEARCH,
  stripHtml, escapeHtml, pick, hasUnsafeKeys,
};
