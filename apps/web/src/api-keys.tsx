import { useEffect, useState, type ReactNode } from 'react'
import type { AuthUser } from './auth.tsx'

export interface ApiKeyRecord {
  id: string
  name: string
  createdAt: string
  lastUsedAt?: string
}

interface ApiKeyWithSecret extends ApiKeyRecord {
  secret?: string
}

interface ApiKeyPanelProps {
  user: AuthUser
  onClose: () => void
}

const API_URL = ((import.meta as unknown as { env?: unknown }).env)
const configuredApiUrl = typeof API_URL === 'object' && API_URL !== null && typeof Reflect.get(API_URL, 'VITE_AUTH_API_URL') === 'string'
  ? Reflect.get(API_URL, 'VITE_AUTH_API_URL') as string
  : '/api/auth'
const AUTH_API_URL = configuredApiUrl.replace(/\/$/, '')

function localKeyName(userId: string): string {
  return `dsh.auth.keys.${userId}`
}

function readLocalKeys(userId: string): ApiKeyWithSecret[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(localKeyName(userId)) ?? '[]')
    return Array.isArray(value) ? value.filter(isKey) : []
  } catch {
    return []
  }
}

function isKey(value: unknown): value is ApiKeyWithSecret {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Record<string, unknown>
  return typeof row.id === 'string' && typeof row.name === 'string' && typeof row.createdAt === 'string'
    && (row.secret === undefined || typeof row.secret === 'string')
}

function localKeys(userId: string, keys: ApiKeyWithSecret[]): void {
  localStorage.setItem(localKeyName(userId), JSON.stringify(keys))
}

async function remoteKeys(): Promise<ApiKeyWithSecret[]> {
  const response = await fetch(`${AUTH_API_URL}/keys`, { credentials: 'include' })
  if (response.status === 404 || response.status === 503) throw new Error('认证服务未配置')
  if (!response.ok) throw new Error('无法读取 API Key 列表。')
  const body: unknown = await response.json()
  if (typeof body !== 'object' || body === null || !Array.isArray((body as Record<string, unknown>).keys)) {
    throw new Error('认证服务返回了无效的 API Key 数据。')
  }
  const keys = (body as { keys: unknown[] }).keys.filter(isKey)
  return keys.map(({ secret: _secret, ...key }) => key)
}

async function createRemoteKey(name: string): Promise<ApiKeyWithSecret> {
  const response = await fetch(`${AUTH_API_URL}/keys`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name }),
  })
  if (response.status === 404 || response.status === 503) throw new Error('认证服务未配置')
  if (!response.ok) throw new Error('创建 API Key 失败。')
  const body: unknown = await response.json()
  if (typeof body !== 'object' || body === null || !isKey((body as Record<string, unknown>).key)) {
    throw new Error('认证服务返回了无效的 API Key。')
  }
  const key = (body as { key: ApiKeyWithSecret }).key
  const secret = key.secret ?? (typeof (body as Record<string, unknown>).secret === 'string' ? (body as { secret: string }).secret : undefined)
  return secret === undefined ? key : { ...key, secret }
}

async function revokeRemoteKey(id: string): Promise<void> {
  const response = await fetch(`${AUTH_API_URL}/keys/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' })
  if (response.status === 404 || response.status === 503) throw new Error('认证服务未配置')
  if (!response.ok) throw new Error('撤销 API Key 失败。')
}

function localCreate(name: string): ApiKeyWithSecret {
  const secret = `dsh_${crypto.randomUUID().replaceAll('-', '')}`
  return { id: crypto.randomUUID(), name, createdAt: new Date().toISOString(), secret }
}

/** Account-scoped API key list and creation/revocation controls. */
export function ApiKeyPanel({ user, onClose }: ApiKeyPanelProps): ReactNode {
  const [keys, setKeys] = useState<ApiKeyWithSecret[]>([])
  const [name, setName] = useState('')
  const [newSecret, setNewSecret] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [localMode, setLocalMode] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    let alive = true
    void remoteKeys().then((remote) => {
      if (!alive) return
      setKeys(remote)
      setLoading(false)
    }).catch((reason: unknown) => {
      if (!alive) return
      if (!(reason instanceof TypeError) && !String(reason).includes('Failed to fetch') && !String(reason).includes('认证服务未配置')) {
        setError(reason instanceof Error ? reason.message : '无法读取 API Key 列表。')
      }
      setLocalMode(true)
      setKeys(readLocalKeys(user.id))
      setLoading(false)
    })
    return () => { alive = false }
  }, [user])

  const create = async (): Promise<void> => {
    const trimmed = name.trim()
    if (trimmed.length < 2) {
      setError('名称至少需要 2 个字符。')
      return
    }
    setPending(true)
    setError(undefined)
    try {
      let key: ApiKeyWithSecret
      if (localMode) {
        key = localCreate(trimmed)
        localKeys(user.id, [key, ...keys])
      } else {
        try {
          key = await createRemoteKey(trimmed)
        } catch (reason) {
          if (!(reason instanceof TypeError) && !String(reason).includes('Failed to fetch') && !String(reason).includes('认证服务未配置')) throw reason
          setLocalMode(true)
          key = localCreate(trimmed)
          localKeys(user.id, [key, ...keys])
        }
      }
      setKeys(current => [key, ...current])
      setNewSecret(key.secret)
      setName('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '创建 API Key 失败。')
    } finally {
      setPending(false)
    }
  }

  const revoke = async (id: string): Promise<void> => {
    setPending(true)
    setError(undefined)
    try {
      if (localMode) {
        localKeys(user.id, keys.filter(key => key.id !== id))
      } else {
        try {
          await revokeRemoteKey(id)
        } catch (reason) {
          if (!(reason instanceof TypeError) && !String(reason).includes('Failed to fetch') && !String(reason).includes('认证服务未配置')) throw reason
          setLocalMode(true)
          localKeys(user.id, keys.filter(key => key.id !== id))
        }
      }
      setKeys(current => current.filter(key => key.id !== id))
      setNewSecret(undefined)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '撤销 API Key 失败。')
    } finally {
      setPending(false)
    }
  }

  const copySecret = async (): Promise<void> => {
    if (newSecret === undefined) return
    await navigator.clipboard.writeText(newSecret)
  }

  return (
    <div className="api-key-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="api-key-panel" role="dialog" aria-modal="true" aria-labelledby="api-key-title">
        <header className="api-key-header"><div><p className="api-key-kicker">ACCOUNT / {user.email}</p><h2 id="api-key-title">API Key 管理</h2></div><button type="button" className="api-key-close" onClick={onClose} aria-label="关闭">×</button></header>
        <div className="api-key-create"><label>名称<input value={name} onChange={(event) => { setName(event.target.value) }} placeholder="例如：生产服务" /></label><button type="button" onClick={() => { void create() }} disabled={pending}>创建 Key</button></div>
        {newSecret !== undefined && <div className="api-key-secret" role="status"><div><strong>请立即复制新的 Key</strong><code>{newSecret}</code></div><button type="button" onClick={() => { void copySecret() }}>复制</button></div>}
        {error !== undefined && <p className="api-key-error" role="alert">{error}</p>}
        {loading ? <p className="api-key-empty">正在加载…</p> : keys.length === 0 ? <p className="api-key-empty">还没有 API Key。</p> : <ul className="api-key-list">{keys.map(key => <li key={key.id}><div><strong>{key.name}</strong><span>创建于 {new Date(key.createdAt).toLocaleDateString()}</span></div><button type="button" onClick={() => { void revoke(key.id) }} disabled={pending}>撤销</button></li>)}</ul>}
        <p className="api-key-footnote">{localMode ? '当前使用本地开发模式；生产环境请接入服务端 Key 存储。' : 'API Key 仅与当前账号关联，服务端负责权限校验。'}</p>
      </section>
    </div>
  )
}
