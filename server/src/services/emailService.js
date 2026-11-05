import nodemailer from 'nodemailer';

const escapeHtml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

export const isEmailConfigured = (env = process.env) =>
  Boolean(
    env.SMTP_HOST &&
    Number.isInteger(Number(env.SMTP_PORT)) &&
    Number(env.SMTP_PORT) > 0 &&
    env.SMTP_USER &&
    env.SMTP_PASSWORD &&
    env.SMTP_FROM &&
    env.CLIENT_URL
  );

export const sendPasswordResetEmail = async ({ to, resetUrl }, env = process.env) => {
  if (!isEmailConfigured(env)) {
    throw new Error('Password reset email is not configured.');
  }

  const port = Number(env.SMTP_PORT);
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: env.SMTP_SECURE === 'true' || port === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
    },
  });

  await transport.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: 'Reset your Metro Nexus Festival OS password',
    text: `Use this link within 15 minutes to reset your password: ${resetUrl}`,
    html: `<p>Use the link below within 15 minutes to reset your password.</p><p><a href="${escapeHtml(resetUrl)}">Reset password</a></p>`,
  });
};
