// Emissione e consumo di token monouso (verifica email, reset password).
// Il token "grezzo" viaggia solo nel link email; in DB c'è solo l'hash SHA-256.
const crypto = require('crypto');

const TYPES = { VERIFY_EMAIL: 'verify_email', RESET_PASSWORD: 'reset_password' };

const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

// Crea un token per l'utente, invalidando quelli precedenti dello stesso tipo
// (un solo link attivo per volta). Ritorna il token grezzo da mettere nel link.
async function issueToken(prisma, userId, type, ttlMs) {
  const raw = crypto.randomBytes(32).toString('base64url');
  await prisma.$transaction([
    prisma.authToken.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.authToken.create({
      data: { tokenHash: hashToken(raw), type, expiresAt: new Date(Date.now() + ttlMs), userId },
    }),
  ]);
  return raw;
}

// Verifica e brucia un token. Ritorna il record (con user) o null se
// invalido/scaduto/già usato.
async function consumeToken(prisma, raw, type) {
  if (typeof raw !== 'string' || raw.length < 16 || raw.length > 128) return null;
  const token = await prisma.authToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: true },
  });
  if (!token || token.type !== type || token.usedAt || token.expiresAt < new Date()) return null;
  await prisma.authToken.update({ where: { id: token.id }, data: { usedAt: new Date() } });
  return token;
}

module.exports = { TYPES, issueToken, consumeToken };
