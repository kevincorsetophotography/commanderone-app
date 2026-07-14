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
      select: { id: true, username: true },
    });
    if (!user) return res.status(401).json({ error: 'Utente non trovato' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};
