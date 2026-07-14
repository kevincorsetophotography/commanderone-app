import { describe, it, expect } from 'vitest'
import { podSizes, makePods, makePairings, standings1v1, swissPairings } from './tournament.js'

describe('podSizes (3-5, preferendo 4)', () => {
  it('casi noti', () => {
    expect(podSizes(3)).toEqual([3])
    expect(podSizes(4)).toEqual([4])
    expect(podSizes(5)).toEqual([5])
    expect(podSizes(6)).toEqual([3, 3])
    expect(podSizes(7)).toEqual([4, 3])
    expect(podSizes(8)).toEqual([4, 4])
    expect(podSizes(9)).toEqual([4, 5])
    expect(podSizes(10)).toEqual([4, 3, 3])
    expect(podSizes(11)).toEqual([4, 4, 3])
    expect(podSizes(12)).toEqual([4, 4, 4])
    expect(podSizes(13)).toEqual([4, 4, 5])
  })

  it('meno di 3 giocatori: nessun pod', () => {
    expect(podSizes(0)).toEqual([])
    expect(podSizes(1)).toEqual([])
    expect(podSizes(2)).toEqual([])
  })

  it('per ogni n da 3 a 40: tutti i pod tra 3 e 5 e somma = n', () => {
    for (let n = 3; n <= 40; n++) {
      const sizes = podSizes(n)
      expect(sizes.reduce((a, b) => a + b, 0)).toBe(n)
      for (const s of sizes) expect(s >= 3 && s <= 5).toBe(true)
    }
  })
})

describe('makePods', () => {
  it('usa tutti i giocatori una sola volta, con pod validi', () => {
    const ids = Array.from({ length: 11 }, (_, i) => i + 1)
    const pods = makePods(ids)
    expect(pods.map(p => p.length).sort()).toEqual([3, 4, 4])
    expect(pods.flat().sort((a, b) => a - b)).toEqual(ids)
  })
})

describe('makePairings (turno 1)', () => {
  it('pari: tutti accoppiati, nessun bye', () => {
    const { pairs, bye } = makePairings([1, 2, 3, 4])
    expect(bye).toBeNull()
    expect(pairs.length).toBe(2)
    expect(pairs.flat().sort((a, b) => a - b)).toEqual([1, 2, 3, 4])
  })

  it('dispari: un bye, gli altri accoppiati', () => {
    const { pairs, bye } = makePairings([1, 2, 3, 4, 5])
    expect(bye).not.toBeNull()
    expect(pairs.length).toBe(2)
    const used = [...pairs.flat(), bye].sort((a, b) => a - b)
    expect(used).toEqual([1, 2, 3, 4, 5])
  })
})

const tbl = (a, b, { winner, draw = false, sa = 0, sb = 0 } = {}) =>
  ({ done: true, isDraw: draw, winnerUserId: winner ?? null, scoreA: sa, scoreB: sb,
     seats: [{ userId: a, seat: 0 }, { userId: b, seat: 1 }] })
const byeTbl = (a) => ({ done: true, seats: [{ userId: a, seat: 0 }] })

describe('standings1v1', () => {
  it('assegna punti (vittoria 3, pareggio 1, bye 3) e registra gli avversari', () => {
    const rounds = [{ tables: [
      tbl(1, 2, { winner: 1, sa: 2, sb: 1 }),
      tbl(3, 4, { draw: true, sa: 1, sb: 1 }),
      byeTbl(5),
    ] }]
    const s = Object.fromEntries(standings1v1(rounds, [1, 2, 3, 4, 5]).map(p => [p.userId, p]))
    expect(s[1].points).toBe(3); expect(s[1].wins).toBe(1); expect(s[1].opponents).toEqual([2])
    expect(s[2].points).toBe(0); expect(s[2].losses).toBe(1)
    expect(s[3].points).toBe(1); expect(s[3].draws).toBe(1)
    expect(s[5].points).toBe(3); expect(s[5].byes).toBe(1)
  })

  it('ignora i tavoli non conclusi', () => {
    const rounds = [{ tables: [{ ...tbl(1, 2, { winner: 1 }), done: false }] }]
    const s = standings1v1(rounds, [1, 2])
    expect(s.every(p => p.points === 0)).toBe(true)
  })
})

describe('swissPairings', () => {
  it('evita i re-match e dà il bye a chi non l\'ha avuto', () => {
    // dopo turno 1: 1 ha battuto 2, 3 ha battuto 4, 5 bye
    const standings = standings1v1([{ tables: [
      tbl(1, 2, { winner: 1 }), tbl(3, 4, { winner: 3 }), byeTbl(5),
    ] }], [1, 2, 3, 4, 5])
    const { pairs, bye } = swissPairings(standings)
    // 5 dispari -> un bye, a qualcuno che non l'ha già avuto (non il 5)
    expect(bye).not.toBe(5)
    // nessun re-match (1-2 e 3-4 non si ripetono)
    const isRematch = pairs.some(([a, b]) => (a === 1 && b === 2) || (a === 2 && b === 1) || (a === 3 && b === 4) || (a === 4 && b === 3))
    expect(isRematch).toBe(false)
    // tutti i 4 in gioco sono accoppiati
    expect(pairs.flat().length).toBe(4)
  })
})
