import { useState, type FormEvent } from 'react'
import type { RegisterRequest } from '../../types/auth'

interface RegisterFormProps {
  onSubmit: (request: RegisterRequest) => Promise<void>
  onLoginClick?: () => void
}

export function RegisterForm({ onSubmit, onLoginClick }: RegisterFormProps) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null)

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const validateForm = (): boolean => {
    let isValid = true

    if (!username.trim()) {
      setUsernameError('Username is required')
      isValid = false
    } else if (username.length < 3) {
      setUsernameError('Username must be at least 3 characters')
      isValid = false
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setUsernameError('Username can only contain letters, numbers, and underscores')
      isValid = false
    } else {
      setUsernameError(null)
    }

    if (!email.trim()) {
      setEmailError('Email is required')
      isValid = false
    } else if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address')
      isValid = false
    } else {
      setEmailError(null)
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

    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password')
      isValid = false
    } else if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match')
      isValid = false
    } else {
      setConfirmPasswordError(null)
    }

    return isValid
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!validateForm()) return

    setIsLoading(true)
    try {
      await onSubmit({
        username: username.trim(),
        email: email.trim(),
        password,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
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
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (emailError) setEmailError(null)
          }}
          style={inputStyle(!!emailError)}
          disabled={isLoading}
          autoComplete="email"
        />
        {emailError && <div style={errorStyle}>{emailError}</div>}
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
            if (confirmPassword && e.target.value === confirmPassword) {
              setConfirmPasswordError(null)
            }
          }}
          style={inputStyle(!!passwordError)}
          disabled={isLoading}
          autoComplete="new-password"
        />
        {passwordError && <div style={errorStyle}>{passwordError}</div>}
      </div>

      <div>
        <label style={labelStyle}>
          Confirm Password
        </label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value)
            if (confirmPasswordError) setConfirmPasswordError(null)
          }}
          style={inputStyle(!!confirmPasswordError)}
          disabled={isLoading}
          autoComplete="new-password"
        />
        {confirmPasswordError && <div style={errorStyle}>{confirmPasswordError}</div>}
      </div>

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
        {isLoading ? 'Creating account...' : 'Create account'}
      </button>

      {onLoginClick && (
        <div style={{
          textAlign: 'center',
          fontSize: '13px',
          fontWeight: 300,
          color: '#5C635D',
        }}>
          Already have an account?{' '}
          <button
            type="button"
            onClick={onLoginClick}
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
            Sign in
          </button>
        </div>
      )}
    </form>
  )
}
