// Cache dei dati carta di Scryfall (immagini + type_line), per non interrogare
// l'API a ogni miniatura e a ogni apertura della lista di un mazzo.
//
// - Le miniature commander (DeckThumb) usano gli URL del CDN cachati.
// - La "lista carte per tipo" (profilo mazzo) e la lista nel pannello usano gli
//   stessi dati cachati (immagine + tipo).
// Tutto è risolto in batch (/cards/collection, 75 per richiesta) e salvato in
// localStorage: dal secondo caricamento, zero chiamate all'API Scryfall.
import { useState, useEffect } from 'react'
import { parseDecklist } from './scryfall'

const BASE = 'https://api.scryfall.com'
const LS_KEY = 'ct_cardcache_v1'

const key = (name) => (name || '').trim().toLowerCase()

// cache: key -> { name, art, normal, typeLine } | { missing: true }
let cache = {}
try { cache = JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { cache = {} }

let saveTimer = null
function persist() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(cache)) } catch { /* quota/private */ }
  }, 400)
}

const imgUris = (card) => {
  const u = card.image_uris || card.card_faces?.[0]?.image_uris || {}
  return {
    name: card.name,
    art: u.art_crop || u.normal,
    normal: u.normal || u.large || u.art_crop,
    typeLine: card.type_line || card.card_faces?.[0]?.type_line || '',
  }
}

// Scarica e mette in cache i dati per i nomi (chiavi) indicati. Awaitable.
async function fetchAndCache(keys) {
  for (let i = 0; i < keys.length; i += 75) {
    const chunk = keys.slice(i, i + 75)
    try {
      const res = await fetch(`${BASE}/cards/collection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiers: chunk.map(n => ({ name: n })) }),
      })
      if (!res.ok) continue // rate limit/errore: si riproverà
      const data = await res.json()
      for (const card of data.data || []) {
        const k = key(card.name)
        cache[k] = imgUris(card)
        notify(k)
      }
      for (const k of chunk) {
        if (!(k in cache)) { cache[k] = { missing: true }; notify(k) }
      }
      persist()
    } catch { /* rete giù: non segnare, si riprova */ }
  }
}

// ── stato per le miniature (DeckThumb) ──
export function lookupArt(name) {
  const c = cache[key(name)]
  if (!c) return { status: 'loading' }
  if (c.missing) return { status: 'missing' }
  return { status: 'ready', art: c.art, normal: c.normal }
}

// batching per le miniature: tante DeckThumb montano insieme → una richiesta sola
const queue = new Set()
const subs = new Map()
let flushTimer = null

function subscribe(name, cb) {
  const k = key(name)
  if (!subs.has(k)) subs.set(k, new Set())
  subs.get(k).add(cb)
  return () => { const s = subs.get(k); if (s) { s.delete(cb); if (!s.size) subs.delete(k) } }
}
const notify = (k) => subs.get(k)?.forEach(cb => cb())

function requestArt(name) {
  const k = key(name)
  if (!k || k in cache) return
  queue.add(k)
  if (!flushTimer) flushTimer = setTimeout(async () => {
    flushTimer = null
    const keys = [...queue].filter(k => !(k in cache))
    queue.clear()
    if (keys.length) await fetchAndCache(keys)
  }, 60)
}

export function useCardArt(name) {
  const [state, setState] = useState(() => lookupArt(name))
  useEffect(() => {
    if (!name) { setState({ status: 'missing' }); return }
    const cur = lookupArt(name)
    setState(cur)
    if (cur.status === 'loading') {
      requestArt(name)
      const unsub = subscribe(name, () => setState(lookupArt(name)))
      return unsub
    }
  }, [name])
  return state
}

// ── lista carte per tipo (profilo mazzo / pannello) ──
// Stessa forma di scryfall.fetchTypedDecklist: [{ name, count, imageUri, typeLine }]
export async function resolveDecklistCards(text) {
  const { entries } = parseDecklist(text)
  const countByKey = {}
  for (const { count, name } of entries) {
    const k = key(name)
    countByKey[k] = (countByKey[k] || 0) + count
  }
  const keys = Object.keys(countByKey)
  const uncached = keys.filter(k => !(k in cache))
  if (uncached.length) await fetchAndCache(uncached)

  const out = []
  for (const k of keys) {
    const c = cache[k]
    if (!c || c.missing) continue
    out.push({ name: c.name || k, count: countByKey[k], imageUri: c.normal, typeLine: c.typeLine || '' })
  }
  return out
}
