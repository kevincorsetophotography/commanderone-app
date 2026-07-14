import { useAuth } from '../hooks/useAuth'

export default function Dashboard() {
  const { user, logout } = useAuth()

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 500 }}>Commander Tracker</div>
          <div style={{ fontSize: 13, color: '#888' }}>Ciao, {user?.username}</div>
        </div>
        <button
          onClick={logout}
          style={{ padding: '8px 16px', border: '0.5px solid #ccc', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13 }}
        >
          Logout
        </button>
      </div>

      <div style={{ background: '#f5f4f0', borderRadius: 12, padding: '2rem', textAlign: 'center', color: '#888' }}>
        Dashboard in costruzione — backend connesso correttamente!
      </div>
    </div>
  )
}
