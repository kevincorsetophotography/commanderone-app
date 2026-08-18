import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Trans, useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { translateApiError } from '../lib/apiError'

export default function Login() {
  const { login, register } = useAuth()
  const { t, dark } = useTheme()
  const { t: tr } = useTranslation()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [focusField, setFocusField] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') await login(username, password)
      else await register(username, email, password)
      navigate('/')
    } catch (err) {
      setError(translateApiError(err, tr))
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = (field) => ({
    width: '100%', padding: '12px 14px', borderRadius: 12,
    border: `1px solid ${focusField === field ? t.primaryBorder : t.border}`,
    fontSize: 14, boxSizing: 'border-box',
    background: t.inputBg, color: t.text, outline: 'none',
    boxShadow: focusField === field ? t.glow : 'none',
    transition: 'all 0.18s ease',
  })

  return (
    <div style={{ minHeight: '100dvh', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 'clamp(2rem, 10vh, 5rem)', paddingBottom: '2rem', paddingLeft: '1rem', paddingRight: '1rem', boxSizing: 'border-box' }}>
      {/* Sfondo aurora */}
      <div className={`ct-aurora ${dark ? 'dark' : 'light'}`} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', alignItems: 'center' }} className="ct-fade-up">

        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginBottom: 30 }}>
          <img
            src="/icon-192.png"
            alt=""
            onError={e => { e.currentTarget.style.display = 'none' }}
            style={{ height: 72, width: 72, objectFit: 'contain', borderRadius: 18, filter: dark ? `drop-shadow(0 0 22px ${t.primaryBorder})` : 'drop-shadow(0 6px 18px rgba(37,99,235,0.25))' }}
          />
          <div style={{ textAlign: 'center', lineHeight: 1.2 }}>
            <div style={{ fontWeight: 800, fontSize: 26 }}>
              <span style={{ color: t.text }}>Commander</span>
              <span className={`ct-wordmark ${dark ? 'dark' : 'light'}`}>One</span>
            </div>
            <div style={{ fontSize: 12, color: t.textMuted, letterSpacing: '0.18em', fontWeight: 600, marginTop: 4 }}>{tr('auth.tagline')}</div>
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: t.bgSurface,
          backdropFilter: 'blur(18px) saturate(160%)',
          WebkitBackdropFilter: 'blur(18px) saturate(160%)',
          border: `1px solid ${t.border}`,
          borderRadius: 20,
          padding: '2rem',
          width: '100%',
          boxSizing: 'border-box',
          color: t.text,
          boxShadow: t.shadow,
        }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
              {mode === 'login' ? tr('auth.login.title') : tr('auth.register.title')}
            </div>
            <div style={{ fontSize: 13, color: t.textSub }}>
              {mode === 'login' ? tr('auth.login.subtitle') : tr('auth.register.subtitle')}
            </div>
          </div>

          <form onSubmit={submit}>
            <div style={{ marginBottom: 12 }}>
              <input
                type="text" placeholder={mode === 'login' ? tr('auth.login.usernameOrEmail') : tr('auth.register.username')} value={username}
                onChange={e => setUsername(e.target.value)} required
                autoComplete="username"
                onFocus={() => setFocusField('user')} onBlur={() => setFocusField('')}
                style={inputStyle('user')}
              />
            </div>
            {mode === 'register' && (
              <div style={{ marginBottom: 12 }}>
                <input
                  type="email" placeholder={tr('auth.register.email')} value={email}
                  onChange={e => setEmail(e.target.value)} required
                  autoComplete="email"
                  onFocus={() => setFocusField('email')} onBlur={() => setFocusField('')}
                  style={inputStyle('email')}
                />
              </div>
            )}
            <div style={{ marginBottom: mode === 'login' ? 8 : 18 }}>
              <input
                type="password" placeholder={mode === 'login' ? tr('auth.login.password') : tr('auth.register.password')} value={password}
                onChange={e => setPassword(e.target.value)} required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                onFocus={() => setFocusField('pass')} onBlur={() => setFocusField('')}
                style={inputStyle('pass')}
              />
            </div>
            {mode === 'login' && (
              <div style={{ marginBottom: 14, textAlign: 'right' }}>
                <Link to="/reset-password" style={{ fontSize: 12, color: t.textSub, textDecoration: 'none' }}>
                  {tr('auth.login.forgotPassword')}
                </Link>
              </div>
            )}
            {error && <div style={{ color: t.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '12px', background: t.primary, color: t.primaryFg,
                border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer',
                boxShadow: t.glow, transition: 'all 0.18s ease', opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? '...' : mode === 'login' ? tr('auth.login.submit') : tr('auth.register.submit')}
            </button>
          </form>

          {mode === 'register' && (
            <div style={{ marginTop: 12, textAlign: 'center', fontSize: 11, color: t.textMuted, lineHeight: 1.5 }}>
              <Trans
                i18nKey="auth.register.termsNotice"
                components={{
                  terms: <Link to="/termini" style={{ color: t.textSub }} />,
                  privacy: <Link to="/privacy" style={{ color: t.textSub }} />,
                }}
              />
            </div>
          )}

          <div style={{ marginTop: 18, textAlign: 'center', fontSize: 13, color: t.textSub }}>
            {mode === 'login' ? tr('auth.login.noAccount') : tr('auth.register.hasAccount')}{' '}
            <span
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
              style={{ color: t.primary, cursor: 'pointer', fontWeight: 600 }}
            >
              {mode === 'login' ? tr('auth.login.switchToRegister') : tr('auth.register.switchToLogin')}
            </span>
          </div>
        </div>

        <div style={{ marginTop: 22, fontSize: 10, color: t.textMuted, textAlign: 'center', lineHeight: 1.5, maxWidth: 320 }}>
          {tr('auth.fanContentDisclaimer')}
          <br />
          <Link to="/privacy" style={{ color: t.textMuted }}>{tr('auth.register.privacyLink')}</Link> · <Link to="/termini" style={{ color: t.textMuted }}>{tr('auth.register.termsLink')}</Link>
        </div>
      </div>
    </div>
  )
}
