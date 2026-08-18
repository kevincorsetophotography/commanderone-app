const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

module.exports = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Re-fetch da DB (non fidarsi solo del JWT se l'account viene modificato/eliminato)
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, username: true, passwordChangedAt: true },
    });
    if (!user) return res.status(401).json({ error: 'Utente non trovato' });
    // Cambio/reset password invalida tutte le sessioni precedenti.
    // Tolleranza 2s: iat ha precisione al secondo, il token nuovo emesso
    // nella stessa richiesta del cambio non deve auto-invalidarsi.
    if (
      user.passwordChangedAt &&
      typeof payload.iat === 'number' &&
      payload.iat * 1000 < user.passwordChangedAt.getTime() - 2000
    ) {
      return res.status(401).json({ error: 'Sessione scaduta, effettua di nuovo il login' });
    }
    req.user = { id: user.id, username: user.username };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};
