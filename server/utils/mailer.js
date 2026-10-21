const nodemailer = require('nodemailer');
const config = require('../config/env');
const logger = require('./logger');

let transporter;
if (config.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: config.SMTP_HOST, port: config.SMTP_PORT, secure: config.SMTP_PORT === 465,
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
  });
}

async function sendMail({ to, subject, text, html }) {
  if (!transporter) {
    // No SMTP configured: surface the message in dev logs only.
    if (!config.isProd) console.log(`\n[mail:dev] to=${to} subject="${subject}"\n${text}\n`);
    else logger.warn({ to, subject }, 'SMTP not configured; email not sent');
    return;
  }
  try { await transporter.sendMail({ from: config.MAIL_FROM, to, subject, text, html }); }
  catch (err) { logger.error({ err, to }, 'Failed to send email'); }
}
module.exports = { sendMail };
