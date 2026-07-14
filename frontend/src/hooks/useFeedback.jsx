import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { useTheme } from './useTheme'

const FeedbackCtx = createContext(null)

let idSeq = 0

export function FeedbackProvider({ children }) {
  const { t } = useTheme()
  const [toasts, setToasts] = useState([])
  const [confirmState, setConfirmState] = useState(null)
  const resolveRef = useRef(null)

  const dismiss = useCallback((id) => {
    setToasts(list => list.filter(x => x.id !== id))
  }, [])

  const toast = useCallback((message, type = 'info') => {
    const id = ++idSeq
    setToasts(list => [...list, { id, message, type }])
    setTimeout(() => dismiss(id), 3800)
  }, [dismiss])

  const confirm = useCallback((opts) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve
      setConfirmState(typeof opts === 'string' ? { message: opts } : opts)
    })
  }, [])

  const closeConfirm = (result) => {
    setConfirmState(null)
    if (resolveRef.current) { resolveRef.current(result); resolveRef.current = null }
  }

  const toneColor = (type) =>
    type === 'success' ? t.win : type === 'error' ? t.danger : t.primary

  return (
    <FeedbackCtx.Provider value={{ toast, confirm }}>
      {children}

      {/* Toasts */}
      <div style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 'min(360px, calc(100vw - 40px))',
      }}>
        {toasts.map(toastItem => (
          <div
            key={toastItem.id}
            onClick={() => dismiss(toastItem.id)}
            className="ct-fade-up"
            style={{
              background: t.bgSurface,
              backdropFilter: 'blur(16px) saturate(160%)',
              WebkitBackdropFilter: 'blur(16px) saturate(160%)',
              border: `1px solid ${t.border}`,
              borderLeft: `3px solid ${toneColor(toastItem.type)}`,
              borderRadius: 12,
              padding: '12px 16px',
              boxShadow: t.shadow,
              color: t.text,
              fontSize: 13.5,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 10,
            }}
          >
            <span style={{ color: toneColor(toastItem.type), fontWeight: 700, fontSize: 15 }}>
              {toastItem.type === 'success' ? '✓' : toastItem.type === 'error' ? '✕' : 'ℹ'}
            </span>
            <span>{toastItem.message}</span>
          </div>
        ))}
      </div>

      {/* Confirm dialog */}
      {confirmState && (
        <div
          onMouseDown={() => closeConfirm(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
          }}
        >
          <div
            onMouseDown={e => e.stopPropagation()}
            className="ct-fade-up"
            style={{
              background: t.bgSurface,
              backdropFilter: 'blur(18px) saturate(160%)',
              WebkitBackdropFilter: 'blur(18px) saturate(160%)',
              border: `1px solid ${t.border}`,
              borderRadius: 18,
              padding: '1.6rem',
              width: '100%', maxWidth: 380,
              boxShadow: t.shadow,
              color: t.text,
            }}
          >
            {confirmState.title && (
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{confirmState.title}</div>
            )}
            <div style={{ fontSize: 14, color: t.textSub, lineHeight: 1.5, marginBottom: 22 }}>
              {confirmState.message}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => closeConfirm(false)}
                style={{
                  padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  background: t.bgMuted, color: t.textSub, border: `1px solid ${t.border}`,
                }}
              >
                {confirmState.cancelLabel || 'Annulla'}
              </button>
              <button
                onClick={() => closeConfirm(true)}
                style={{
                  padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  border: 'none',
                  background: confirmState.danger ? t.danger : t.primary,
                  color: confirmState.danger ? '#fff' : t.primaryFg,
                  boxShadow: confirmState.danger ? 'none' : t.glow,
                }}
              >
                {confirmState.confirmLabel || 'Conferma'}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackCtx.Provider>
  )
}

export function useFeedback() {
  return useContext(FeedbackCtx)
}
