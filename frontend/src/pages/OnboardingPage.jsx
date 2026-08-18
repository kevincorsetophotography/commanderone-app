import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import GroupJoinCreateForm from '../components/GroupJoinCreateForm'

export default function OnboardingPage() {
  const { logout } = useAuth()
  const { t, dark } = useTheme()
  const { t: tr } = useTranslation()

  return (
    <div style={{ minHeight: '100dvh', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 'clamp(2rem, 10vh, 5rem)', paddingBottom: '2rem', paddingLeft: '1rem', paddingRight: '1rem', boxSizing: 'border-box' }}>
      <div className={`ct-aurora ${dark ? 'dark' : 'light'}`} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', alignItems: 'center' }} className="ct-fade-up">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{tr('onboarding.welcome')}</div>
          <div style={{ fontSize: 13, color: t.textSub }}>
            {tr('onboarding.subtitle')}
          </div>
        </div>

        <div style={{
          background: t.bgSurface,
          backdropFilter: 'blur(18px) saturate(160%)',
          WebkitBackdropFilter: 'blur(18px) saturate(160%)',
          border: `1px solid ${t.border}`,
          borderRadius: 20,
          padding: '1.5rem',
          width: '100%',
          boxSizing: 'border-box',
          color: t.text,
          boxShadow: t.shadow,
        }}>
          <GroupJoinCreateForm />
        </div>

        <div
          onClick={logout}
          style={{ marginTop: 20, fontSize: 13, color: t.textSub, cursor: 'pointer' }}
        >
          {tr('onboarding.logout')}
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
