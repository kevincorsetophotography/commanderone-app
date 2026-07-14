import { ARCHETYPES } from '../lib/archetypes'

export default function ArchetypeBadge({ archetype, size = 'sm' }) {
  if (!archetype || !ARCHETYPES[archetype]) return null
  const color = ARCHETYPES[archetype].color
  const pad = size === 'lg' ? '3px 10px' : '2px 8px'
  const fs = size === 'lg' ? 12 : 10.5
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: pad, borderRadius: 20, fontSize: fs, fontWeight: 700,
      background: color + '22', color, border: `1px solid ${color}55`,
      whiteSpace: 'nowrap',
    }}>
      {archetype}
    </span>
  )
}
