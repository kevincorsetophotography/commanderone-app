import { describe, it, expect } from 'vitest'
import { seasonOf, listSeasons, computeStandings } from './seasons'

const player = (id, { winner = false, placement = null } = {}) =>
  ({ user: { id, username: 'P' + id }, isWinner: winner, placement })

describe('seasonOf', () => {
  it('mappa i mesi a blocchi di 4 (Gen–Apr, Mag–Ago, Set–Dic)', () => {
    expect(seasonOf('2026-01-15').key).toBe('2026-0')
    expect(seasonOf('2026-04-30').key).toBe('2026-0')
    expect(seasonOf('2026-05-01').key).toBe('2026-1')
    expect(seasonOf('2026-08-31').key).toBe('2026-1')
    expect(seasonOf('2026-09-01').key).toBe('2026-2')
    expect(seasonOf('2026-12-31').key).toBe('2026-2')
  })
})

describe('listSeasons', () => {
  it('elenca le stagioni presenti dalla più recente', () => {
    const games = [{ playedAt: '2026-01-10', players: [] }, { playedAt: '2026-06-10', players: [] }]
    expect(listSeasons(games).map(s => s.key)).toEqual(['2026-1', '2026-0'])
  })
})

describe('computeStandings', () => {
  it('assegna presenza + podio (3/2/1) e ordina per punti', () => {
    const games = [
      { playedAt: '2026-05-10', players: [player(1, { winner: true, placement: 1 }), player(2, { placement: 2 }), player(3, { placement: 3 })] },
      { playedAt: '2026-06-10', players: [player(1, { winner: true, placement: 1 }), player(2, { placement: 2 }), player(3, { placement: 3 })] },
    ]
    const { standings, total, champion } = computeStandings(games, '2026-1')
    expect(total).toBe(2)
    // P1: 2*(1+3)=8, P2: 2*(1+2)=6, P3: 2*(1+1)=4
    expect(standings.map(s => [s.id, s.points])).toEqual([[1, 8], [2, 6], [3, 4]])
    expect(champion.id).toBe(1)
  })

  it('senza piazzamenti dà il bonus podio solo al vincitore', () => {
    const games = [{ playedAt: '2026-05-10', players: [player(1, { winner: true }), player(2), player(3)] }]
    const byId = Object.fromEntries(computeStandings(games, '2026-1').standings.map(s => [s.id, s.points]))
    expect(byId[1]).toBe(4) // 1 presenza + 3 vittoria
    expect(byId[2]).toBe(1)
    expect(byId[3]).toBe(1)
  })

  it('qualifica al titolo solo chi gioca ≥ 30% delle partite', () => {
    const games = []
    for (let i = 0; i < 10; i++) {
      games.push({ playedAt: '2026-05-10', players: [player(1, { winner: true, placement: 1 }), player(2, { placement: 2 }), player(3, { placement: 3 })] })
    }
    games[0].players.push(player(4, { placement: 4 }))
    games[1].players.push(player(4, { placement: 4 }))
    const { standings, threshold } = computeStandings(games, '2026-1')
    expect(threshold).toBe(3) // ceil(10 * 0.3)
    expect(standings.find(s => s.id === 4).qualified).toBe(false) // 2 partite
    expect(standings.find(s => s.id === 1).qualified).toBe(true)  // 10 partite
  })

  it('il campione è il primo qualificato (salta i non qualificati in testa)', () => {
    const games = []
    // P1 gioca tutte e vince; P9 gioca una sola partita ma fa tanti punti? no: con 1 partita non si qualifica
    for (let i = 0; i < 5; i++) {
      games.push({ playedAt: '2026-05-10', players: [player(1, { winner: true, placement: 1 }), player(2, { placement: 2 })] })
    }
    games[0].players.push(player(9, { winner: false, placement: 3 }))
    const { champion } = computeStandings(games, '2026-1')
    expect(champion.id).toBe(1)
  })
})
