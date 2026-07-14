import { describe, it, expect } from 'vitest'
import { parseDecklist, EXPECTED_TOTAL } from './decklist.js'

describe('parseDecklist', () => {
  it('conta quantità e nomi nel formato "N Nome"', () => {
    const { entries, total } = parseDecklist('1 Sol Ring\n2 Mountain')
    expect(entries).toEqual([{ count: 1, name: 'Sol Ring' }, { count: 2, name: 'Mountain' }])
    expect(total).toBe(3)
  })

  it('accetta anche la forma "Nx Nome"', () => {
    const { entries } = parseDecklist('1x Sol Ring\n3x Forest')
    expect(entries).toEqual([{ count: 1, name: 'Sol Ring' }, { count: 3, name: 'Forest' }])
  })

  it('ignora righe vuote e senza quantità', () => {
    const { entries, total } = parseDecklist('\n   \nSol Ring\n2 Island')
    expect(entries).toEqual([{ count: 2, name: 'Island' }])
    expect(total).toBe(2)
  })

  it('gestisce quantità grandi (basics)', () => {
    expect(parseDecklist('35 Mountain').total).toBe(35)
  })

  it('EXPECTED_TOTAL è 100 (Commander)', () => {
    expect(EXPECTED_TOTAL).toBe(100)
  })
})
