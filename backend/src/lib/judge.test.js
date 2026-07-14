import { describe, it, expect } from 'vitest'
import { parseComprehensiveRules, searchInSections, extractKeywords } from './judge.js'

describe('parseComprehensiveRules', () => {
  it('parsa regole numerate semplici', () => {
    const text = '706.1. Some objects become a copy of a spell.\n706.1a. Sub-rule here.'
    const sections = parseComprehensiveRules(text)
    expect(sections).toContainEqual({ id: '706.1', text: '706.1. Some objects become a copy of a spell.' })
    expect(sections).toContainEqual({ id: '706.1a', text: '706.1a. Sub-rule here.' })
  })

  it('ignora righe senza pattern regola', () => {
    const text = 'Magic: The Gathering Comprehensive Rules\n\nEffective 2024\n\n100.1. First rule.'
    const sections = parseComprehensiveRules(text)
    expect(sections).toHaveLength(1)
    expect(sections[0].id).toBe('100.1')
  })

  it('parsa regole con sotto-lettere', () => {
    const text = '603.3b. If a triggered ability has a cost.\n800.4a. If a player leaves the game.'
    const sections = parseComprehensiveRules(text)
    expect(sections.map(s => s.id)).toEqual(['603.3b', '800.4a'])
  })

  it('ritorna array vuoto su testo vuoto', () => {
    expect(parseComprehensiveRules('')).toEqual([])
  })
})

describe('searchInSections', () => {
  const sections = [
    { id: '706.1', text: '706.1. Some objects become or turn into a copy of a spell or permanent.' },
    { id: '706.2', text: '706.2. When copying a spell, copy its characteristics.' },
    { id: '603.1', text: '603.1. Triggered abilities have an intervening if clause.' },
    { id: '100.1', text: '100.1. General rules about the game of Magic.' },
  ]

  it('trova sezioni per keyword singola', () => {
    const results = searchInSections(sections, ['copy'])
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toMatch(/^706/)
  })

  it('ordina per rilevanza (più match = più alto)', () => {
    const results = searchInSections(sections, ['copy', 'spell'])
    expect(results[0].id).toBe('706.1')
  })

  it('rispetta maxResults', () => {
    const results = searchInSections(sections, ['the'], 2)
    expect(results.length).toBeLessThanOrEqual(2)
  })

  it('ritorna vuoto se nessun match', () => {
    expect(searchInSections(sections, ['planeswalker', 'proliferate'])).toEqual([])
  })

  it('ritorna vuoto con sections vuote', () => {
    expect(searchInSections([], ['copy'])).toEqual([])
  })
})

describe('extractKeywords', () => {
  it('rimuove stopwords italiane', () => {
    const kws = extractKeywords('posso neutralizzare questo effetto della carta')
    expect(kws).not.toContain('posso')
    expect(kws).not.toContain('questo')
    expect(kws).not.toContain('della')
    expect(kws).not.toContain('carta')
  })

  it('estrae parole significative', () => {
    const kws = extractKeywords('Come funziona Storm con le copie delle magie')
    expect(kws.some(k => k.includes('storm') || k.includes('funziona'))).toBe(true)
  })

  it('rimuove duplicati', () => {
    const kws = extractKeywords('storm storm storm copy copy')
    expect(kws.filter(k => k === 'storm')).toHaveLength(1)
    expect(kws.filter(k => k === 'copy')).toHaveLength(1)
  })

  it('ignora parole corte', () => {
    const kws = extractKeywords('è un di se')
    expect(kws).toHaveLength(0)
  })
})
