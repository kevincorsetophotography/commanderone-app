// Email transazionali (verifica indirizzo, reset password).
// In produzione usa Resend (https://resend.com) via RESEND_API_KEY.
// Senza chiave (dev locale) stampa il contenuto in console: i link
// funzionano lo stesso, basta copiarli dal terminale.

const FROM = process.env.MAIL_FROM || 'CommanderOne <onboarding@resend.dev>';

async function sendMail({ to, subject, text, html }) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`\n✉️  [mailer dev] To: ${to}\n    Subject: ${subject}\n    ${text.replace(/\n/g, '\n    ')}\n`);
    return { dev: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from: FROM, to, subject, text, html }),
  });
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

const frontendUrl = () => (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

async function sendVerificationEmail(to, rawToken) {
  const link = `${frontendUrl()}/verify-email?token=${rawToken}`;
  await sendMail({
    to,
    subject: 'Conferma il tuo indirizzo email — CommanderOne',
    text: `Ciao! Conferma il tuo indirizzo email aprendo questo link:\n\n${link}\n\nIl link scade tra 24 ore. Se non hai creato un account CommanderOne, ignora questa email.`,
    html: `<p>Ciao! Conferma il tuo indirizzo email cliccando il pulsante:</p>
<p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;border-radius:10px;text-decoration:none;font-weight:600">Conferma email</a></p>
<p style="color:#666;font-size:13px">Oppure apri questo link: <a href="${link}">${link}</a><br>Il link scade tra 24 ore. Se non hai creato un account CommanderOne, ignora questa email.</p>`,
  });
}

async function sendPasswordResetEmail(to, rawToken) {
  const link = `${frontendUrl()}/reset-password?token=${rawToken}`;
  await sendMail({
    to,
    subject: 'Reimposta la tua password — CommanderOne',
    text: `Hai chiesto di reimpostare la password. Apri questo link:\n\n${link}\n\nIl link scade tra 1 ora. Se non sei stato tu, ignora questa email: la tua password resta invariata.`,
    html: `<p>Hai chiesto di reimpostare la password del tuo account CommanderOne.</p>
<p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;border-radius:10px;text-decoration:none;font-weight:600">Reimposta password</a></p>
<p style="color:#666;font-size:13px">Oppure apri questo link: <a href="${link}">${link}</a><br>Il link scade tra 1 ora. Se non sei stato tu, ignora questa email: la tua password resta invariata.</p>`,
  });
}

module.exports = { sendMail, sendVerificationEmail, sendPasswordResetEmail };
