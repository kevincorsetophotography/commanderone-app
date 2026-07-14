import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { useIsMobile } from '../hooks/useIsMobile'

const POLL_MS = 60000

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'ora'
  if (m < 60) return `${m}m fa`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h fa`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}g fa`
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
}

export default function NotificationBell() {
  const { t } = useTheme()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const timer = useRef(null)

  const fetchCount = useCallback(async () => {
    try { const { count } = await api.getUnreadCount(); setCount(count) } catch {}
  }, [])

  useEffect(() => {
    fetchCount()
    timer.current = setInterval(fetchCount, POLL_MS)
    return () => clearInterval(timer.current)
  }, [fetchCount])

  const openPanel = async () => {
    setOpen(true)
    setLoading(true)
    try {
      const list = await api.getNotifications()
      setItems(list)
      if (list.some(n => !n.read)) {
        await api.markNotificationsRead()
        setCount(0)
      }
    } catch {} finally { setLoading(false) }
  }

  const toggle = () => { if (open) setOpen(false); else openPanel() }

  const goTo = (n) => {
    setOpen(false)
    if (n.link) navigate(n.link)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={toggle}
        title="Notifiche"
        aria-label={count > 0 ? `Notifiche, ${count} non lette` : 'Notifiche'}
        style={{
          position: 'relative', padding: '6px 12px', borderRadius: 10, cursor: 'pointer',
          border: `1px solid ${t.border}`, background: t.bgSurfaceAlt, color: t.textSub,
          fontSize: 15, lineHeight: 1, transition: 'all 0.18s ease',
        }}
      >
        🔔
        {count > 0 && (
          <span style={{
            position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, padding: '0 4px',
            borderRadius: 9, background: t.danger || '#e8654f', color: '#fff',
            fontSize: 10.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxSizing: 'border-box',
          }}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* backdrop per chiudere al click fuori */}
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />

          <div style={{
            // su mobile la campanella non è l'elemento più a destra: ancoro il
            // pannello al viewport per non farlo uscire dal bordo sinistro.
            ...(isMobile
              ? { position: 'fixed', top: 'calc(env(safe-area-inset-top) + 80px)', right: 10, left: 'auto' }
              : { position: 'absolute', top: 'calc(100% + 8px)', right: 0 }),
            zIndex: 50,
            width: 320, maxWidth: 'calc(100vw - 20px)', maxHeight: '70vh', overflowY: 'auto',
            background: t.bgSurface, border: `1px solid ${t.border}`, borderRadius: 12,
            boxShadow: t.shadow, padding: 4,
          }}>
            <div style={{ padding: '8px 10px', fontSize: 12, fontWeight: 700, color: t.textSub, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Notifiche
            </div>

            {loading && <div style={{ padding: '10px', fontSize: 13, color: t.textSub }}>Caricamento…</div>}

            {!loading && items.length === 0 && (
              <div style={{ padding: '18px 12px', fontSize: 13, color: t.textMuted, textAlign: 'center' }}>
                Nessuna notifica
              </div>
            )}

            {!loading && items.map(n => (
              <div
                key={n.id}
                onClick={() => goTo(n)}
                style={{
                  display: 'flex', gap: 8, padding: '9px 10px', borderRadius: 8, cursor: n.link ? 'pointer' : 'default',
                  background: n.read ? 'transparent' : (t.primaryBg || t.bgMuted),
                  marginBottom: 2,
                }}
              >
                {!n.read && <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.primary, marginTop: 6, flexShrink: 0 }} />}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text, wordBreak: 'break-word' }}>{n.title}</div>
                  {n.body && <div style={{ fontSize: 12, color: t.textSub, marginTop: 2, wordBreak: 'break-word' }}>{n.body}</div>}
                  <div style={{ fontSize: 11, color: t.textMuted, marginTop: 3 }}>{timeAgo(n.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
