import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { promisify } from 'node:util'
import pg from 'pg'
import type { Context } from '@deepseek-ai/cordis'
import type { WebServer } from '@deepseek-ai/dsh-host-webserver'

const { Pool } = pg
const scryptAsync = promisify(scrypt)
const SESSION_COOKIE = 'dsh_auth_session'
const SESSION_DAYS = 30
const BODY_LIMIT = 32 * 1024
const SCHEMA_URL = new URL('../auth-schema.sql', import.meta.url)

interface UserRow {
  id: string
  email: string
  name: string
}

interface ApiKeyRow {
  id: string
  name: string
  created_at: Date | string
  last_used_at: Date | string | null
}

interface JsonRecord {
  [key: string]: unknown
}

function json(res: ServerResponse, status: number, body: JsonRecord): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

function cookie(res: ServerResponse, token: string, maxAge: number): void {
  res.setHeader('set-cookie', `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${String(maxAge)}`)
}

function clearCookie(res: ServerResponse): void {
  cookie(res, '', 0)
}

function sessionHash(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function parseCookie(header: string | undefined, name: string): string | undefined {
  if (header === undefined) return undefined
  for (const part of header.split(';')) {
    const at = part.indexOf('=')
    if (at === -1 || part.slice(0, at).trim() !== name) continue
    const value = part.slice(at + 1).trim()
    return value === '' ? undefined : value
  }
  return undefined
}

async function body(req: IncomingMessage): Promise<JsonRecord> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
    size += data.length
    if (size > BODY_LIMIT) throw new Error('request body is too large')
    chunks.push(data)
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('request body must be an object')
  return parsed as JsonRecord
}

function textField(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`)
  const result = value.trim()
  if (result === '' || result.length > max) throw new Error(`${field} is invalid`)
  return result
}

function userResponse(row: UserRow): JsonRecord {
  return { id: row.id, email: row.email, name: row.name }
}

function publicKey(row: ApiKeyRow): JsonRecord {
  return {
    id: row.id,
    name: row.name,
    createdAt: new Date(row.created_at).toISOString(),
    ...(row.last_used_at === null ? {} : { lastUsedAt: new Date(row.last_used_at).toISOString() }),
  }
}

async function passwordHash(password: string): Promise<string> {
  const salt = randomBytes(16).toString('base64url')
  const derived = await scryptAsync(password, salt, 64) as Buffer
  return `scrypt$${salt}$${derived.toString('base64url')}`
}

async function passwordMatches(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const salt = parts[1]
  const expected = parts[2]
  if (salt === undefined || expected === undefined) return false
  const actual = await scryptAsync(password, salt, 64) as Buffer
  const target = Buffer.from(expected, 'base64url')
  return actual.length === target.length && timingSafeEqual(actual, target)
}

/** PostgreSQL-backed account and API key routes mounted on the existing Web server. */
export class AuthApi {
  private readonly pool: pg.Pool | undefined
  private readonly ready: Promise<void>

  /**
   * @param ctx - host context used for diagnostics.
   * @param databaseUrl - server-only PostgreSQL connection string.
   */
  constructor(private readonly ctx: Context, databaseUrl: string | undefined = process.env.AUTH_DATABASE_URL) {
    this.pool = databaseUrl === undefined || databaseUrl.trim() === ''
      ? undefined
      : new Pool({ connectionString: databaseUrl, max: 10, idleTimeoutMillis: 30_000 })
    this.ready = this.initialize()
  }

  /** Register all auth endpoints and return the route disposer. */
  register(server: WebServer): () => void {
    const disposers = [
      server.register({ kind: 'exact', path: '/api/auth/register', handler: (req, res) => this.dispatch(req, res) }),
      server.register({ kind: 'exact', path: '/api/auth/login', handler: (req, res) => this.dispatch(req, res) }),
      server.register({ kind: 'exact', path: '/api/auth/logout', handler: (req, res) => this.dispatch(req, res) }),
      server.register({ kind: 'exact', path: '/api/auth/me', handler: (req, res) => this.dispatch(req, res) }),
      server.register({ kind: 'prefix', path: '/api/auth/keys', handler: (req, res) => this.dispatch(req, res) }),
    ]
    return () => { for (const dispose of disposers) dispose() }
  }

  /** Close the pool during plugin disposal. */
  async dispose(): Promise<void> {
    if (this.pool !== undefined) await this.pool.end()
  }

  private async initialize(): Promise<void> {
    if (this.pool === undefined) return
    try {
      await this.pool.query(await readFile(SCHEMA_URL, 'utf8'))
    } catch (error) {
      this.ctx.logger.error(error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }

  private async database(): Promise<pg.Pool> {
    await this.ready
    if (this.pool === undefined) throw new Error('authentication database is not configured')
    return this.pool
  }

  private async dispatch(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const pathname = new URL(req.url ?? '/', 'http://local').pathname
      if (pathname === '/api/auth/register' && req.method === 'POST') {
        await this.registerUser(req, res)
        return
      }
      if (pathname === '/api/auth/login' && req.method === 'POST') {
        await this.login(req, res)
        return
      }
      if (pathname === '/api/auth/logout' && req.method === 'POST') {
        await this.logout(req, res)
        return
      }
      if (pathname === '/api/auth/me' && req.method === 'GET') {
        await this.me(req, res)
        return
      }
      if (pathname === '/api/auth/keys' && req.method === 'GET') {
        await this.listKeys(req, res)
        return
      }
      if (pathname === '/api/auth/keys' && req.method === 'POST') {
        await this.createKey(req, res)
        return
      }
      if (pathname.startsWith('/api/auth/keys/') && req.method === 'DELETE') {
        await this.revokeKey(req, res, pathname.slice('/api/auth/keys/'.length))
        return
      }
      json(res, 405, { message: 'method not allowed' })
    } catch (error) {
      if (error instanceof SyntaxError || (error instanceof Error && error.message.startsWith('request body'))) {
        json(res, 400, { message: error instanceof Error ? error.message : 'invalid request' })
        return
      }
      if (error instanceof Error && error.message === 'authentication database is not configured') {
        json(res, 503, { message: error.message })
        return
      }
      this.ctx.logger.warn(error instanceof Error ? error : new Error(String(error)))
      json(res, 500, { message: 'authentication service unavailable' })
    }
  }

  private async registerUser(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const input = await body(req)
    const email = textField(input.email, 'email', 320).toLowerCase()
    const name = textField(input.name, 'name', 100)
    const password = textField(input.password, 'password', 256)
    if (password.length < 8) throw new Error('password must contain at least 8 characters')
    const db = await this.database()
    try {
      const result = await db.query<UserRow>(
        'INSERT INTO auth_users (id, email, name, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, email, name',
        [randomUUID(), email, name, await passwordHash(password)],
      )
      const row = result.rows[0]
      if (row === undefined) throw new Error('user was not created')
      await this.startSession(db, row, res)
      json(res, 201, { user: userResponse(row) })
    } catch (error) {
      if (isUniqueViolation(error)) {
        json(res, 409, { message: 'email is already registered' })
        return
      }
      throw error
    }
  }

  private async login(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const input = await body(req)
    const email = textField(input.email, 'email', 320).toLowerCase()
    const password = textField(input.password, 'password', 256)
    const db = await this.database()
    const result = await db.query<UserRow & { password_hash: string }>(
      'SELECT id, email, name, password_hash FROM auth_users WHERE lower(email) = $1', [email],
    )
    const row = result.rows[0]
    if (row === undefined || !(await passwordMatches(password, row.password_hash))) {
      json(res, 401, { message: 'email or password is incorrect' })
      return
    }
    await this.startSession(db, row, res)
    json(res, 200, { user: userResponse(row) })
  }

  private async logout(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const token = parseCookie(req.headers.cookie, SESSION_COOKIE)
    if (token !== undefined) {
      const db = await this.database()
      await db.query('DELETE FROM auth_sessions WHERE token_hash = $1', [sessionHash(token)])
    }
    clearCookie(res)
    json(res, 200, { ok: true })
  }

  private async me(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const user = await this.currentUser(req)
    if (user === undefined) {
      json(res, 401, { message: 'not authenticated' })
      return
    }
    json(res, 200, { user: userResponse(user) })
  }

  private async listKeys(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const user = await this.currentUser(req)
    if (user === undefined) {
      json(res, 401, { message: 'not authenticated' })
      return
    }
    const db = await this.database()
    const result = await db.query<ApiKeyRow>(
      'SELECT id, name, created_at, last_used_at FROM auth_api_keys WHERE user_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC',
      [user.id],
    )
    json(res, 200, { keys: result.rows.map(publicKey) })
  }

  private async createKey(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const user = await this.currentUser(req)
    if (user === undefined) {
      json(res, 401, { message: 'not authenticated' })
      return
    }
    const input = await body(req)
    const name = textField(input.name, 'name', 100)
    const secret = `dsh_${randomBytes(32).toString('base64url')}`
    const db = await this.database()
    const result = await db.query<ApiKeyRow>(
      'INSERT INTO auth_api_keys (id, user_id, name, secret_hash, secret_prefix) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, created_at, last_used_at',
      [randomUUID(), user.id, name, sessionHash(secret), secret.slice(0, 12)],
    )
    const row = result.rows[0]
    if (row === undefined) throw new Error('API key was not created')
    json(res, 201, { key: { ...publicKey(row), secret } })
  }

  private async revokeKey(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
    if (!/^[0-9a-f-]{36}$/iu.test(id)) {
      json(res, 400, { message: 'invalid API key id' })
      return
    }
    const user = await this.currentUser(req)
    if (user === undefined) {
      json(res, 401, { message: 'not authenticated' })
      return
    }
    const db = await this.database()
    const result = await db.query(
      'UPDATE auth_api_keys SET revoked_at = now() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL',
      [id, user.id],
    )
    if (result.rowCount === 0) {
      json(res, 404, { message: 'API key not found' })
      return
    }
    json(res, 200, { ok: true })
  }

  private async currentUser(req: IncomingMessage): Promise<UserRow | undefined> {
    const token = parseCookie(req.headers.cookie, SESSION_COOKIE)
    if (token === undefined) return undefined
    const db = await this.database()
    const result = await db.query<UserRow>(
      `SELECT u.id, u.email, u.name
       FROM auth_sessions s JOIN auth_users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now()`, [sessionHash(token)],
    )
    return result.rows[0]
  }

  private async startSession(db: pg.Pool, user: UserRow, res: ServerResponse): Promise<void> {
    const token = randomBytes(32).toString('base64url')
    await db.query(
      'INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval \'30 days\')',
      [sessionHash(token), user.id],
    )
    cookie(res, token, SESSION_DAYS * 24 * 60 * 60)
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && Reflect.get(error, 'code') === '23505'
}
