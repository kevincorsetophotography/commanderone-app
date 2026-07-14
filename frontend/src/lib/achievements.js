// Achievement: definizioni + calcolo. La logica di sblocco è rispecchiata nel
// backend (backend/src/lib/achievements.js) per generare le notifiche.
import { listSeasons, computeStandings, seasonOf } from './seasons'

// secret: true  -> nascosto ("???") finché non sbloccato, mostrato in oro.
export const ACHIEVEMENTS = [
  // ── Pubblici ──
  { id: 'first_win',     icon: '🏆', title: 'Prima vittoria',  desc: 'Vinci almeno una partita' },
  { id: 'rookie',        icon: '🃏', title: 'Esordiente',       desc: 'Gioca la tua prima partita' },
  { id: 'streak3',       icon: '🔥', title: 'Sul fuoco',        desc: '3 vittorie consecutive' },
  { id: 'streak5',       icon: '💎', title: 'Implacabile',      desc: '5 vittorie consecutive' },
  { id: 'streak7',       icon: '☄️', title: 'Inarrestabile',    desc: '7 vittorie consecutive' },
  { id: 'wins10',        icon: '🥇', title: 'Habitué del podio', desc: '10 vittorie totali' },
  { id: 'wins25',        icon: '🎖️', title: 'Macchina da guerra', desc: '25 vittorie totali' },
  { id: 'collector',     icon: '🎴', title: 'Collezionista',    desc: 'Possiedi 3 o più mazzi' },
  { id: 'rainbow',       icon: '🌈', title: 'Arcobaleno',       desc: 'Vinci con mazzi di tutti e 5 i colori' },
  { id: 'fivecolor_deck',icon: '🎨', title: 'Cinque colori',    desc: 'Possiedi un mazzo a 5 colori (WUBRG)' },
  { id: 'monocolor_win', icon: '⚫', title: 'Purista',          desc: 'Vinci con un mazzo monocolore' },
  { id: 'survivor',      icon: '🛡️', title: 'Sopravvissuto',    desc: 'Piazzamento medio ≤ 2 (min 3 partite)' },
  { id: 'fullpod_win',   icon: '🏟️', title: 'Re del pod',       desc: 'Vinci una partita a 5 giocatori' },
  { id: 'hunter',        icon: '🏹', title: 'Cacciatore',       desc: 'Infliggi 10 eliminazioni' },
  { id: 'executioner',   icon: '🪓', title: 'Boia',             desc: 'Infliggi 25 eliminazioni' },
  { id: 'veteran',       icon: '⚔️', title: 'Veterano',         desc: 'Gioca 20 partite' },
  { id: 'games50',       icon: '🎯', title: 'Mezzo secolo',     desc: 'Gioca 50 partite' },
  { id: 'games100',      icon: '💯', title: 'Centurione',       desc: 'Gioca 100 partite' },
  { id: 'dominator',     icon: '👑', title: 'Dominatore',       desc: 'Win rate ≥ 40% (min 10 partite)' },
  { id: 'season_champion', icon: '🏅', title: 'Campione di stagione', desc: 'Vinci una stagione del campionato' },

  // ── Segreti (oro) ──
  { id: 'last_one_standing', icon: '💀', title: 'Ultimo in piedi', desc: 'Vinci una partita in cui tutti gli altri sono stati eliminati', secret: true },
  { id: 'nemesis5',      icon: '😈', title: 'Nemesi',           desc: 'Elimina lo stesso avversario 5 volte', secret: true },
  { id: 'triple_day',    icon: '🎩', title: 'Tripletta',        desc: 'Vinci 3 partite nello stesso giorno', secret: true },
  { id: 'wooden_spoon',  icon: '🥄', title: 'Cucchiaio di legno', desc: 'Arriva ultimo 5 volte', secret: true },
  { id: 'giant_slayer',  icon: '🗡️', title: 'Ammazzagiganti',   desc: 'Elimina il giocatore con più vittorie del gruppo', secret: true },
  { id: 'season_perfect', icon: '🌟', title: 'Stagione perfetta', desc: 'Vinci tutte le tue partite in una stagione (min 5)', secret: true },
]

const COLORS = ['W', 'U', 'B', 'R', 'G']

// Calcola quali achievement sono sbloccati. Ritorna una mappa id -> bool.
export function computeUnlocked({ myGames = [], myDecks = [], pid, allGames = [] }) {
  const me = (g) => g.players.find(p => p.user.id === pid)

  const total = myGames.length
  const wins = myGames.filter(g => me(g)?.isWinner).length
  const winRate = total ? Math.round(wins / total * 100) : 0
  const deckCount = myDecks.length

  // streak migliore (cronologico)
  const chrono = [...myGames].sort((a, b) => new Date(a.playedAt) - new Date(b.playedAt))
  let cur = 0, best = 0
  for (const g of chrono) { if (me(g)?.isWinner) { cur++; best = Math.max(best, cur) } else cur = 0 }

  // colori con cui ha vinto
  const wonColors = new Set()
  for (const g of myGames) { const m = me(g); if (m?.isWinner) (m.deck.colors || '').split('').forEach(c => wonColors.add(c)) }

  // piazzamenti
  const placed = myGames.filter(g => me(g)?.placement != null)
  const avgPlacement = placed.length
    ? placed.reduce((s, g) => s + me(g).placement, 0) / placed.length
    : null

  // eliminazioni inflitte + conteggio per vittima
  let kills = 0
  const victimTally = {}
  for (const g of myGames) {
    for (const p of g.players) {
      if (p.eliminatedById === pid && p.user.id !== pid) {
        kills++
        victimTally[p.user.id] = (victimTally[p.user.id] || 0) + 1
      }
    }
  }
  const maxSameVictim = Object.values(victimTally).reduce((m, v) => Math.max(m, v), 0)

  // pod pieno / monocolore / ultimo in piedi / ultimo posto
  let fullPodWin = false, monoWin = false, lastStanding = false, lastPlaceCount = 0
  for (const g of myGames) {
    const m = me(g); const pod = g.players.length
    if (m?.isWinner && pod >= 5) fullPodWin = true
    if (m?.isWinner && (m.deck.colors || '').length === 1) monoWin = true
    if (m?.isWinner) {
      const others = g.players.filter(p => p.user.id !== pid)
      if (others.length > 0 && others.every(p => p.eliminatedById != null)) lastStanding = true
    }
    if (m?.placement != null && m.placement === pod) lastPlaceCount++
  }

  // mazzo a 5 colori
  const fiveColorDeck = myDecks.some(d => COLORS.every(c => (d.colors || '').includes(c)))

  // 3 vittorie nello stesso giorno
  const winsByDay = {}
  for (const g of myGames) {
    if (me(g)?.isWinner) {
      const k = new Date(g.playedAt).toISOString().slice(0, 10)
      winsByDay[k] = (winsByDay[k] || 0) + 1
    }
  }
  const tripleDay = Object.values(winsByDay).some(v => v >= 3)

  // ammazzagiganti: ho eliminato il giocatore con più vittorie del gruppo
  const winTally = {}
  for (const g of allGames) for (const p of g.players) if (p.isWinner) winTally[p.user.id] = (winTally[p.user.id] || 0) + 1
  let topWinnerId = null, topWins = 0
  for (const [id, w] of Object.entries(winTally)) if (w > topWins) { topWins = w; topWinnerId = Number(id) }
  const giantSlayer = topWinnerId != null && topWinnerId !== pid && (victimTally[topWinnerId] || 0) > 0

  // stagionali — solo su stagioni CONCLUSE (non il leader di quella in corso)
  const nowSeason = seasonOf(new Date())
  const seasonEnded = (s) => s.year < nowSeason.year || (s.year === nowSeason.year && s.idx < nowSeason.idx)
  let seasonChampion = false, seasonPerfect = false
  if (allGames.length) {
    for (const s of listSeasons(allGames)) {
      if (!seasonEnded(s)) continue
      const { champion } = computeStandings(allGames, s.key)
      if (champion && champion.id === pid) seasonChampion = true
      const mine = myGames.filter(g => seasonOf(g.playedAt).key === s.key)
      if (mine.length >= 5 && mine.every(g => me(g)?.isWinner)) seasonPerfect = true
    }
  }

  return {
    first_win:  wins >= 1,
    rookie:     total >= 1,
    streak3:    best >= 3,
    streak5:    best >= 5,
    streak7:    best >= 7,
    wins10:     wins >= 10,
    wins25:     wins >= 25,
    collector:  deckCount >= 3,
    rainbow:    COLORS.every(c => wonColors.has(c)),
    fivecolor_deck: fiveColorDeck,
    monocolor_win: monoWin,
    survivor:   placed.length >= 3 && avgPlacement != null && avgPlacement <= 2,
    fullpod_win: fullPodWin,
    hunter:     kills >= 10,
    executioner: kills >= 25,
    veteran:    total >= 20,
    games50:    total >= 50,
    games100:   total >= 100,
    dominator:  total >= 10 && winRate >= 40,
    season_champion: seasonChampion,
    last_one_standing: lastStanding,
    nemesis5:   maxSameVictim >= 5,
    triple_day: tripleDay,
    wooden_spoon: lastPlaceCount >= 5,
    giant_slayer: giantSlayer,
    season_perfect: seasonPerfect,
  }
}

// Lista achievement con stato sblocco, per la UI del profilo.
// `unlockedIds` è lo snapshot del server (fonte di verità): un achievement
// sbloccato lì resta mostrato anche se il calcolo live ora darebbe falso
// (es. ammazzagiganti quando cambia il più vincente). Si fa l'unione col live
// per coprire eventuali sblocchi non ancora persistiti.
export function getAchievements({ myGames, myDecks, pid, allGames = [], unlockedIds = [] }) {
  const live = computeUnlocked({ myGames, myDecks, pid, allGames })
  const persisted = new Set(unlockedIds)
  return ACHIEVEMENTS.map(a => ({ ...a, unlocked: persisted.has(a.id) || !!live[a.id] }))
}
