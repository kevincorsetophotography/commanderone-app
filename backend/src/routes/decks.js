const router = require('express').Router();
const { validateDecklist } = require('../lib/decklist');
const { checkAchievements } = require('../lib/notify');
const prisma = require('../lib/prisma');

const parseDeckId = (value) => {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) ? id : null;
};

// GET /api/groups/:slug/decks — tutti i mazzi del gruppo, usato per comporre il tavolo
router.get('/', async (req, res) => {
  const decks = await prisma.deck.findMany({
    where:   { groupId: req.group.id },
    include: { user: { select: { id: true, username: true, avatarCardName: true, avatarScryfallId: true } } },
    orderBy: [{ userId: 'asc' }, { name: 'asc' }]
  });
  res.json(decks);
});

// GET /api/groups/:slug/decks/mine
router.get('/mine', async (req, res) => {
  const decks = await prisma.deck.findMany({
    where: { groupId: req.group.id, userId: req.user.id },
    orderBy: { name: 'asc' }
  });
  res.json(decks);
});

// GET /api/groups/:slug/decks/:id — singolo mazzo con decklist (per il profilo mazzo)
router.get('/:id', async (req, res) => {
  const deckId = parseDeckId(req.params.id);
  if (!deckId) return res.status(400).json({ error: 'INVALID_DECK_ID' });

  const deck = await prisma.deck.findUnique({
    where: { id: deckId },
    include: { user: { select: { id: true, username: true } } }
  });
  if (!deck || deck.groupId !== req.group.id) return res.status(404).json({ error: 'DECK_NOT_FOUND' });
  res.json(deck);
});

const parseBracket = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const b = Number.parseInt(value, 10);
  return b >= 1 && b <= 4 ? b : null;
};

const ARCHETYPES = ['Aggro', 'Midrange', 'Control', 'Combo', 'Stax', 'Aristocrats', 'Tokens', 'Voltron', 'Ramp'];
const parseArchetype = (value) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  return ARCHETYPES.includes(value.trim()) ? value.trim() : null;
};

// Verifica che l'utente indicato sia membro del gruppo corrente (per la riassegnazione admin).
const resolveOwnerId = async (req, requestedUserId) => {
  const wanted = Number.parseInt(requestedUserId, 10);
  if (req.membership.role !== 'ADMIN' || !wanted) return req.user.id;
  const isMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: req.group.id, userId: wanted } },
  });
  return isMember ? wanted : req.user.id;
};

// POST /api/groups/:slug/decks
router.post('/', async (req, res) => {
  const { name, commander, colors, userId, bracket, archetype } = req.body;
  if (!name) return res.status(400).json({ error: 'DECK_NAME_REQUIRED' });

  const ownerId = await resolveOwnerId(req, userId);

  try {
    const deck = await prisma.deck.create({
      data: {
        name, commander, colors,
        bracket: parseBracket(bracket),
        archetype: parseArchetype(archetype),
        userId: ownerId,
        groupId: req.group.id,
      }
    });
    // Rileva l'achievement "Collezionista" (3+ mazzi)
    checkAchievements(prisma, req.group.id, [ownerId]);
    res.json(deck);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'DECK_NAME_TAKEN' });
    }

    console.error('create deck error', error);
    res.status(500).json({ error: 'DECK_CREATE_FAILED' });
  }
});

const DECK_MAX_CHARS = 20_000;

// PATCH /api/groups/:slug/decks/:id
router.patch('/:id', async (req, res) => {
  const deckId = parseDeckId(req.params.id);
  if (!deckId) return res.status(400).json({ error: 'INVALID_DECK_ID' });

  const deck = await prisma.deck.findUnique({ where: { id: deckId } });
  if (!deck || deck.groupId !== req.group.id) return res.status(404).json({ error: 'DECK_NOT_FOUND' });
  if (req.membership.role !== 'ADMIN' && deck.userId !== req.user.id) return res.status(403).json({ error: 'FORBIDDEN' });

  const { name, commander, colors, decklist, userId, bracket, archetype } = req.body;
  const nextOwnerId = userId === undefined ? deck.userId : await resolveOwnerId(req, userId);

  // Valida la decklist se viene fornita una lista non vuota
  if (typeof decklist === 'string' && decklist.trim()) {
    if (decklist.length > DECK_MAX_CHARS) {
      return res.status(400).json({ error: 'DECKLIST_TOO_LONG', max: DECK_MAX_CHARS });
    }
    const result = await validateDecklist(decklist);
    if (!result.valid) {
      return res.status(400).json({ error: result.errorCode, ...result.errorParams });
    }
  }

  try {
    const updated = await prisma.deck.update({
      where: { id: deck.id },
      data: {
        name, commander, colors,
        decklist: decklist ?? undefined,
        bracket: bracket === undefined ? undefined : parseBracket(bracket),
        archetype: archetype === undefined ? undefined : parseArchetype(archetype),
        userId: nextOwnerId
      }
    });
    res.json(updated);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'DECK_NAME_TAKEN' });
    }

    console.error('update deck error', error);
    res.status(500).json({ error: 'DECK_UPDATE_FAILED' });
  }
});

// POST /api/groups/:slug/decks/import — importa una lista da Archidekt o Moxfield via URL
router.post('/import', async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'URL_REQUIRED' });

  // Prevenzione SSRF: verifica l'hostname esatto invece di testare la stringa grezza
  let parsed;
  try { parsed = new URL(url); } catch { return res.status(400).json({ error: 'URL_INVALID' }); }
  const host = parsed.hostname.toLowerCase();

  try {
    if (host === 'archidekt.com' || host.endsWith('.archidekt.com')) {
      const m = url.match(/decks\/(\d+)/);
      if (!m) return res.status(400).json({ error: 'ARCHIDEKT_URL_INVALID' });
      const r = await fetch(`https://archidekt.com/api/decks/${m[1]}/`, {
        headers: { 'User-Agent': 'CommanderOneTracker/1.0' }
      });
      if (!r.ok) return res.status(502).json({ error: 'ARCHIDEKT_UNREACHABLE' });
      const data = await r.json();
      const lines = [];
      let commander = null;
      for (const c of data.cards || []) {
        const name = c.card?.oracleCard?.name;
        if (!name) continue;
        const cats = c.categories || [];
        const isCommander = cats.includes('Commander') || c.modifier === 'Commander';
        if (isCommander && !commander) commander = name;
        else lines.push(`${c.quantity || 1} ${name}`);
      }
      const decklist = [commander ? `1 ${commander}` : null, ...lines].filter(Boolean).join('\n');
      return res.json({ commander, decklist, name: data.name || null });
    }

    if (host === 'moxfield.com' || host.endsWith('.moxfield.com')) {
      const m = url.match(/decks\/([A-Za-z0-9_-]+)/);
      if (!m) return res.status(400).json({ error: 'MOXFIELD_URL_INVALID' });
      const r = await fetch(`https://api.moxfield.com/v2/decks/all/${m[1]}`, {
        headers: { 'User-Agent': 'CommanderOneTracker/1.0', 'Accept': 'application/json' }
      });
      if (!r.ok) return res.status(502).json({ error: 'MOXFIELD_BLOCKED' });
      const data = await r.json();
      const commanderName = Object.values(data.commanders || {})[0]?.card?.name || null;
      const lines = Object.values(data.mainboard || {}).map(c => `${c.quantity || 1} ${c.card?.name}`).filter(l => !l.endsWith('undefined'));
      const decklist = [commanderName ? `1 ${commanderName}` : null, ...lines].filter(Boolean).join('\n');
      return res.json({ commander: commanderName, decklist, name: data.name || null });
    }

    return res.status(400).json({ error: 'IMPORT_UNSUPPORTED_SITE' });
  } catch (error) {
    console.error('import deck error', error);
    return res.status(500).json({ error: 'IMPORT_FAILED' });
  }
});

// DELETE /api/groups/:slug/decks/:id
router.delete('/:id', async (req, res) => {
  const deckId = parseDeckId(req.params.id);
  if (!deckId) return res.status(400).json({ error: 'INVALID_DECK_ID' });

  const deck = await prisma.deck.findUnique({ where: { id: deckId } });
  if (!deck || deck.groupId !== req.group.id) return res.status(404).json({ error: 'DECK_NOT_FOUND' });
  if (req.membership.role !== 'ADMIN' && deck.userId !== req.user.id) return res.status(403).json({ error: 'FORBIDDEN' });

  try {
    await prisma.deck.delete({ where: { id: deck.id } });
    res.json({ ok: true });
  } catch (error) {
    if (error.code === 'P2003') {
      return res.status(409).json({ error: 'DECK_IN_USE' });
    }

    console.error('delete deck error', error);
    res.status(500).json({ error: 'DECK_DELETE_FAILED' });
  }
});

module.exports = router;
