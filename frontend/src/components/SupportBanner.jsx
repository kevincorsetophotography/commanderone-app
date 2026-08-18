import { useState } from 'react'
import { useTheme } from '../hooks/useTheme'
import { KOFI_URL } from '../lib/links'

const DISMISS_KEY = 'ct_kofi_dismissed_at'
const SNOOZE_DAYS = 30

// true se non è mai stata chiusa, o l'ultima chiusura risale a più di
// SNOOZE_DAYS fa — così chi la ignora una volta non la rivede per un mese,
// invece di essere ribombardato ad ogni visita del Feed.
function shouldShow() {
  const raw = localStorage.getItem(DISMISS_KEY)
  if (!raw) return true
  const dismissedAt = Number(raw)
  if (!Number.isFinite(dismissedAt)) return true
  return Date.now() - dismissedAt > SNOOZE_DAYS * 86400000
}

// Card discreta in cima al Feed (la pagina più vista) — non un banner fisso
// né un popup: si chiude e resta chiusa per un mese, mai più di così.
export default function SupportBanner() {
  const { t } = useTheme()
  const [dismissed, setDismissed] = useState(() => !shouldShow())

  if (dismissed) return null

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setDismissed(true)
  }

  return (
    <div className="ct-fade-up" style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: t.bgSurface, border: `1px solid ${t.border}`, borderRadius: 14,
      padding: '0.85rem 1rem', marginBottom: 16, boxShadow: t.shadow,
    }}>
      <span style={{ fontSize: 22, flexShrink: 0 }}>☕</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>Ti piace CommanderOne?</div>
        <div style={{ fontSize: 12.5, color: t.textSub, marginTop: 1 }}>
          È gratis e lo resta — se vuoi, una donazione libera aiuta a tenerlo vivo.
        </div>
      </div>
      <a href={KOFI_URL} target="_blank" rel="noopener noreferrer" style={{
        flexShrink: 0, padding: '7px 14px', borderRadius: 10, textDecoration: 'none',
        background: t.accent, color: '#1a1206', fontSize: 13, fontWeight: 700,
      }}>
        Sostieni
      </a>
      <button
        onClick={dismiss}
        title="Nascondi per un mese"
        aria-label="Nascondi per un mese"
        style={{
          flexShrink: 0, width: 26, height: 26, borderRadius: 8, border: 'none',
          background: 'transparent', color: t.textMuted, fontSize: 15, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ✕
      </button>
    </div>
  )
}
