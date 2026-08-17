import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'

// Pagina pubblica raggiunta dal link nell'email di verifica (?token=...).
export default function VerifyEmailPage() {
  const { t, dark } = useTheme()
  const [params] = useSearchParams()
  const token = params.get('token')
  const [state, setState] = useState('working') // working | ok | error
  const [error, setError] = useState('')
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return // StrictMode monta due volte: il token è monouso
    ran.current = true
    if (!token) { setState('error'); setError('Link incompleto: manca il token.'); return }
    api.verifyEmail(token)
      .then(() => setState('ok'))
      .catch(err => { setState('error'); setError(err.error || 'Errore di connessione') })
  }, [token])

  return (
    <div style={{ minHeight: '100dvh', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 'clamp(2rem, 15vh, 7rem)', paddingLeft: '1rem', paddingRight: '1rem', boxSizing: 'border-box' }}>
      <div className={`ct-aurora ${dark ? 'dark' : 'light'}`} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 380 }} className="ct-fade-up">
        <div style={{
          background: t.bgSurface, border: `1px solid ${t.border}`, borderRadius: 20,
          padding: '2rem', color: t.text, boxShadow: t.shadow, textAlign: 'center', boxSizing: 'border-box',
        }}>
          {state === 'working' && <div style={{ fontSize: 15, color: t.textSub }}>Verifica in corso…</div>}
          {state === 'ok' && (
            <>
              <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Email verificata!</div>
              <div style={{ fontSize: 13, color: t.textSub, marginBottom: 20 }}>Il tuo indirizzo è confermato. Ora puoi usare il recupero password se ti servirà.</div>
              <Link to="/" style={{ display: 'inline-block', padding: '10px 22px', background: t.primary, color: t.primaryFg, borderRadius: 12, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
                Vai all'app
              </Link>
            </>
          )}
          {state === 'error' && (
            <>
              <div style={{ fontSize: 40, marginBottom: 10 }}>⚠️</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Verifica non riuscita</div>
              <div style={{ fontSize: 13, color: t.textSub, marginBottom: 20 }}>{error}</div>
              <Link to="/account" style={{ color: t.primary, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                Richiedi una nuova email di verifica dalla pagina Account →
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
