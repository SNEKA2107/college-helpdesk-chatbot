/**
 * Redaction for free-text values surfaced in analytics aggregates.
 *
 * The "top questions" and "knowledge gaps" panels group Copilot queries by their
 * literal text and show the result to an administrator. That text is written by
 * students, in their own words, and routinely contains things the analytics view
 * has no business displaying — a register number while asking about results, a
 * phone number, a parent's email.
 *
 * Aggregation is a legitimate use of the data; reproducing identifiers inside it
 * is not. These patterns are masked before the value leaves the API, so the
 * grouping still works while the identifier does not travel with it.
 */

const PATTERNS = [
  // Email addresses.
  [/[\w.+-]+@[\w-]+\.[\w.-]+/gi, '[email]'],
  // Indian mobile numbers, with or without a country code.
  [/(?:\+?91[\s-]?)?[6-9]\d{9}\b/g, '[phone]'],
  // Student register numbers: the seeded format is a 9-digit number, and staff
  // IDs look like FAC0001 / ADM001.
  [/\b\d{9,12}\b/g, '[id]'],
  [/\b(?:FAC|ADM)\d{2,6}\b/gi, '[staff-id]'],
  // Long digit runs that could be an account or card number.
  [/\b\d{13,19}\b/g, '[number]'],
];

const MAX_LABEL = 120;

/** Mask identifiers in a free-text analytics label. */
function redactText(value) {
  if (typeof value !== 'string' || !value) return value;
  let out = value;
  for (const [re, replacement] of PATTERNS) out = out.replace(re, replacement);
  return out.length > MAX_LABEL ? out.slice(0, MAX_LABEL) + '…' : out;
}

/** Apply redactText to the `label` of each {label,value} row. */
function redactLabels(rows) {
  return (rows || []).map(r => ({ ...r, label: redactText(r.label) }));
}

module.exports = { redactText, redactLabels };
