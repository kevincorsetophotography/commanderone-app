import { useState } from 'react'
import { useTheme } from '../hooks/useTheme'
import { useCardArt } from '../lib/cardCache'

// Fallback: endpoint API fuzzy (usato solo per i pochi nomi che il batch non risolve)
const fuzzyArt = (name) =>
  `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}&format=image&version=art_crop`
const fuzzyNormal = (name) =>
  `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}&format=image&version=normal`

/**
 * Miniatura del commander (art_crop di Scryfall) usata ovunque appaia un mazzo.
 * Gli URL immagine sono risolti una volta e cachati (vedi lib/cardArt), così non
 * si interroga l'API Scryfall per ogni singola miniatura.
 * Al passaggio del mouse mostra la carta in grande (disattivabile con preview={false}).
 */
export default function DeckThumb({ commander, w = 56, radius = 8, round = false, preview = true }) {
  const { t } = useTheme()
  const { status, art, normal } = useCardArt(commander)
  const [hover, setHover] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  const h = round ? w : Math.round(w * 0.72)
  const r = round ? '50%' : radius

  const base = {
    width: w, height: h, borderRadius: r, flexShrink: 0,
    objectFit: 'cover', objectPosition: 'center top', display: 'block',
  }

  const fallbackBox = (
    <div style={{
      ...base, background: t.bgMuted, border: `1px solid ${t.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.max(10, w * 0.4),
    }}>🎴</div>
  )

  if (!commander) return fallbackBox
  // In attesa della risoluzione: skeleton (al secondo caricamento è già in cache → niente attesa)
  if (status === 'loading') return <div className="ct-skeleton" style={{ ...base }} />

  const artSrc = status === 'ready' ? art : fuzzyArt(commander)
  const normalSrc = status === 'ready' ? normal : fuzzyNormal(commander)

  // Anteprima fluttuante posizionata vicino al cursore, contenuta nel viewport
  const PREV_W = 240, PREV_H = 335
  const px = Math.min(pos.x + 16, (typeof window !== 'undefined' ? window.innerWidth : 9999) - PREV_W - 12)
  const py = Math.min(Math.max(12, pos.y - PREV_H / 2), (typeof window !== 'undefined' ? window.innerHeight : 9999) - PREV_H - 12)

  return (
    <>
      <img
        src={artSrc}
        alt=""
        title={commander}
        loading="lazy"
        onError={e => {
          e.currentTarget.onerror = null
          e.currentTarget.replaceWith(Object.assign(document.createElement('div'), {
            style: `width:${w}px;height:${h}px;border-radius:${typeof r === 'string' ? r : r + 'px'};background:${t.bgMuted};display:flex;align-items:center;justify-content:center;font-size:${Math.max(10, w * 0.4)}px;flex-shrink:0`,
            textContent: '🎴',
          }))
        }}
        onMouseEnter={preview ? (e) => { setHover(true); setPos({ x: e.clientX, y: e.clientY }) } : undefined}
        onMouseMove={preview ? (e) => setPos({ x: e.clientX, y: e.clientY }) : undefined}
        onMouseLeave={preview ? () => setHover(false) : undefined}
        style={{ ...base, cursor: preview ? 'zoom-in' : 'default' }}
      />
      {preview && hover && (
        <div style={{
          position: 'fixed', left: px, top: py, zIndex: 9998, pointerEvents: 'none',
          width: PREV_W, borderRadius: 14, overflow: 'hidden',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        }}>
          <img src={normalSrc} alt={commander} style={{ width: '100%', display: 'block' }} />
        </div>
      )}
    </>
  )
}
