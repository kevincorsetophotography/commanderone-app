const router = require('express').Router();
const { createNotifications, gameParticipantIds, checkAchievements } = require('../lib/notify');

const prisma = require('../lib/prisma');

const parseGameId = (value) => {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) ? id : null;
};

// Converte una data in input in Date valida; null se assente, undefined se invalida
const parsePlayedAt = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const validateGamePayload = async (groupId, { players, winnerId, winnerDeckId }) => {
  const normalizedWinnerId = Number.parseInt(winnerId, 10);
  const normalizedWinnerDeckId = Number.parseInt(winnerDeckId, 10);

  if (!players || players.length < 3 || players.length > 5) {
    return { error: 'GAME_PLAYERS_COUNT_INVALID' };
  }

  if (!normalizedWinnerId || !normalizedWinnerDeckId) {
    return { error: 'WINNER_REQUIRED' };
  }

  const normalizedPlayers = players.map((player) => ({
    userId: Number.parseInt(player.userId, 10),
    deckId: Number.parseInt(player.deckId, 10),
    placement: player.placement === undefined || player.placement === null || player.placement === ''
      ? null
      : Number.parseInt(player.placement, 10),
    eliminatedById: player.eliminatedById === undefined || player.eliminatedById === null || player.eliminatedById === ''
      ? null
      : Number.parseInt(player.eliminatedById, 10)
  }));

  if (normalizedPlayers.some((player) => !player.userId || !player.deckId)) {
    return { error: 'INVALID_PLAYER_DATA' };
  }

  // Validazione eliminazioni: il killer deve essere al tavolo e diverso dal giocatore; il vincitore non viene eliminato
  const playerUserIds = new Set(normalizedPlayers.map((p) => p.userId));
  for (const p of normalizedPlayers) {
    if (p.eliminatedById === null || Number.isNaN(p.eliminatedById)) { p.eliminatedById = null; continue; }
    if (!playerUserIds.has(p.eliminatedById)) {
      return { error: 'ELIMINATOR_NOT_AT_TABLE' };
    }
    if (p.eliminatedById === p.userId) {
      return { error: 'CANNOT_ELIMINATE_SELF' };
    }
    if (p.userId === normalizedWinnerId && p.deckId === normalizedWinnerDeckId) {
      p.eliminatedById = null; // il vincitore sopravvive
    }
  }

  // Validazione piazzamenti: se ne è presente almeno uno, devono esserci tutti e formare 1..N univoci
  const withPlacement = normalizedPlayers.filter((p) => p.placement !== null && !Number.isNaN(p.placement));
  if (withPlacement.length > 0) {
    const n = normalizedPlayers.length;
    if (withPlacement.length !== n) {
      return { error: 'PLACEMENT_ALL_OR_NONE' };
    }
    const set = new Set(withPlacement.map((p) => p.placement));
    if (set.size !== n || [...set].some((v) => v < 1 || v > n)) {
      return { error: 'PLACEMENT_INVALID_RANGE', errorParams: { n } };
    }
    const winnerPlacement = normalizedPlayers.find(
      (p) => p.userId === normalizedWinnerId && p.deckId === normalizedWinnerDeckId
    )?.placement;
    if (winnerPlacement !== 1) {
      return { error: 'WINNER_MUST_BE_FIRST' };
    }
  }

  const uniqueUsers = new Set(normalizedPlayers.map((player) => player.userId));
  if (uniqueUsers.size !== normalizedPlayers.length) {
    return { error: 'DUPLICATE_PLAYER' };
  }

  const winnerInGame = normalizedPlayers.some(
    (player) => player.userId === normalizedWinnerId && player.deckId === normalizedWinnerDeckId
  );
  if (!winnerInGame) {
    return { error: 'WINNER_NOT_AT_TABLE' };
  }

  const deckIds = normalizedPlayers.map((player) => player.deckId);
  const decks = await prisma.deck.findMany({
    where: { id: { in: deckIds }, groupId },
    select: { id: true, userId: true }
  });
  const decksById = new Map(decks.map((deck) => [deck.id, deck]));

  const invalidDeckOwnership = normalizedPlayers.some((player) => {
    const deck = decksById.get(player.deckId);
    return !deck || deck.userId !== player.userId;
  });

  if (invalidDeckOwnership) {
    return { error: 'DECK_OWNERSHIP_MISMATCH' };
  }

  return {
    normalizedPlayers,
    normalizedWinnerId,
    normalizedWinnerDeckId
  };
};

const gameInclude = {
  createdBy: { select: { id: true, username: true } },
  players: {
    include: {
      user: { select: { id: true, username: true, avatarCardName: true, avatarScryfallId: true } },
      deck: true
    }
  },
  reactions: { select: { emoji: true, userId: true, user: { select: { username: true } } } },
  _count: { select: { comments: true } }
};

// GET /api/groups/:slug/games — senza query params ritorna l'array completo
// come sempre (retrocompatibile: FeedPage/DashboardPage/GruppoPage/... calcolano
// stat aggregate lato client sull'intera lista). Con ?page/?pageSize passati
// esplicitamente, ritorna una pagina + metadati — per chi vuole davvero
// paginare (es. uno storico partite molto lungo) senza scaricarlo tutto.
router.get('/', async (req, res) => {
  const where = { groupId: req.group.id };
  const paginated = req.query.page !== undefined || req.query.pageSize !== undefined;

  if (!paginated) {
    const games = await prisma.game.findMany({ where, orderBy: { playedAt: 'desc' }, include: gameInclude });
    return res.json(games);
  }

  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 20));

  const [games, total] = await Promise.all([
    prisma.game.findMany({
      where, orderBy: { playedAt: 'desc' }, include: gameInclude,
      skip: (page - 1) * pageSize, take: pageSize,
    }),
    prisma.game.count({ where }),
  ]);

  res.json({ games, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
});

// GET /api/groups/:slug/games/:id — singola partita con dettagli (per la pagina partita)
router.get('/:id', async (req, res) => {
  const gameId = parseGameId(req.params.id);
  if (!gameId) return res.status(400).json({ error: 'INVALID_GAME_ID' });
  try {
    const game = await prisma.game.findUnique({ where: { id: gameId }, include: gameInclude });
    if (!game || game.groupId !== req.group.id) return res.status(404).json({ error: 'GAME_NOT_FOUND' });
    res.json(game);
  } catch (error) {
    console.error('get game error', error);
    res.status(500).json({ error: 'GAME_LOAD_FAILED' });
  }
});

router.post('/', async (req, res) => {
  const { players, winnerId, winnerDeckId, notes, playedAt } = req.body;
  if (notes && typeof notes === 'string' && notes.length > MAX_NOTES_LEN)
    return res.status(400).json({ error: 'NOTES_TOO_LONG', max: MAX_NOTES_LEN });
  const validation = await validateGamePayload(req.group.id, { players, winnerId, winnerDeckId });

  if (validation.error) {
    return res.status(400).json({ error: validation.error, ...validation.errorParams });
  }

  const parsedDate = parsePlayedAt(playedAt);
  if (parsedDate === undefined) {
    return res.status(400).json({ error: 'GAME_DATE_INVALID' });
  }

  const { normalizedPlayers, normalizedWinnerId, normalizedWinnerDeckId } = validation;

  const game = await prisma.game.create({
    data: {
      notes,
      ...(parsedDate ? { playedAt: parsedDate } : {}),
      groupId: req.group.id,
      createdByUserId: req.user.id,
      players: {
        create: normalizedPlayers.map((player) => ({
          userId: player.userId,
          deckId: player.deckId,
          placement: player.placement ?? null,
          eliminatedById: player.eliminatedById ?? null,
          isWinner: player.userId === normalizedWinnerId && player.deckId === normalizedWinnerDeckId
        }))
      }
    },
    include: gameInclude
  });

  // Rileva e notifica eventuali achievement sbloccati dai partecipanti
  checkAchievements(prisma, req.group.id, normalizedPlayers.map(p => p.userId));

  res.json(game);
});

router.patch('/:id', async (req, res) => {
  const gameId = parseGameId(req.params.id);
  if (!gameId) return res.status(400).json({ error: 'INVALID_GAME_ID' });

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, groupId: true, createdByUserId: true }
  });

  if (!game || game.groupId !== req.group.id) return res.status(404).json({ error: 'GAME_NOT_FOUND' });
  if (req.membership.role !== 'ADMIN' && game.createdByUserId !== req.user.id) {
    return res.status(403).json({ error: 'GAME_UPDATE_FORBIDDEN' });
  }

  const { players, winnerId, winnerDeckId, notes, playedAt } = req.body;
  if (notes && typeof notes === 'string' && notes.length > MAX_NOTES_LEN)
    return res.status(400).json({ error: 'NOTES_TOO_LONG', max: MAX_NOTES_LEN });
  const validation = await validateGamePayload(req.group.id, { players, winnerId, winnerDeckId });

  if (validation.error) {
    return res.status(400).json({ error: validation.error, ...validation.errorParams });
  }

  const parsedDate = parsePlayedAt(playedAt);
  if (parsedDate === undefined) {
    return res.status(400).json({ error: 'GAME_DATE_INVALID' });
  }

  const { normalizedPlayers, normalizedWinnerId, normalizedWinnerDeckId } = validation;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.gamePlayer.deleteMany({ where: { gameId: game.id } });

    return tx.game.update({
      where: { id: game.id },
      data: {
        notes,
        ...(parsedDate ? { playedAt: parsedDate } : {}),
        players: {
          create: normalizedPlayers.map((player) => ({
            userId: player.userId,
            deckId: player.deckId,
            isWinner: player.userId === normalizedWinnerId && player.deckId === normalizedWinnerDeckId
          }))
        }
      },
      include: gameInclude
    });
  });

  checkAchievements(prisma, req.group.id, normalizedPlayers.map(p => p.userId));

  res.json(updated);
});

router.delete('/:id', async (req, res) => {
  const gameId = parseGameId(req.params.id);
  if (!gameId) return res.status(400).json({ error: 'INVALID_GAME_ID' });

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, groupId: true, createdByUserId: true }
  });

  if (!game || game.groupId !== req.group.id) return res.status(404).json({ error: 'GAME_NOT_FOUND' });
  if (req.membership.role !== 'ADMIN' && (!game.createdByUserId || game.createdByUserId !== req.user.id)) {
    return res.status(403).json({ error: 'GAME_DELETE_FORBIDDEN' });
  }

  await prisma.game.delete({ where: { id: game.id } });
  res.json({ ok: true });
});

// ─── Commenti & reazioni ───────────────────────────────────────────────

// Emoji consentite per le reazioni (deve combaciare col frontend)
const REACTION_EMOJI = ['👍', '🔥', '😂', '😮', '💀', '🎉', '🐸'];
const MAX_COMMENT_LEN = 1000;
const MAX_NOTES_LEN = 2000;

// Verifica che la partita esista e appartenga al gruppo corrente.
const findGameInGroup = (req, gameId) =>
  prisma.game.findFirst({ where: { id: gameId, groupId: req.group.id }, select: { id: true } });

// GET /api/groups/:slug/games/:id/comments — thread completo (caricato on-demand)
router.get('/:id/comments', async (req, res) => {
  const gameId = parseGameId(req.params.id);
  if (!gameId) return res.status(400).json({ error: 'INVALID_GAME_ID' });

  try {
    const game = await findGameInGroup(req, gameId);
    if (!game) return res.status(404).json({ error: 'GAME_NOT_FOUND' });

    const comments = await prisma.comment.findMany({
      where: { gameId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, username: true, avatarCardName: true, avatarScryfallId: true } } }
    });
    res.json(comments);
  } catch (error) {
    console.error('list comments error', error);
    res.status(500).json({ error: 'COMMENTS_LOAD_FAILED' });
  }
});

// POST /api/groups/:slug/games/:id/comments — aggiungi un commento
router.post('/:id/comments', async (req, res) => {
  const gameId = parseGameId(req.params.id);
  if (!gameId) return res.status(400).json({ error: 'INVALID_GAME_ID' });

  const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
  if (!body) return res.status(400).json({ error: 'COMMENT_EMPTY' });
  if (body.length > MAX_COMMENT_LEN) return res.status(400).json({ error: 'COMMENT_TOO_LONG', max: MAX_COMMENT_LEN });

  try {
    const game = await findGameInGroup(req, gameId);
    if (!game) return res.status(404).json({ error: 'GAME_NOT_FOUND' });

    const comment = await prisma.comment.create({
      data: { gameId, userId: req.user.id, body },
      include: { user: { select: { id: true, username: true, avatarCardName: true, avatarScryfallId: true } } }
    });

    // Notifica gli altri partecipanti alla partita
    const participants = await gameParticipantIds(prisma, gameId);
    await createNotifications(prisma, req.group.id, participants.filter(id => id !== req.user.id), {
      type: 'comment',
      title: `💬 ${req.user.username} ha commentato una tua partita`,
      body: body.length > 80 ? body.slice(0, 80) + '…' : body,
      link: `/partita/${gameId}`,
      fromUserId: req.user.id,
    });

    res.json(comment);
  } catch (error) {
    console.error('create comment error', error);
    res.status(500).json({ error: 'COMMENT_CREATE_FAILED' });
  }
});

// DELETE /api/groups/:slug/games/:gameId/comments/:commentId — autore o admin
router.delete('/:gameId/comments/:commentId', async (req, res) => {
  const gameId = parseGameId(req.params.gameId);
  const commentId = Number.parseInt(req.params.commentId, 10);
  if (!gameId || !Number.isInteger(commentId)) return res.status(400).json({ error: 'INVALID_ID' });

  try {
    const game = await findGameInGroup(req, gameId);
    if (!game) return res.status(404).json({ error: 'GAME_NOT_FOUND' });

    const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { id: true, gameId: true, userId: true } });
    if (!comment || comment.gameId !== gameId) return res.status(404).json({ error: 'COMMENT_NOT_FOUND' });
    if (req.membership.role !== 'ADMIN' && comment.userId !== req.user.id) {
      return res.status(403).json({ error: 'COMMENT_DELETE_FORBIDDEN' });
    }

    await prisma.comment.delete({ where: { id: commentId } });
    res.json({ ok: true });
  } catch (error) {
    console.error('delete comment error', error);
    res.status(500).json({ error: 'COMMENT_DELETE_FAILED' });
  }
});

// POST /api/groups/:slug/games/:id/reactions — toggle di una reazione emoji
router.post('/:id/reactions', async (req, res) => {
  const gameId = parseGameId(req.params.id);
  if (!gameId) return res.status(400).json({ error: 'INVALID_GAME_ID' });

  const emoji = typeof req.body.emoji === 'string' ? req.body.emoji : '';
  if (!REACTION_EMOJI.includes(emoji)) return res.status(400).json({ error: 'INVALID_REACTION' });

  try {
    const game = await findGameInGroup(req, gameId);
    if (!game) return res.status(404).json({ error: 'GAME_NOT_FOUND' });

    const existing = await prisma.reaction.findUnique({
      where: { gameId_userId_emoji: { gameId, userId: req.user.id, emoji } }
    });
    if (existing) {
      await prisma.reaction.delete({ where: { id: existing.id } });
    } else {
      await prisma.reaction.create({ data: { gameId, userId: req.user.id, emoji } });
      // Notifica gli altri partecipanti solo all'aggiunta della reazione
      const participants = await gameParticipantIds(prisma, gameId);
      await createNotifications(prisma, req.group.id, participants.filter(id => id !== req.user.id), {
        type: 'reaction',
        title: `${emoji} ${req.user.username} ha reagito a una tua partita`,
        link: `/partita/${gameId}`,
        fromUserId: req.user.id,
      });
    }

    const reactions = await prisma.reaction.findMany({
      where: { gameId },
      select: { emoji: true, userId: true, user: { select: { username: true } } }
    });
    res.json({ reactions });
  } catch (error) {
    console.error('toggle reaction error', error);
    res.status(500).json({ error: 'REACTION_FAILED' });
  }
});

module.exports = router;
