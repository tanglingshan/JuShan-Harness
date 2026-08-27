import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { RegisterForm } from '../../components/auth/RegisterForm'
import type { RegisterRequest } from '../../types/auth'

export function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()

  const handleRegister = async (request: RegisterRequest) => {
    await register(request)
    navigate('/profile')
  }

  const handleLoginClick = () => {
    navigate('/login')
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
            Get started
          </div>
          <h1 style={{
            margin: 0,
            fontSize: '32px',
            fontWeight: 400,
            fontFamily: 'Fraunces, serif',
            color: '#1F2421',
            letterSpacing: '-0.02em',
          }}>
            Create your <span style={{ fontStyle: 'italic', color: '#C4612F' }}>account</span>
          </h1>
        </div>

        <RegisterForm onSubmit={handleRegister} onLoginClick={handleLoginClick} />
      </div>
    </div>
  )
}
