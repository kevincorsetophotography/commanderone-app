const BASE = 'https://api.scryfall.com'

const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G']

// Suggerimenti nomi carta esatti (max 20) — più affidabile della ricerca fuzzy
export async function autocompleteCardName(query) {
  const q = query.trim()
  if (q.length < 2) return []
  try {
    const res = await fetch(`${BASE}/cards/autocomplete?q=${encodeURIComponent(q)}`)
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data.data) ? data.data : []
  } catch {
    return []
  }
}

// Tutte le stampe uniche per arte di una carta (per il picker avatar)
export async function getCardPrintings(name) {
  try {
    const q = `!"${name}"`
    const r = await fetch(`${BASE}/cards/search?q=${encodeURIComponent(q)}&unique=art&order=released`)
    if (!r.ok) return []
    const data = await r.json()
    return (data.data || []).map(card => ({
      id:         card.id,
      setName:    card.set_name,
      setCode:    (card.set || '').toUpperCase(),
      year:       card.released_at?.slice(0, 4) || '',
      artist:     card.artist || '',
      artCropUrl: card.image_uris?.art_crop || card.card_faces?.[0]?.image_uris?.art_crop || null,
    })).filter(c => c.artCropUrl)
  } catch {
    return []
  }
}

export async function fetchCommanderColors(name) {
  try {
    const res = await fetch(`${BASE}/cards/named?fuzzy=${encodeURIComponent(name)}`)
    if (!res.ok) return null
    const card = await res.json()
    const ci = card.color_identity || []
    return ci.sort((a, b) => COLOR_ORDER.indexOf(a) - COLOR_ORDER.indexOf(b))
  } catch {
    return null
  }
}

export async function fetchCommanderCard(name) {
  try {
    const res = await fetch(`${BASE}/cards/named?fuzzy=${encodeURIComponent(name)}`)
    if (!res.ok) return null
    const card = await res.json()
    return {
      name: card.name,
      artUri: card.image_uris?.art_crop || card.card_faces?.[0]?.image_uris?.art_crop,
    }
  } catch {
    return null
  }
}

export function parseDecklist(text) {
  const entries = []
  let totalCount = 0
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const m = line.match(/^(\d+)x?\s+(.+)$/)
    if (!m) continue
    const count = parseInt(m[1], 10)
    const name = m[2].trim()
    totalCount += count
    entries.push({ count, name })
  }
  return { entries, totalCount }
}

async function batchFetch(names) {
  const cards = []
  const notFound = []
  for (let i = 0; i < names.length; i += 75) {
    const chunk = names.slice(i, i + 75)
    const res = await fetch(`${BASE}/cards/collection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiers: chunk.map(name => ({ name })) })
    })
    const data = await res.json()
    if (data.not_found) notFound.push(...data.not_found.map(c => c.name))
    if (data.data) cards.push(...data.data)
  }

  // Fuzzy fallback: handles DFC front-face-only names and alternate/universe-beyond names
  const reallyNotFound = []
  for (const originalName of notFound) {
    try {
      const res = await fetch(`${BASE}/cards/named?fuzzy=${encodeURIComponent(originalName)}`)
      if (res.ok) {
        const card = await res.json()
        cards.push({ ...card, _queryName: originalName })
      } else {
        reallyNotFound.push(originalName)
      }
    } catch {
      reallyNotFound.push(originalName)
    }
  }

  return { cards, notFound: reallyNotFound }
}

function toCardEntry(card, countByName) {
  const lookupName = card._queryName || card.name
  return {
    name: card.name,
    count: countByName[lookupName] || countByName[card.name] || 1,
    imageUri: card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal,
    typeLine: card.type_line || card.card_faces?.[0]?.type_line || ''
  }
}

// Categoria in italiano dal type_line di Scryfall
export function categorizeCard(typeLine) {
  const t = typeLine || ''
  if (/Creature/i.test(t))     return 'Creature'
  if (/Planeswalker/i.test(t)) return 'Planeswalker'
  if (/Instant/i.test(t))      return 'Istantanei'
  if (/Sorcery/i.test(t))      return 'Stregonerie'
  if (/Artifact/i.test(t))     return 'Artefatti'
  if (/Enchantment/i.test(t))  return 'Incantesimi'
  if (/Land/i.test(t))         return 'Terre'
  return 'Altro'
}

// Carte della lista con tipo e immagine (per il profilo mazzo)
export async function fetchTypedDecklist(text) {
  const { entries } = parseDecklist(text)
  const countByName = {}
  for (const { count, name } of entries) countByName[name] = (countByName[name] || 0) + count
  const { cards: rawCards } = await batchFetch(Object.keys(countByName))
  return rawCards.map(card => toCardEntry(card, countByName))
}

export async function validateAndFetchDecklist(text) {
  const { entries, totalCount } = parseDecklist(text)
  const errors = []

  if (totalCount !== 100) {
    errors.push(`Il mazzo ha ${totalCount} carte (richieste 100 per Commander)`)
    return { valid: false, errors, cards: [] }
  }

  const countByName = {}
  for (const { count, name } of entries) {
    countByName[name] = (countByName[name] || 0) + count
  }

  const { cards: rawCards, notFound } = await batchFetch(Object.keys(countByName))

  if (notFound.length > 0) {
    errors.push(`Carte non trovate su Scryfall: ${notFound.join(', ')}`)
  }

  const cards = rawCards.map(card => toCardEntry(card, countByName))
  return { valid: errors.length === 0, errors, cards }
}

export async function fetchDecklistCards(text) {
  const { entries } = parseDecklist(text)
  const countByName = {}
  for (const { count, name } of entries) {
    countByName[name] = (countByName[name] || 0) + count
  }
  const { cards: rawCards } = await batchFetch(Object.keys(countByName))
  return rawCards.map(card => toCardEntry(card, countByName))
}
