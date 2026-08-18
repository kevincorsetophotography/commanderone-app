import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../hooks/useTheme'
import MarkdownDoc from '../components/MarkdownDoc'
import rawMdIt from '../../../GUIDA_UTENTE.md?raw'
import rawMdEn from '../../../GUIDA_UTENTE.en.md?raw'

// Stesso pattern di selezione file .md per lingua di PrivacyPage/TermsPage.
export default function GuidaPage() {
  const navigate = useNavigate()
  const { t } = useTheme()
  const { t: tr, i18n } = useTranslation()
  const rawMd = i18n.language === 'en' ? rawMdEn : rawMdIt

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ padding: '6px 14px', borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgMuted, color: t.textSub, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          {tr('common.back')}
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: t.text, margin: 0 }}>{tr('docsPages.guideTitle')}</h1>
      </div>

      <MarkdownDoc content={rawMd} />
    </div>
  )
}
