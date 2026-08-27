import { useState, type FormEvent } from 'react'
import type { LoginRequest } from '../../types/auth'

interface LoginFormProps {
  onSubmit: (request: LoginRequest) => Promise<void>
  onRegisterClick?: () => void
}

export function LoginForm({ onSubmit, onRegisterClick }: LoginFormProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const validateForm = (): boolean => {
    let isValid = true

    if (!username.trim()) {
      setUsernameError('Username is required')
      isValid = false
    } else if (username.length < 3) {
      setUsernameError('Username must be at least 3 characters')
      isValid = false
    } else {
      setUsernameError(null)
    }

    if (!password) {
      setPasswordError('Password is required')
      isValid = false
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters')
      isValid = false
    } else {
      setPasswordError(null)
    }

    return isValid
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!validateForm()) return

    setIsLoading(true)
    try {
      await onSubmit({ username: username.trim(), password, rememberMe })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  const inputStyle = (hasError: boolean) => ({
    width: '100%',
    padding: '12px 16px',
    fontSize: '14px',
    fontWeight: 300,
    border: `1px solid ${hasError ? '#C4612F' : '#E7E1D7'}`,
    borderRadius: '8px',
    background: '#FFFFFF',
    color: '#1F2421',
    outline: 'none',
    transition: 'border-color 0.2s',
  })

  const labelStyle = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 400,
    color: '#1F2421',
    marginBottom: '8px',
  }

  const errorStyle = {
    fontSize: '12px',
    color: '#C4612F',
    marginTop: '6px',
    fontWeight: 300,
  }

  return (
    <form onSubmit={handleSubmit} style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      width: '100%',
      maxWidth: '400px',
    }}>
      <div>
        <label style={labelStyle}>
          Username
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value)
            if (usernameError) setUsernameError(null)
          }}
          style={inputStyle(!!usernameError)}
          disabled={isLoading}
          autoComplete="username"
        />
        {usernameError && <div style={errorStyle}>{usernameError}</div>}
      </div>

      <div>
        <label style={labelStyle}>
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            if (passwordError) setPasswordError(null)
          }}
          style={inputStyle(!!passwordError)}
          disabled={isLoading}
          autoComplete="current-password"
        />
        {passwordError && <div style={errorStyle}>{passwordError}</div>}
      </div>

      <label style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '13px',
        fontWeight: 300,
        color: '#1F2421',
        cursor: 'pointer',
      }}>
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          disabled={isLoading}
          style={{ cursor: 'pointer' }}
        />
        Remember me
      </label>

      {error && (
        <div style={{
          padding: '12px 16px',
          background: '#F2E3D6',
          border: '1px solid #C4612F',
          borderRadius: '8px',
          fontSize: '13px',
          color: '#1F2421',
          fontWeight: 300,
        }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        style={{
          padding: '14px 32px',
          fontSize: '14px',
          fontWeight: 400,
          color: '#FFFFFF',
          background: isLoading ? '#5C635D' : '#C4612F',
          border: 'none',
          borderRadius: '999px',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          if (!isLoading) e.currentTarget.style.background = '#A94E22'
        }}
        onMouseLeave={(e) => {
          if (!isLoading) e.currentTarget.style.background = '#C4612F'
        }}
      >
        {isLoading ? 'Signing in...' : 'Sign in'}
      </button>

      {onRegisterClick && (
        <div style={{
          textAlign: 'center',
          fontSize: '13px',
          fontWeight: 300,
          color: '#5C635D',
        }}>
          Don't have an account?{' '}
          <button
            type="button"
            onClick={onRegisterClick}
            disabled={isLoading}
            style={{
              background: 'none',
              border: 'none',
              color: '#C4612F',
              cursor: 'pointer',
              textDecoration: 'underline',
              fontWeight: 400,
              padding: 0,
            }}
          >
            Sign up
          </button>
        </div>
      )}
    </form>
  )
}
