import { useTheme } from '../hooks/useTheme'

export function Skeleton({ w = '100%', h = 14, r = 8, style }) {
  return <div className="ct-skeleton" style={{ width: w, height: h, borderRadius: r, ...style }} />
}

// Card scheletro che ricalca una riga statistica (avatar + testo + valore)
export function SkeletonRow() {
  const { t } = useTheme()
  return (
    <div style={{
      background: t.bgSurface,
      backdropFilter: 'blur(14px) saturate(150%)',
      WebkitBackdropFilter: 'blur(14px) saturate(150%)',
      border: `1px solid ${t.border}`,
      borderRadius: 14,
      padding: '1rem 1.25rem',
      marginBottom: 10,
      boxShadow: t.shadow,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Skeleton w={34} h={34} r="50%" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <Skeleton w={120} h={13} />
            <Skeleton w={80} h={10} />
          </div>
        </div>
        <Skeleton w={48} h={22} r={6} />
      </div>
      <Skeleton w="100%" h={6} r={3} style={{ marginTop: 12 }} />
    </div>
  )
}

export function SkeletonList({ rows = 5 }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => <SkeletonRow key={i} />)}
    </div>
  )
}
