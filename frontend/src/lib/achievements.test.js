import { describe, it, expect } from 'vitest'
import { computeUnlocked, getAchievements, ACHIEVEMENTS } from './achievements'

const PID = 1
const me = (props = {}) => ({ user: { id: PID, username: 'Me' }, isWinner: false, placement: null, eliminatedById: null, deck: { colors: 'R' }, ...props })
const opp = (id, props = {}) => ({ user: { id, username: 'O' + id }, isWinner: false, placement: null, eliminatedById: null, deck: { colors: 'G' }, ...props })
const game = (players, playedAt = '2026-05-10') => ({ playedAt, players })
// date valide e crescenti (5 maggio 2026 + i giorni in UTC), tutte nella stagione Mag–Ago
const dateAt = (i) => new Date(Date.UTC(2026, 4, 5 + i)).toISOString().slice(0, 10)

// scorciatoia: calcola gli sblocchi con allGames = myGames se non specificato
const unlocked = ({ myGames = [], myDecks = [], allGames }) =>
  computeUnlocked({ pid: PID, myGames, myDecks, allGames: allGames || myGames })

const winG = (date) => game([me({ isWinner: true, placement: 1 }), opp(2, { placement: 2 }), opp(3, { placement: 3 })], date)
const lossG = (date) => game([me({ placement: 3 }), opp(2, { isWinner: true, placement: 1 }), opp(3, { placement: 2 })], date)

describe('achievements di base', () => {
  it('prima vittoria + esordiente al primo successo', () => {
    const u = unlocked({ myGames: [winG()] })
    expect(u.first_win).toBe(true)
    expect(u.rookie).toBe(true)
  })

  it('esordiente senza vittoria, ma niente prima vittoria', () => {
    const u = unlocked({ myGames: [lossG()] })
    expect(u.rookie).toBe(true)
    expect(u.first_win).toBe(false)
  })

  it('streak 3 / 5 / 7 in base alle vittorie consecutive', () => {
    const seq = (n) => Array.from({ length: n }, (_, i) => winG(dateAt(i)))
    expect(unlocked({ myGames: seq(3) }).streak3).toBe(true)
    expect(unlocked({ myGames: seq(3) }).streak5).toBe(false)
    expect(unlocked({ myGames: seq(5) }).streak5).toBe(true)
    expect(unlocked({ myGames: seq(7) }).streak7).toBe(true)
  })

  it('una sconfitta azzera la streak', () => {
    const games = [winG('2026-05-10'), winG('2026-05-11'), lossG('2026-05-12'), winG('2026-05-13')]
    expect(unlocked({ myGames: games }).streak3).toBe(false)
  })

  it('milestone partite e vittorie', () => {
    const wins = (n) => Array.from({ length: n }, (_, i) => winG(dateAt(i)))
    expect(unlocked({ myGames: wins(10) }).wins10).toBe(true)
    expect(unlocked({ myGames: wins(20) }).veteran).toBe(true)
    expect(unlocked({ myGames: wins(25) }).wins25).toBe(true)
  })

  it('dominator: ≥10 partite e win rate ≥ 40%', () => {
    const games = [...Array(4).fill().map((_, i) => winG(dateAt(i))), ...Array(6).fill().map((_, i) => lossG(dateAt(40 + i)))]
    expect(unlocked({ myGames: games }).dominator).toBe(true) // 4/10 = 40%
  })
})

describe('mazzi e colori', () => {
  it('purista: vittoria con mazzo monocolore', () => {
    expect(unlocked({ myGames: [game([me({ isWinner: true, deck: { colors: 'R' } }), opp(2), opp(3)])] }).monocolor_win).toBe(true)
    expect(unlocked({ myGames: [game([me({ isWinner: true, deck: { colors: 'RG' } }), opp(2), opp(3)])] }).monocolor_win).toBe(false)
  })

  it('cinque colori: possiedi un mazzo WUBRG', () => {
    expect(unlocked({ myGames: [], myDecks: [{ colors: 'WUBRG' }] }).fivecolor_deck).toBe(true)
    expect(unlocked({ myGames: [], myDecks: [{ colors: 'WUB' }] }).fivecolor_deck).toBe(false)
  })

  it('arcobaleno: vinci con tutti e 5 i colori (tra più mazzi)', () => {
    const games = [
      game([me({ isWinner: true, deck: { colors: 'WU' } }), opp(2)]),
      game([me({ isWinner: true, deck: { colors: 'BR' } }), opp(2)]),
      game([me({ isWinner: true, deck: { colors: 'G' } }), opp(2)]),
    ]
    expect(unlocked({ myGames: games }).rainbow).toBe(true)
  })
})

describe('eliminazioni', () => {
  const killG = (victimId, date) => game([me({ isWinner: true }), opp(victimId, { eliminatedById: PID }), opp(99)], date)

  it('cacciatore a 10 eliminazioni (vittime diverse)', () => {
    const games = Array.from({ length: 10 }, (_, i) => killG(100 + i, dateAt(i)))
    expect(unlocked({ myGames: games }).hunter).toBe(true)
  })

  it('nemesi (segreto): stessa vittima 5 volte', () => {
    const games = Array.from({ length: 5 }, (_, i) => killG(2, dateAt(i)))
    expect(unlocked({ myGames: games }).nemesis5).toBe(true)
    // 4 volte non basta
    expect(unlocked({ myGames: games.slice(0, 4) }).nemesis5).toBe(false)
  })

  it('ultimo in piedi (segreto): vinci con tutti gli altri eliminati', () => {
    const g = game([me({ isWinner: true }), opp(2, { eliminatedById: PID }), opp(3, { eliminatedById: 2 })])
    expect(unlocked({ myGames: [g] }).last_one_standing).toBe(true)
    // se uno non è stato eliminato, no
    const g2 = game([me({ isWinner: true }), opp(2, { eliminatedById: PID }), opp(3, { eliminatedById: null })])
    expect(unlocked({ myGames: [g2] }).last_one_standing).toBe(false)
  })

  it('ammazzagiganti (segreto): elimini il giocatore con più vittorie del gruppo', () => {
    // opp 2 è il top-winner del gruppo (vince 2 partite altrove)
    const allGames = [
      game([opp(2, { isWinner: true }), opp(5)]),
      game([opp(2, { isWinner: true }), opp(5)]),
      game([me({ isWinner: true }), opp(2, { eliminatedById: PID })]),
    ]
    const myGames = allGames.filter(g => g.players.some(p => p.user.id === PID))
    expect(unlocked({ myGames, allGames }).giant_slayer).toBe(true)
  })
})

describe('pod, piazzamenti, giornata', () => {
  it('re del pod: vinci una partita a 5', () => {
    const g = game([me({ isWinner: true, placement: 1 }), opp(2, { placement: 2 }), opp(3, { placement: 3 }), opp(4, { placement: 4 }), opp(5, { placement: 5 })])
    expect(unlocked({ myGames: [g] }).fullpod_win).toBe(true)
  })

  it('cucchiaio di legno (segreto): arrivi ultimo 5 volte', () => {
    const lastG = (date) => game([me({ placement: 3 }), opp(2, { placement: 1 }), opp(3, { placement: 2 })], date)
    const games = Array.from({ length: 5 }, (_, i) => lastG(dateAt(i)))
    expect(unlocked({ myGames: games }).wooden_spoon).toBe(true)
  })

  it('tripletta (segreto): 3 vittorie nello stesso giorno', () => {
    const games = [winG('2026-05-10'), winG('2026-05-10'), winG('2026-05-10')]
    expect(unlocked({ myGames: games }).triple_day).toBe(true)
  })
})

describe('stagionali (solo stagioni concluse)', () => {
  // date in una stagione già conclusa (6 mesi fa) e in quella in corso (oggi)
  const endedDate = (i) => { const d = new Date(); d.setMonth(d.getMonth() - 6); d.setDate(5 + i); return d.toISOString().slice(0, 10) }
  const today = new Date().toISOString().slice(0, 10)
  const seasonGames = (dateFn) => Array.from({ length: 5 }, (_, i) =>
    game([me({ isWinner: true, placement: 1 }), opp(2, { placement: 2 })], typeof dateFn === 'function' ? dateFn(i) : dateFn))

  it('campione: assegnato per una stagione CONCLUSA', () => {
    const g = seasonGames(endedDate)
    expect(unlocked({ myGames: g, allGames: g }).season_champion).toBe(true)
  })

  it('campione: NON assegnato per la stagione in corso', () => {
    const g = seasonGames(today)
    expect(unlocked({ myGames: g, allGames: g }).season_champion).toBe(false)
  })

  it('stagione perfetta: tutte vinte in una stagione conclusa (non con una sconfitta, non in corso)', () => {
    const g = seasonGames(endedDate)
    expect(unlocked({ myGames: g, allGames: g }).season_perfect).toBe(true)
    const withLoss = [...g.slice(0, 4), lossG(endedDate(4))]
    expect(unlocked({ myGames: withLoss, allGames: withLoss }).season_perfect).toBe(false)
    expect(unlocked({ myGames: seasonGames(today), allGames: seasonGames(today) }).season_perfect).toBe(false)
  })
})

describe('getAchievements: snapshot del server', () => {
  it('mostra sbloccato ciò che è nello snapshot anche se il live darebbe falso', () => {
    // nessuna partita -> live tutto falso, ma lo snapshot ha giant_slayer
    const list = getAchievements({ myGames: [], myDecks: [], pid: PID, allGames: [], unlockedIds: ['giant_slayer'] })
    expect(list.find(a => a.id === 'giant_slayer').unlocked).toBe(true)
    expect(list.find(a => a.id === 'first_win').unlocked).toBe(false)
  })
})

describe('getAchievements', () => {
  it('ritorna ogni definizione con flag unlocked e mantiene secret', () => {
    const list = getAchievements({ myGames: [winG()], myDecks: [], pid: PID, allGames: [winG()] })
    expect(list.length).toBe(ACHIEVEMENTS.length)
    const firstWin = list.find(a => a.id === 'first_win')
    expect(firstWin.unlocked).toBe(true)
    const nemesi = list.find(a => a.id === 'nemesis5')
    expect(nemesi.secret).toBe(true)
    expect(nemesi.unlocked).toBe(false)
  })
})
