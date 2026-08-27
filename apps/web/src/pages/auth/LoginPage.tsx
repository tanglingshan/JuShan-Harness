import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { LoginForm } from '../../components/auth/LoginForm'
import type { LoginRequest } from '../../types/auth'

export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const handleLogin = async (request: LoginRequest) => {
    await login(request)
    navigate('/profile')
  }

  const handleRegisterClick = () => {
    navigate('/register')
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F7F4EF',
      padding: '24px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '480px',
        background: '#FFFFFF',
        borderRadius: '16px',
        padding: '48px 40px',
        border: '1px solid #E7E1D7',
        boxShadow: '0 2px 8px rgba(31, 36, 33, 0.04)',
      }}>
        <div style={{ marginBottom: '40px', textAlign: 'center' }}>
          <div style={{
            display: 'inline-block',
            padding: '6px 16px',
            background: '#F2E3D6',
            borderRadius: '999px',
            fontSize: '11px',
            fontWeight: 500,
            color: '#C4612F',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '16px',
          }}>
            Welcome back
          </div>
          <h1 style={{
            margin: 0,
            fontSize: '32px',
            fontWeight: 400,
            fontFamily: 'Fraunces, serif',
            color: '#1F2421',
            letterSpacing: '-0.02em',
          }}>
            Sign in to your <span style={{ fontStyle: 'italic', color: '#C4612F' }}>account</span>
          </h1>
        </div>

        <LoginForm onSubmit={handleLogin} onRegisterClick={handleRegisterClick} />
      </div>
    </div>
  )
}
