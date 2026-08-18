const router = require('express').Router();
const requireGroupAdmin = require('../middleware/requireGroupAdmin');
const prisma = require('../lib/prisma');

router.use(requireGroupAdmin);

const parseId = (value) => {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) ? id : null;
};

// GET /api/groups/:slug/admin/export — backup dei dati del gruppo (mazzi e partite)
router.get('/export', async (req, res) => {
  const [decks, games] = await Promise.all([
    prisma.deck.findMany({
      where: { groupId: req.group.id },
      orderBy: { id: 'asc' },
      include: { user: { select: { username: true } } }
    }),
    prisma.game.findMany({
      where: { groupId: req.group.id },
      orderBy: { id: 'asc' },
      include: {
        createdBy: { select: { username: true } },
        players: { include: { user: { select: { username: true } }, deck: { select: { name: true } } } }
      }
    })
  ]);

  const payload = {
    group: req.group.name,
    exportedAt: new Date().toISOString(),
    counts: { decks: decks.length, games: games.length },
    decks: decks.map(d => ({ id: d.id, name: d.name, commander: d.commander, colors: d.colors, bracket: d.bracket, owner: d.user.username, hasDecklist: !!d.decklist })),
    games: games.map(g => ({
      id: g.id,
      playedAt: g.playedAt,
      notes: g.notes,
      createdBy: g.createdBy?.username || null,
      players: g.players
        .sort((a, b) => (a.placement || 99) - (b.placement || 99))
        .map(p => ({ player: p.user.username, deck: p.deck.name, placement: p.placement, isWinner: p.isWinner }))
    }))
  };

  res.setHeader('Content-Disposition', `attachment; filename="${req.group.slug}-backup-${new Date().toISOString().slice(0, 10)}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(payload, null, 2));
});

// GET /api/groups/:slug/admin/members
router.get('/members', async (req, res) => {
  const members = await prisma.groupMember.findMany({
    where: { groupId: req.group.id },
    orderBy: { joinedAt: 'asc' },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          _count: { select: { gamePlayers: true } }
        }
      }
    }
  });

  const deckCounts = await prisma.deck.groupBy({
    by: ['userId'],
    where: { groupId: req.group.id },
    _count: { _all: true },
  });
  const deckCountByUser = new Map(deckCounts.map(d => [d.userId, d._count._all]));

  res.json(members.map(m => ({
    userId: m.user.id,
    username: m.user.username,
    role: m.role,
    joinedAt: m.joinedAt,
    decks: deckCountByUser.get(m.user.id) || 0,
    games: m.user._count.gamePlayers,
  })));
});

// PATCH /api/groups/:slug/admin/members/:userId — cambia il ruolo del membro nel gruppo
router.patch('/members/:userId', async (req, res) => {
  const userId = parseId(req.params.userId);
  if (!userId) return res.status(400).json({ error: 'INVALID_USER_ID' });

  const role = req.body.role === 'ADMIN' || req.body.role === 'PLAYER' ? req.body.role : null;
  if (!role) return res.status(400).json({ error: 'INVALID_ROLE' });

  if (req.user.id === userId && role === 'PLAYER') {
    return res.status(400).json({ error: 'CANNOT_DEMOTE_SELF' });
  }

  try {
    const membership = await prisma.groupMember.update({
      where: { groupId_userId: { groupId: req.group.id, userId } },
      data: { role },
    });
    res.json({ userId, role: membership.role });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'MEMBER_NOT_FOUND' });
    console.error('admin update member error', error);
    res.status(500).json({ error: 'MEMBER_UPDATE_FAILED' });
  }
});

// DELETE /api/groups/:slug/admin/members/:userId — rimuove un membro dal gruppo
// (l'account resta, le sue partite/mazzi storici del gruppo restano; perde solo l'accesso)
router.delete('/members/:userId', async (req, res) => {
  const userId = parseId(req.params.userId);
  if (!userId) return res.status(400).json({ error: 'INVALID_USER_ID' });
  if (req.user.id === userId) {
    return res.status(400).json({ error: 'CANNOT_REMOVE_SELF' });
  }

  try {
    await prisma.groupMember.delete({
      where: { groupId_userId: { groupId: req.group.id, userId } },
    });
    res.json({ ok: true });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'MEMBER_NOT_FOUND' });
    console.error('admin remove member error', error);
    res.status(500).json({ error: 'MEMBER_REMOVE_FAILED' });
  }
});

module.exports = router;
