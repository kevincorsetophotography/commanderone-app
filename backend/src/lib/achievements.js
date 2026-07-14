// Logica achievement lato server — rispecchia frontend/src/lib/achievements.js.
// Serve a rilevare i traguardi appena sbloccati e generare le notifiche.

const COLORS = ['W', 'U', 'B', 'R', 'G'];

// Metadati (icona + titolo) per i testi delle notifiche. Deve contenere tutti gli id.
const ACHIEVEMENT_META = {
  first_win:        { icon: '🏆', title: 'Prima vittoria' },
  rookie:           { icon: '🃏', title: 'Esordiente' },
  streak3:          { icon: '🔥', title: 'Sul fuoco' },
  streak5:          { icon: '💎', title: 'Implacabile' },
  streak7:          { icon: '☄️', title: 'Inarrestabile' },
  wins10:           { icon: '🥇', title: 'Habitué del podio' },
  wins25:           { icon: '🎖️', title: 'Macchina da guerra' },
  collector:        { icon: '🎴', title: 'Collezionista' },
  rainbow:          { icon: '🌈', title: 'Arcobaleno' },
  fivecolor_deck:   { icon: '🎨', title: 'Cinque colori' },
  monocolor_win:    { icon: '⚫', title: 'Purista' },
  survivor:         { icon: '🛡️', title: 'Sopravvissuto' },
  fullpod_win:      { icon: '🏟️', title: 'Re del pod' },
  hunter:           { icon: '🏹', title: 'Cacciatore' },
  executioner:      { icon: '🪓', title: 'Boia' },
  veteran:          { icon: '⚔️', title: 'Veterano' },
  games50:          { icon: '🎯', title: 'Mezzo secolo' },
  games100:         { icon: '💯', title: 'Centurione' },
  dominator:        { icon: '👑', title: 'Dominatore' },
  season_champion:  { icon: '🏅', title: 'Campione di stagione' },
  last_one_standing:{ icon: '💀', title: 'Ultimo in piedi' },
  nemesis5:         { icon: '😈', title: 'Nemesi' },
  triple_day:       { icon: '🎩', title: 'Tripletta' },
  wooden_spoon:     { icon: '🥄', title: 'Cucchiaio di legno' },
  giant_slayer:     { icon: '🗡️', title: 'Ammazzagiganti' },
  season_perfect:   { icon: '🌟', title: 'Stagione perfetta' },
};

// ── Stagioni (rispecchia frontend/src/lib/seasons.js) ──
const QUALIFY_RATIO = 0.30;
const seasonKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${Math.floor(d.getMonth() / 4)}`;
};
// Una stagione è "conclusa" se è precedente a quella corrente (le stagionali
// si assegnano solo a stagione finita, non al leader di quella in corso).
const seasonEnded = (key) => {
  const [y, i] = key.split('-').map(Number);
  const [cy, ci] = seasonKey(new Date()).split('-').map(Number);
  return y < cy || (y === cy && i < ci);
};
const pointsFor = (player, game) => {
  let pts = 1;
  const hasPlacement = game.players.every(p => p.placement != null);
  if (hasPlacement) {
    if (player.placement === 1) pts += 3;
    else if (player.placement === 2) pts += 2;
    else if (player.placement === 3) pts += 1;
  } else if (player.isWinner) pts += 3;
  return pts;
};
const seasonChampionId = (games, key) => {
  const seasonGames = games.filter(g => seasonKey(g.playedAt) === key);
  const threshold = Math.max(1, Math.ceil(seasonGames.length * QUALIFY_RATIO));
  const tally = {};
  for (const g of seasonGames) for (const p of g.players) {
    const id = p.user.id;
    if (!tally[id]) tally[id] = { id, points: 0, games: 0, wins: 0 };
    tally[id].points += pointsFor(p, g);
    tally[id].games += 1;
    if (p.isWinner) tally[id].wins += 1;
  }
  const standings = Object.values(tally)
    .map(s => ({ ...s, qualified: s.games >= threshold }))
    .sort((a, b) => (b.points - a.points) || (b.wins - a.wins) || (b.games - a.games));
  const champ = standings.find(s => s.qualified);
  return champ ? champ.id : null;
};

// Calcola la mappa id -> bool degli achievement sbloccati per un giocatore.
function computeUnlocked({ pid, myGames, myDecks, allGames }) {
  const me = (g) => g.players.find(p => p.user.id === pid);

  const total = myGames.length;
  const wins = myGames.filter(g => me(g)?.isWinner).length;
  const winRate = total ? Math.round(wins / total * 100) : 0;
  const deckCount = myDecks.length;

  const chrono = [...myGames].sort((a, b) => new Date(a.playedAt) - new Date(b.playedAt));
  let cur = 0, best = 0;
  for (const g of chrono) { if (me(g)?.isWinner) { cur++; best = Math.max(best, cur); } else cur = 0; }

  const wonColors = new Set();
  for (const g of myGames) { const m = me(g); if (m?.isWinner) (m.deck.colors || '').split('').forEach(c => wonColors.add(c)); }

  const placed = myGames.filter(g => me(g)?.placement != null);
  const avgPlacement = placed.length ? placed.reduce((s, g) => s + me(g).placement, 0) / placed.length : null;

  let kills = 0;
  const victimTally = {};
  for (const g of myGames) for (const p of g.players) {
    if (p.eliminatedById === pid && p.user.id !== pid) { kills++; victimTally[p.user.id] = (victimTally[p.user.id] || 0) + 1; }
  }
  const maxSameVictim = Object.values(victimTally).reduce((m, v) => Math.max(m, v), 0);

  let fullPodWin = false, monoWin = false, lastStanding = false, lastPlaceCount = 0;
  for (const g of myGames) {
    const m = me(g); const pod = g.players.length;
    if (m?.isWinner && pod >= 5) fullPodWin = true;
    if (m?.isWinner && (m.deck.colors || '').length === 1) monoWin = true;
    if (m?.isWinner) {
      const others = g.players.filter(p => p.user.id !== pid);
      if (others.length > 0 && others.every(p => p.eliminatedById != null)) lastStanding = true;
    }
    if (m?.placement != null && m.placement === pod) lastPlaceCount++;
  }

  const fiveColorDeck = myDecks.some(d => COLORS.every(c => (d.colors || '').includes(c)));

  const winsByDay = {};
  for (const g of myGames) if (me(g)?.isWinner) {
    const k = new Date(g.playedAt).toISOString().slice(0, 10);
    winsByDay[k] = (winsByDay[k] || 0) + 1;
  }
  const tripleDay = Object.values(winsByDay).some(v => v >= 3);

  const winTally = {};
  for (const g of allGames) for (const p of g.players) if (p.isWinner) winTally[p.user.id] = (winTally[p.user.id] || 0) + 1;
  let topWinnerId = null, topWins = 0;
  for (const [id, w] of Object.entries(winTally)) if (w > topWins) { topWins = w; topWinnerId = Number(id); }
  const giantSlayer = topWinnerId != null && topWinnerId !== pid && (victimTally[topWinnerId] || 0) > 0;

  let seasonChampion = false, seasonPerfect = false;
  if (allGames.length) {
    const keys = [...new Set(allGames.map(g => seasonKey(g.playedAt)))];
    for (const key of keys) {
      if (!seasonEnded(key)) continue; // solo stagioni concluse
      if (seasonChampionId(allGames, key) === pid) seasonChampion = true;
      const mine = myGames.filter(g => seasonKey(g.playedAt) === key);
      if (mine.length >= 5 && mine.every(g => me(g)?.isWinner)) seasonPerfect = true;
    }
  }

  return {
    first_win: wins >= 1,
    rookie: total >= 1,
    streak3: best >= 3,
    streak5: best >= 5,
    streak7: best >= 7,
    wins10: wins >= 10,
    wins25: wins >= 25,
    collector: deckCount >= 3,
    rainbow: COLORS.every(c => wonColors.has(c)),
    fivecolor_deck: fiveColorDeck,
    monocolor_win: monoWin,
    survivor: placed.length >= 3 && avgPlacement != null && avgPlacement <= 2,
    fullpod_win: fullPodWin,
    hunter: kills >= 10,
    executioner: kills >= 25,
    veteran: total >= 20,
    games50: total >= 50,
    games100: total >= 100,
    dominator: total >= 10 && winRate >= 40,
    season_champion: seasonChampion,
    last_one_standing: lastStanding,
    nemesis5: maxSameVictim >= 5,
    triple_day: tripleDay,
    wooden_spoon: lastPlaceCount >= 5,
    giant_slayer: giantSlayer,
    season_perfect: seasonPerfect,
  };
}

// Carica una sola volta i dati necessari (tutte le partite + i mazzi per utente),
// scoped a un singolo gruppo: gli achievement sono per-gruppo, non globali.
async function loadData(prisma, groupId) {
  const games = await prisma.game.findMany({
    where: { groupId },
    select: {
      playedAt: true,
      players: {
        select: {
          isWinner: true, placement: true, eliminatedById: true,
          user: { select: { id: true } },
          deck: { select: { colors: true } },
        },
      },
    },
  });
  const decks = await prisma.deck.findMany({ where: { groupId }, select: { userId: true, colors: true } });
  const decksByUser = new Map();
  for (const d of decks) {
    if (!decksByUser.has(d.userId)) decksByUser.set(d.userId, []);
    decksByUser.get(d.userId).push({ colors: d.colors });
  }
  return { games, decksByUser };
}

// Id degli achievement sbloccati da un utente, dati i dati già caricati.
function unlockedForUser({ games, decksByUser }, userId) {
  const myGames = games.filter(g => g.players.some(p => p.user.id === userId));
  const myDecks = decksByUser.get(userId) || [];
  const u = computeUnlocked({ pid: userId, myGames, myDecks, allGames: games });
  return Object.keys(u).filter(id => u[id]);
}

module.exports = { ACHIEVEMENT_META, loadData, unlockedForUser };
