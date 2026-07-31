const nodemailer = require('nodemailer');
const { escapeHtml } = require('./sanitize');

/**
 * Tagged template that HTML-escapes every interpolated value.
 *
 * The notification templates concatenated request types, student names and
 * admin-written remarks straight into the message body, so a crafted value
 * injected arbitrary markup and links into mail sent from the college's own
 * address — a high-credibility phishing primitive. Usage:
 *
 *   html`<p>Dear <strong>${name}</strong></p>`
 *
 * Static markup in the template stays literal; only the ${...} values escape.
 */
function html(strings, ...values) {
  return strings.reduce((out, s, i) => out + s + (i < values.length ? escapeHtml(values[i]) : ''), '');
}

/** Opt out of escaping for a value that is genuinely trusted markup. */
const raw = (s) => ({ __raw: String(s == null ? '' : s) });

// html() escapes objects to "[object Object]", so raw() values are unwrapped here.
function htmlSafe(strings, ...values) {
  return strings.reduce((out, s, i) => {
    if (i >= values.length) return out + s;
    const v = values[i];
    return out + s + (v && v.__raw !== undefined ? v.__raw : escapeHtml(v));
  }, '');
}

function createTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return null;
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
}

async function sendEmail({ to, subject, html }) {
  const transporter = createTransporter();
  if (!transporter) return; // email not configured, skip silently
  try {
    await transporter.sendMail({
      from: `"Campus HelpDesk" <${process.env.EMAIL_USER}>`,
      to, subject, html,
    });
    console.log(`📧 Email sent to ${to}`);
  } catch (err) {
    console.error('Email error:', err.message);
  }
}

// `title` is escaped; `body` is already-assembled markup from a caller using the
// html`` tag above, so it is inserted as-is.
function emailTemplate(title, body) {
  title = escapeHtml(title);
  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#0f172a;color:#e2e8f0;border-radius:10px;overflow:hidden;">
    <div style="background:#4f46e5;padding:22px 28px;">
      <h2 style="margin:0;color:#fff;font-size:18px;">🎓 Campus HelpDesk</h2>
      <p style="margin:4px 0 0;color:#c7d2fe;font-size:13px;">Smart College Helpdesk</p>
    </div>
    <div style="padding:28px;">
      <h3 style="color:#a5b4fc;margin-top:0;">${title}</h3>
      ${body}
      <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0;">
      <p style="color:#64748b;font-size:12px;margin:0;">This is an automated message from Campus HelpDesk. Do not reply to this email.</p>
    </div>
  </div>`;
}

module.exports = { sendEmail, emailTemplate, html: htmlSafe, raw, escapeHtml };
