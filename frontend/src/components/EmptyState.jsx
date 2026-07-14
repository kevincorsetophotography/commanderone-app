import { useTheme } from '../hooks/useTheme'

export default function EmptyState({ icon = '🎴', title, message, action }) {
  const { t } = useTheme()
  return (
    <div style={{
      background: t.bgSurface,
      backdropFilter: 'blur(14px) saturate(150%)',
      WebkitBackdropFilter: 'blur(14px) saturate(150%)',
      border: `1px dashed ${t.borderStrong}`,
      borderRadius: 16,
      padding: '2.5rem 1.5rem',
      textAlign: 'center',
      boxShadow: t.shadow,
    }}>
      <div style={{ fontSize: 38, marginBottom: 10, opacity: 0.85 }}>{icon}</div>
      {title && <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 6 }}>{title}</div>}
      {message && <div style={{ fontSize: 13.5, color: t.textSub, maxWidth: 360, margin: '0 auto', lineHeight: 1.5 }}>{message}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  )
}
