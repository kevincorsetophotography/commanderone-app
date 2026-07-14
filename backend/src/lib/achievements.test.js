import { describe, it, expect } from 'vitest'
import { unlockedForUser, ACHIEVEMENT_META } from './achievements.js'

const PID = 1
const me = (p = {}) => ({ user: { id: PID }, isWinner: false, placement: null, eliminatedById: null, deck: { colors: 'R' }, ...p })
const opp = (id, p = {}) => ({ user: { id }, isWinner: false, placement: null, eliminatedById: null, deck: { colors: 'G' }, ...p })
const game = (players, playedAt = '2026-05-15') => ({ playedAt, players })
const data = (games, decksByUser = new Map()) => ({ games, decksByUser })

describe('unlockedForUser (logica achievement lato server)', () => {
  it('prima vittoria + esordiente', () => {
    const games = [game([me({ isWinner: true, placement: 1 }), opp(2, { placement: 2 }), opp(3, { placement: 3 })])]
    const ids = unlockedForUser(data(games), PID)
    expect(ids).toContain('first_win')
    expect(ids).toContain('rookie')
  })

  it('nemesi (segreto): stessa vittima 5 volte', () => {
    const games = Array.from({ length: 5 }, (_, i) => game([me({ isWinner: true }), opp(2, { eliminatedById: PID })], `2026-05-1${i}`))
    expect(unlockedForUser(data(games), PID)).toContain('nemesis5')
  })

  it('cinque colori dai mazzi posseduti (senza partite)', () => {
    const decksByUser = new Map([[PID, [{ colors: 'WUBRG' }]]])
    expect(unlockedForUser(data([], decksByUser), PID)).toContain('fivecolor_deck')
  })

  it('ultimo in piedi (segreto): vinci con tutti gli altri eliminati', () => {
    const games = [game([me({ isWinner: true }), opp(2, { eliminatedById: PID }), opp(3, { eliminatedById: 2 })])]
    expect(unlockedForUser(data(games), PID)).toContain('last_one_standing')
  })

  it('ogni id sbloccato ha i metadati per la notifica', () => {
    const games = [game([me({ isWinner: true, placement: 1 }), opp(2, { placement: 2 })])]
    const ids = unlockedForUser(data(games), PID)
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) expect(ACHIEVEMENT_META[id]).toBeDefined()
  })

  it('campione di stagione: solo per stagioni concluse, non per quella in corso', () => {
    const endedDate = (i) => { const d = new Date(); d.setMonth(d.getMonth() - 6); d.setDate(5 + i); return d.toISOString().slice(0, 10) }
    const today = new Date().toISOString().slice(0, 10)
    const mk = (dateFn) => Array.from({ length: 5 }, (_, i) =>
      game([me({ isWinner: true, placement: 1 }), opp(2, { placement: 2 })], typeof dateFn === 'function' ? dateFn(i) : dateFn))
    expect(unlockedForUser(data(mk(endedDate)), PID)).toContain('season_champion')
    expect(unlockedForUser(data(mk(today)), PID)).not.toContain('season_champion')
  })
})
