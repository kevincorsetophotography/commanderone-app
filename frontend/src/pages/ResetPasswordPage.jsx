import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { translateApiError } from '../lib/apiError'

// Pagina pubblica doppia:
// - senza ?token → chiedi l'email per ricevere il link di reset
// - con ?token   → imposta la nuova password
export default function ResetPasswordPage() {
  const { t, dark } = useTheme()
  const { t: tr } = useTranslation()
  const { adoptSession } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 12,
    border: `1px solid ${t.border}`, fontSize: 14, boxSizing: 'border-box',
    background: t.inputBg, color: t.text, outline: 'none',
  }

  const submitRequest = async (e) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await api.forgotPassword(email)
      setSent(true)
    } catch (err) {
      setError(translateApiError(err, tr))
    } finally {
      setLoading(false)
    }
  }

  const submitReset = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError(tr('auth.reset.mismatch')); return }
    setLoading(true)
    try {
      const res = await api.resetPassword(token, password)
      // Il backend apre direttamente una nuova sessione
      adoptSession(res.token, res.user)
      navigate('/')
    } catch (err) {
      setError(translateApiError(err, tr))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 'clamp(2rem, 12vh, 6rem)', paddingLeft: '1rem', paddingRight: '1rem', boxSizing: 'border-box' }}>
      <div className={`ct-aurora ${dark ? 'dark' : 'light'}`} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 380 }} className="ct-fade-up">
        <div style={{
          background: t.bgSurface, border: `1px solid ${t.border}`, borderRadius: 20,
          padding: '2rem', color: t.text, boxShadow: t.shadow, boxSizing: 'border-box',
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
            {token ? tr('auth.reset.newPasswordTitle') : tr('auth.reset.requestTitle')}
          </div>
          <div style={{ fontSize: 13, color: t.textSub, marginBottom: 20 }}>
            {token ? tr('auth.reset.newPasswordSubtitle') : tr('auth.reset.requestSubtitle')}
          </div>

          {!token && sent ? (
            <div style={{ fontSize: 14, lineHeight: 1.6 }}>
              {tr('auth.reset.sentMessage')}
            </div>
          ) : token ? (
            <form onSubmit={submitReset}>
              <div style={{ marginBottom: 12 }}>
                <input type="password" placeholder={tr('auth.reset.newPasswordPlaceholder')} value={password}
                  onChange={e => setPassword(e.target.value)} required autoComplete="new-password" style={inputStyle} />
              </div>
              <div style={{ marginBottom: 18 }}>
                <input type="password" placeholder={tr('account.password.confirm')} value={confirm}
                  onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" style={inputStyle} />
              </div>
              {error && <div style={{ color: t.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}
              <button type="submit" disabled={loading} style={{
                width: '100%', padding: 12, background: t.primary, color: t.primaryFg, border: 'none',
                borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1,
              }}>
                {loading ? '...' : tr('auth.reset.submitNew')}
              </button>
            </form>
          ) : (
            <form onSubmit={submitRequest}>
              <div style={{ marginBottom: 18 }}>
                <input type="email" placeholder={tr('auth.register.email')} value={email}
                  onChange={e => setEmail(e.target.value)} required autoComplete="email" style={inputStyle} />
              </div>
              {error && <div style={{ color: t.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}
              <button type="submit" disabled={loading} style={{
                width: '100%', padding: 12, background: t.primary, color: t.primaryFg, border: 'none',
                borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1,
              }}>
                {loading ? '...' : tr('auth.reset.submitRequest')}
              </button>
            </form>
          )}

          <div style={{ marginTop: 18, textAlign: 'center', fontSize: 13 }}>
            <Link to="/login" style={{ color: t.primary, textDecoration: 'none', fontWeight: 600 }}>{tr('auth.reset.backToLogin')}</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
