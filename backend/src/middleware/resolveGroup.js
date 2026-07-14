const prisma = require('../lib/prisma');

// Risolve :slug in req.group e verifica che req.user sia membro del gruppo.
// Va montato DOPO auth (richiede req.user già popolato).
module.exports = async (req, res, next) => {
  try {
    const group = await prisma.group.findUnique({ where: { slug: req.params.slug } });
    if (!group) return res.status(404).json({ error: 'Gruppo non trovato' });

    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: req.user.id } },
    });
    if (!membership) return res.status(403).json({ error: 'Non fai parte di questo gruppo' });

    req.group = { id: group.id, slug: group.slug, name: group.name };
    req.membership = { role: membership.role };
    next();
  } catch (error) {
    console.error('resolveGroup error', error);
    res.status(500).json({ error: 'Errore durante la risoluzione del gruppo' });
  }
};
