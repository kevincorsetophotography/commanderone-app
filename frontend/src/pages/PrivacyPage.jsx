import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../hooks/useTheme'
import MarkdownDoc from '../components/MarkdownDoc'
import rawMdIt from '../../../PRIVACY_POLICY.md?raw'
import rawMdEn from '../../../PRIVACY_POLICY.en.md?raw'

// Pagina pubblica (raggiungibile anche senza login, vedi App.jsx) — la
// Privacy Policy deve essere visibile a chi valuta l'app prima di registrarsi.
// Contenuto (non solo la UI attorno) tradotto: due file .md paralleli,
// selezionati in base alla lingua attiva — vedi TermsPage/GuidaPage per lo
// stesso pattern.
export default function PrivacyPage() {
  const navigate = useNavigate()
  const { t } = useTheme()
  const { t: tr, i18n } = useTranslation()
  const rawMd = i18n.language === 'en' ? rawMdEn : rawMdIt

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '1.5rem 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ padding: '6px 14px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgMuted, color: t.textSub, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          {tr('common.back')}
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: t.text, margin: 0 }}>{tr('auth.register.privacyLink')}</h1>
      </div>

      <MarkdownDoc content={rawMd} />
    </div>
  )
}
