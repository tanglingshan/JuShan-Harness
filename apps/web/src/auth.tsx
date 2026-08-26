import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { ApiKeyPanel } from './api-keys.tsx'

export interface AuthUser {
  id: string
  email: string
  name: string
}

interface AuthProps {
  onAuthenticated: (user: AuthUser) => void
}

interface StoredAccount extends AuthUser {
  passwordHash: string
}

const SESSION_KEY = 'dsh.auth.session'
const LOCAL_ACCOUNTS_KEY = 'dsh.auth.local.accounts'
const metaEnv = (import.meta as unknown as { env?: unknown }).env
const configuredApiUrl = typeof metaEnv === 'object' && metaEnv !== null
  && typeof Reflect.get(metaEnv, 'VITE_AUTH_API_URL') === 'string'
  ? Reflect.get(metaEnv, 'VITE_AUTH_API_URL') as string
  : '/api/auth'
const AUTH_API_URL = configuredApiUrl.replace(/\/$/, '')

/** Best-effort remote session revocation before returning to the gate. */
export async function logoutAuth(): Promise<void> {
  try {
    await fetch(`${AUTH_API_URL}/logout`, { method: 'POST', credentials: 'include' })
  } catch {
    // The local session is still cleared when the remote service is offline.
  }
  clearAuthSession()
}

function readSession(): AuthUser | undefined {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null')
    if (!isUser(value)) return undefined
    return value
  } catch {
    return undefined
  }
}

function isUser(value: unknown): value is AuthUser {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Record<string, unknown>
  return typeof row.id === 'string' && typeof row.email === 'string' && typeof row.name === 'string'
}

async function passwordHash(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(password)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function localAccounts(): StoredAccount[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(LOCAL_ACCOUNTS_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter(isStoredAccount) : []
  } catch {
    return []
  }
}

function isStoredAccount(value: unknown): value is StoredAccount {
  return isUser(value) && typeof (value as unknown as Record<string, unknown>).passwordHash === 'string'
}

function persistSession(user: AuthUser): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
}

async function requestAuth(path: 'login' | 'register', payload: Record<string, string>): Promise<AuthUser> {
  const response = await fetch(`${AUTH_API_URL}/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    if (response.status === 404 || response.status === 503) throw new Error('认证服务未配置')
    const body: unknown = await response.json().catch(() => undefined)
    const message = typeof body === 'object' && body !== null && typeof (body as Record<string, unknown>).message === 'string'
      ? (body as Record<string, string>).message
      : '认证请求失败，请检查账号信息。'
    throw new Error(message)
  }
  const body: unknown = await response.json()
  if (typeof body !== 'object' || body === null || !isUser((body as Record<string, unknown>).user)) {
    throw new Error('认证服务返回了无效数据。')
  }
  persistSession((body as { user: AuthUser }).user)
  return (body as { user: AuthUser }).user
}

async function requestCurrentUser(): Promise<AuthUser | undefined> {
  try {
    const response = await fetch(`${AUTH_API_URL}/me`, { credentials: 'include' })
    if (!response.ok) return undefined
    const body: unknown = await response.json()
    if (typeof body !== 'object' || body === null || !isUser((body as Record<string, unknown>).user)) return undefined
    const user = (body as { user: AuthUser }).user
    persistSession(user)
    return user
  } catch {
    return undefined
  }
}

async function localAuth(path: 'login' | 'register', email: string, password: string, name: string): Promise<AuthUser> {
  const accounts = localAccounts()
  const normalizedEmail = email.trim().toLowerCase()
  const hash = await passwordHash(password)
  if (path === 'register') {
    if (accounts.some(account => account.email === normalizedEmail)) throw new Error('该邮箱已注册。')
    const user: StoredAccount = { id: crypto.randomUUID(), email: normalizedEmail, name: name.trim(), passwordHash: hash }
    localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify([...accounts, user]))
    const safeUser: AuthUser = { id: user.id, email: user.email, name: user.name }
    persistSession(safeUser)
    return safeUser
  }
  const user = accounts.find(account => account.email === normalizedEmail && account.passwordHash === hash)
  if (user === undefined) throw new Error('邮箱或密码不正确。')
  const safeUser: AuthUser = { id: user.id, email: user.email, name: user.name }
  persistSession(safeUser)
  return safeUser
}

/** Login and registration gate for the browser shell. */
export function AuthGate({ onAuthenticated }: AuthProps): ReactNode {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)
  const [localMode, setLocalMode] = useState(false)

  useEffect(() => {
    const user = readSession()
    if (user !== undefined) {
      onAuthenticated(user)
      return
    }
    void requestCurrentUser().then((remoteUser) => {
      if (remoteUser !== undefined) onAuthenticated(remoteUser)
    })
  }, [onAuthenticated])

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setError(undefined)
    if (password.length < 8) {
      setError('密码至少需要 8 位。')
      return
    }
    if (mode === 'register' && name.trim().length < 2) {
      setError('请输入至少 2 个字符的昵称。')
      return
    }
    if (mode === 'register' && password !== confirmPassword) {
      setError('两次输入的密码不一致。')
      return
    }
    setPending(true)
    try {
      let user: AuthUser
      try {
        user = await requestAuth(mode, { email, password, ...(mode === 'register' ? { name } : {}) })
        setLocalMode(false)
      } catch (remoteError) {
        // A local fallback keeps the shell usable before the remote service is deployed.
        if (!(remoteError instanceof TypeError) && !String(remoteError).includes('Failed to fetch') && !String(remoteError).includes('认证服务未配置')) throw remoteError
        user = await localAuth(mode, email, password, name)
        setLocalMode(true)
      }
      onAuthenticated(user)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '认证失败，请稍后重试。')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-mark" aria-hidden="true">DS</div>
        <p className="auth-kicker">DEEPSEEK HARNESS</p>
        <h1 id="auth-title">{mode === 'login' ? '欢迎回来' : '创建你的账号'}</h1>
        <p className="auth-subtitle">{mode === 'login' ? '登录后继续使用你的工作区。' : '注册后即可保存会话和工作区设置。'}</p>
        <div className="auth-tabs" role="tablist" aria-label="认证方式">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(undefined) }}>登录</button>
          <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(undefined) }}>注册</button>
        </div>
        <form className="auth-form" onSubmit={(event) => { void submit(event) }}>
          {mode === 'register' && <label>昵称<input required value={name} onChange={(event) => { setName(event.target.value) }} autoComplete="name" placeholder="你的名字" /></label>}
          <label>邮箱<input required type="email" value={email} onChange={(event) => { setEmail(event.target.value) }} autoComplete="email" placeholder="you@example.com" /></label>
          <label>密码<input required type="password" value={password} onChange={(event) => { setPassword(event.target.value) }} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="至少 8 位" /></label>
          {mode === 'register' && <label>确认密码<input required type="password" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value) }} autoComplete="new-password" placeholder="再次输入密码" /></label>}
          {error !== undefined && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={pending}>{pending ? '处理中…' : mode === 'login' ? '登录' : '注册'}</button>
        </form>
        <p className="auth-note">{localMode ? '当前使用本地开发模式，配置远程认证服务后将自动切换。' : '账号数据由服务端认证接口管理。'}</p>
      </section>
    </main>
  )
}

/** Small account strip displayed above the authenticated application. */
export function AuthBar({ user, onLogout }: { user: AuthUser; onLogout: () => void }): ReactNode {
  const [showKeys, setShowKeys] = useState(false)
  return <>
    <div className="auth-bar"><span>{user.name || user.email}</span><button type="button" onClick={() => { setShowKeys(true) }}>API Key</button><button type="button" onClick={onLogout}>退出</button></div>
    {showKeys && <ApiKeyPanel user={user} onClose={() => { setShowKeys(false) }} />}
  </>
}

export function clearAuthSession(): void {
  sessionStorage.removeItem(SESSION_KEY)
}
