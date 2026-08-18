const router = require('express').Router();
const prisma = require('../lib/prisma');

// GET /api/groups/:slug/stats/achievements/:userId — id degli achievement sbloccati
// (snapshot del server: fonte di verità, così il profilo non "perde" quelli non monotoni)
router.get('/achievements/:userId', async (req, res) => {
  const userId = Number.parseInt(req.params.userId, 10);
  if (!Number.isInteger(userId)) return res.status(400).json({ error: 'INVALID_ID' });
  try {
    const rows = await prisma.achievementUnlock.findMany({
      where: { userId, groupId: req.group.id },
      select: { achievementId: true }
    });
    res.json({ unlocked: rows.map(r => r.achievementId) });
  } catch (error) {
    console.error('get achievements error', error);
    res.status(500).json({ error: 'ACHIEVEMENTS_LOAD_FAILED' });
  }
});

// GET /api/groups/:slug/stats/players
router.get('/players', async (req, res) => {
  try {
    const members = await prisma.groupMember.findMany({
      where: { groupId: req.group.id },
      select: {
        user: {
          select: {
            id: true,
            username: true,
            avatarCardName: true,
            avatarScryfallId: true,
            gamePlayers: { where: { game: { groupId: req.group.id } }, select: { isWinner: true } }
          }
        }
      }
    });
    const stats = members.map(({ user: p }) => ({
      id:             p.id,
      username:       p.username,
      avatarCardName:   p.avatarCardName ?? null,
      avatarScryfallId: p.avatarScryfallId ?? null,
      games:          p.gamePlayers.length,
      wins:           p.gamePlayers.filter(gp => gp.isWinner).length,
      winRate:        p.gamePlayers.length > 0
        ? Math.round(p.gamePlayers.filter(gp => gp.isWinner).length / p.gamePlayers.length * 100)
        : 0
    }));
    res.json(stats.sort((a, b) => b.winRate - a.winRate));
  } catch (error) {
    console.error('stats players error', error);
    res.status(500).json({ error: 'PLAYER_STATS_LOAD_FAILED' });
  }
});

// GET /api/groups/:slug/stats/decks
router.get('/decks', async (req, res) => {
  try {
    const decks = await prisma.deck.findMany({
      where: { groupId: req.group.id },
      include: {
        user:        { select: { id: true, username: true } },
        gamePlayers: { select: { isWinner: true } }
      }
    });
    const stats = decks.map(d => ({
      id:        d.id,
      name:      d.name,
      commander: d.commander,
      colors:    d.colors,
      bracket:   d.bracket,
      archetype: d.archetype,
      owner:     d.user.username,
      ownerId:   d.user.id,
      games:     d.gamePlayers.length,
      wins:      d.gamePlayers.filter(gp => gp.isWinner).length,
      winRate:   d.gamePlayers.length > 0
        ? Math.round(d.gamePlayers.filter(gp => gp.isWinner).length / d.gamePlayers.length * 100)
        : 0
    }));
    res.json(stats.sort((a, b) => b.winRate - a.winRate));
  } catch (error) {
    console.error('stats decks error', error);
    res.status(500).json({ error: 'DECK_STATS_LOAD_FAILED' });
  }
});

// GET /api/groups/:slug/stats/matchups
router.get('/matchups', async (req, res) => {
  try {
    const games = await prisma.game.findMany({
      where: { groupId: req.group.id },
      include: {
        players: {
          include: { deck: { include: { user: { select: { username: true } } } } }
        }
      }
    });

    const matchupMap = {};
    const deckMeta   = {};

    games.forEach(g => {
      const players = g.players;

      players.forEach(p => {
        deckMeta[p.deckId] = { id: p.deckId, name: p.deck.name, owner: p.deck.user.username };
        players.forEach(opp => {
          if (opp.id === p.id) return;
          if (!matchupMap[p.deckId])             matchupMap[p.deckId] = {};
          if (!matchupMap[p.deckId][opp.deckId]) matchupMap[p.deckId][opp.deckId] = { games: 0, wins: 0 };
          matchupMap[p.deckId][opp.deckId].games++;
          if (p.isWinner) matchupMap[p.deckId][opp.deckId].wins++;
        });
      });
    });

    const result = [];
    Object.entries(matchupMap).forEach(([a, vs]) => {
      Object.entries(vs).forEach(([b, data]) => {
        result.push({
          deckA:   deckMeta[parseInt(a)],
          deckB:   deckMeta[parseInt(b)],
          games:   data.games,
          wins:    data.wins,
          winRate: Math.round(data.wins / data.games * 100)
        });
      });
    });

    res.json(result);
  } catch (error) {
    console.error('stats matchups error', error);
    res.status(500).json({ error: 'MATCHUPS_LOAD_FAILED' });
  }
});

module.exports = router;
