const nodemailer = require('nodemailer');

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
      from: `"CampusAssist" <${process.env.EMAIL_USER}>`,
      to, subject, html,
    });
    console.log(`📧 Email sent to ${to}`);
  } catch (err) {
    console.error('Email error:', err.message);
  }
}

function emailTemplate(title, body) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#0f172a;color:#e2e8f0;border-radius:10px;overflow:hidden;">
    <div style="background:#4f46e5;padding:22px 28px;">
      <h2 style="margin:0;color:#fff;font-size:18px;">🎓 CampusAssist</h2>
      <p style="margin:4px 0 0;color:#c7d2fe;font-size:13px;">Smart College Helpdesk</p>
    </div>
    <div style="padding:28px;">
      <h3 style="color:#a5b4fc;margin-top:0;">${title}</h3>
      ${body}
      <hr style="border:none;border-top:1px solid #1e293b;margin:24px 0;">
      <p style="color:#64748b;font-size:12px;margin:0;">This is an automated message from CampusAssist. Do not reply to this email.</p>
    </div>
  </div>`;
}

module.exports = { sendEmail, emailTemplate };
