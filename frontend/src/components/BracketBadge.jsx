import { BRACKETS } from '../lib/brackets'

export default function BracketBadge({ bracket, size = 'sm' }) {
  if (!bracket || !BRACKETS[bracket]) return null
  const b = BRACKETS[bracket]
  const pad = size === 'lg' ? '3px 10px' : '2px 8px'
  const fs = size === 'lg' ? 12 : 10.5
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: pad, borderRadius: 20, fontSize: fs, fontWeight: 700,
      background: b.color + '22', color: b.color, border: `1px solid ${b.color}55`,
      whiteSpace: 'nowrap',
    }}>
      B{bracket} · {b.label}
    </span>
  )
}
