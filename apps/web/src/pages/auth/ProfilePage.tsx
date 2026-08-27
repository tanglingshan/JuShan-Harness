import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { UserProfile } from '../../components/auth/UserProfile'

export function ProfilePage() {
  const navigate = useNavigate()
  const { user, logout, isAuthenticated } = useAuth()

  if (!isAuthenticated || !user) {
    navigate('/login')
    return null
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F7F4EF',
      padding: '24px',
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '48px',
          padding: '24px 0',
          borderBottom: '1px solid #E7E1D7',
        }}>
          <h1 style={{
            margin: 0,
            fontSize: '28px',
            fontWeight: 400,
            fontFamily: 'Fraunces, serif',
            color: '#1F2421',
            letterSpacing: '-0.02em',
          }}>
            My <span style={{ fontStyle: 'italic', color: '#C4612F' }}>Profile</span>
          </h1>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => navigate('/users')}
              style={{
                padding: '10px 24px',
                fontSize: '14px',
                fontWeight: 400,
                color: '#1F2421',
                background: '#FFFFFF',
                border: '1px solid #E7E1D7',
                borderRadius: '999px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#FBF9F5'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#FFFFFF'
              }}
            >
              View all users
            </button>

            <button
              onClick={handleLogout}
              style={{
                padding: '10px 24px',
                fontSize: '14px',
                fontWeight: 400,
                color: '#FFFFFF',
                background: '#C4612F',
                border: 'none',
                borderRadius: '999px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#A94E22'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#C4612F'
              }}
            >
              Sign out
            </button>
          </div>
        </header>

        <UserProfile user={user} />
      </div>
    </div>
  )
}
