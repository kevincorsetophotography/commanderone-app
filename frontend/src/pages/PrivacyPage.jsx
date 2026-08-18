import { useNavigate } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'
import MarkdownDoc from '../components/MarkdownDoc'
import rawMd from '../../../PRIVACY_POLICY.md?raw'

// Pagina pubblica (raggiungibile anche senza login, vedi App.jsx) — la
// Privacy Policy deve essere visibile a chi valuta l'app prima di registrarsi.
export default function PrivacyPage() {
  const navigate = useNavigate()
  const { t } = useTheme()

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '1.5rem 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ padding: '6px 14px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgMuted, color: t.textSub, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          ← Indietro
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: t.text, margin: 0 }}>Privacy Policy</h1>
      </div>

      <MarkdownDoc content={rawMd} />
    </div>
  )
}
