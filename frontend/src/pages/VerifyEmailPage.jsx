import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { useTheme } from '../hooks/useTheme'
import { translateApiError } from '../lib/apiError'

// Pagina pubblica raggiunta dal link nell'email di verifica (?token=...).
export default function VerifyEmailPage() {
  const { t, dark } = useTheme()
  const { t: tr } = useTranslation()
  const [params] = useSearchParams()
  const token = params.get('token')
  const [state, setState] = useState('working') // working | ok | error
  const [error, setError] = useState('')
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return // StrictMode monta due volte: il token è monouso
    ran.current = true
    if (!token) { setState('error'); setError(tr('auth.verify.missingToken')); return }
    api.verifyEmail(token)
      .then(() => setState('ok'))
      .catch(err => { setState('error'); setError(translateApiError(err, tr)) })
  }, [token])

  return (
    <div style={{ minHeight: '100dvh', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 'clamp(2rem, 15vh, 7rem)', paddingLeft: '1rem', paddingRight: '1rem', boxSizing: 'border-box' }}>
      <div className={`ct-aurora ${dark ? 'dark' : 'light'}`} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 380 }} className="ct-fade-up">
        <div style={{
          background: t.bgSurface, border: `1px solid ${t.border}`, borderRadius: 20,
          padding: '2rem', color: t.text, boxShadow: t.shadow, textAlign: 'center', boxSizing: 'border-box',
        }}>
          {state === 'working' && <div style={{ fontSize: 15, color: t.textSub }}>{tr('auth.verify.working')}</div>}
          {state === 'ok' && (
            <>
              <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{tr('auth.verify.successTitle')}</div>
              <div style={{ fontSize: 13, color: t.textSub, marginBottom: 20 }}>{tr('auth.verify.successBody')}</div>
              <Link to="/" style={{ display: 'inline-block', padding: '10px 22px', background: t.primary, color: t.primaryFg, borderRadius: 12, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
                {tr('auth.verify.goToApp')}
              </Link>
            </>
          )}
          {state === 'error' && (
            <>
              <div style={{ fontSize: 40, marginBottom: 10 }}>⚠️</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{tr('auth.verify.errorTitle')}</div>
              <div style={{ fontSize: 13, color: t.textSub, marginBottom: 20 }}>{error}</div>
              <Link to="/account" style={{ color: t.primary, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                {tr('auth.verify.retryLink')}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
