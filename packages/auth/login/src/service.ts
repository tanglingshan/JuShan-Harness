/**
 * Login and authentication service for DeepSeek Harness.
 * @module @deepseek-ai/dsh-auth-login/service
 */

import { randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import { Service } from '@deepseek-ai/cordis'
import type { DatabaseSync } from 'node:sqlite'
import bcrypt from 'bcrypt'
import { JwtManager } from './jwt.ts'
import { SessionManager } from './session.ts'
import type {
  LoginParams,
  LoginResult,
  LoginConfig,
  TokenVerificationResult,
  RefreshTokenParams,
  RefreshTokenResult,
} from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    login: LoginService
  }
}

const DEFAULT_CONFIG: Required<Omit<LoginConfig, 'jwtSecret'>> = {
  jwtExpiresIn: '1h',
  jwtRefreshExpiresIn: '7d',
  rememberMeExpiresIn: '30d',
  bcryptRounds: 10,
  sessionMaxConcurrent: 5,
}

/**
 * Cordis service for login and session management.
 */
export class LoginService extends Service {
  static readonly inject = ['database', 'user']
  private jwtManager!: JwtManager
  private sessionManager!: SessionManager
  private config!: Required<LoginConfig>

  constructor(ctx: Context, config: LoginConfig) {
    super(ctx, 'login', true)

    if (!config.jwtSecret) {
      throw new Error('LoginService requires jwtSecret in config')
    }

    this.config = { ...DEFAULT_CONFIG, ...config }

    ctx.on('ready', () => {
      const db = (ctx as unknown as { database?: DatabaseSync }).database as DatabaseSync
      if (!db) {
        throw new Error('LoginService requires a database instance')
      }

      this.jwtManager = new JwtManager(
        this.config.jwtSecret,
        this.config.jwtExpiresIn,
        this.config.jwtRefreshExpiresIn,
      )
      this.sessionManager = new SessionManager(db, this.jwtManager)

      // Start periodic session cleanup
      this.startSessionCleanup()
    })
  }

  /**
   * Authenticate user and create session.
   * @param params - Login parameters
   * @returns Login result with tokens
   * @throws Error with code AUTH_INVALID_CREDENTIALS, AUTH_ACCOUNT_SUSPENDED, or AUTH_ACCOUNT_DELETED
   */
  async login(params: LoginParams): Promise<LoginResult> {
    // Find user by username or email
    let user = await this.ctx.user.getUserByUsername(params.username)
    if (!user) {
      user = await this.ctx.user.getUserByEmail(params.username)
    }

    if (!user) {
      throw new Error('AUTH_INVALID_CREDENTIALS')
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(params.password, user.passwordHash)
    if (!isValidPassword) {
      throw new Error('AUTH_INVALID_CREDENTIALS')
    }

    // Check account status
    if (user.status === 'suspended') {
      throw new Error('AUTH_ACCOUNT_SUSPENDED')
    }
    if (user.status === 'deleted') {
      throw new Error('AUTH_ACCOUNT_DELETED')
    }
    if (user.status === 'inactive') {
      throw new Error('AUTH_ACCOUNT_INACTIVE')
    }

    // Generate session ID and tokens
    const sessionId = randomUUID()
    const accessToken = this.jwtManager.generateAccessToken({
      sub: user.id,
      username: user.username,
      email: user.email,
      sessionId,
    })
    const refreshToken = this.jwtManager.generateRefreshToken()

    // Determine token expiration
    const expiresIn = params.rememberMe
      ? this.jwtManager.parseExpiresIn(this.config.rememberMeExpiresIn)
      : this.jwtManager.getExpiresInSeconds()

    // Create session
    this.sessionManager.createSession({
      userId: user.id,
      accessToken,
      refreshToken,
      expiresIn,
    })

    // Enforce concurrent session limit
    this.sessionManager.enforceSessionLimit(user.id, this.config.sessionMaxConcurrent)

    // Update last login timestamp
    await this.ctx.user.updateLastLogin(user.id)

    return {
      userId: user.id,
      username: user.username,
      email: user.email,
      accessToken,
      refreshToken,
      expiresIn,
      tokenType: 'Bearer',
    }
  }

  /**
   * Logout and revoke session.
   * @param sessionId - Session ID to revoke
   */
  async logout(sessionId: string): Promise<void> {
    this.sessionManager.revokeSession(sessionId)
  }

  /**
   * Logout from all sessions for a user.
   * @param userId - User ID
   * @returns Number of revoked sessions
   */
  async logoutAll(userId: string): Promise<number> {
    return this.sessionManager.revokeAllUserSessions(userId)
  }

  /**
   * Verify JWT token validity.
   * @param token - JWT access token
   * @returns Verification result with payload if valid
   */
  async verifyToken(token: string): Promise<TokenVerificationResult> {
    try {
      const payload = this.jwtManager.verifyToken(token)

      // Check if session is still active
      const tokenHash = this.jwtManager.hashToken(token)
      const session = this.sessionManager.getSessionByTokenHash(tokenHash)

      if (!session || session.status !== 'active') {
        return { valid: false }
      }

      // Check expiration
      if (session.expiresAt < Date.now()) {
        return { valid: false }
      }

      // Update last activity
      this.sessionManager.updateActivity(session.id)

      return {
        valid: true,
        payload,
        expiresAt: session.expiresAt,
      }
    } catch (_error: unknown) {
      return { valid: false }
    }
  }

  /**
   * Refresh access token using refresh token.
   * @param params - Refresh token parameters
   * @returns New access token
   * @throws Error with code AUTH_TOKEN_INVALID or AUTH_SESSION_NOT_FOUND
   */
  async refreshToken(params: RefreshTokenParams): Promise<RefreshTokenResult> {
    const refreshTokenHash = this.jwtManager.hashToken(params.refreshToken)
    const session = this.sessionManager.getSessionByRefreshTokenHash(refreshTokenHash)

    if (!session) {
      throw new Error('AUTH_SESSION_NOT_FOUND')
    }

    // Check refresh token expiration
    if (session.refreshExpiresAt && session.refreshExpiresAt < Date.now()) {
      this.sessionManager.revokeSession(session.id)
      throw new Error('AUTH_TOKEN_EXPIRED')
    }

    // Get user info
    const user = await this.ctx.user.getUserById(session.userId)
    if (!user) {
      throw new Error('AUTH_USER_NOT_FOUND')
    }

    // Check account status
    if (user.status !== 'active') {
      this.sessionManager.revokeSession(session.id)
      throw new Error('AUTH_ACCOUNT_SUSPENDED')
    }

    // Generate new access token
    const newAccessToken = this.jwtManager.generateAccessToken({
      sub: user.id,
      username: user.username,
      email: user.email,
      sessionId: session.id,
    })

    const expiresIn = this.jwtManager.getExpiresInSeconds()

    // Update session with new token
    this.sessionManager.updateSessionToken(session.id, newAccessToken, expiresIn)

    return {
      accessToken: newAccessToken,
      expiresIn,
      tokenType: 'Bearer',
    }
  }

  /**
   * Get active sessions for a user.
   * @param userId - User ID
   * @returns Array of active session info
   */
  async getUserSessions(userId: string) {
    return this.sessionManager.getUserActiveSessions(userId)
  }

  /**
   * Start periodic session cleanup task.
   * Runs every hour to remove expired sessions.
   */
  private startSessionCleanup(): void {
    const CLEANUP_INTERVAL = 3600000 // 1 hour

    const cleanup = () => {
      try {
        const cleaned = this.sessionManager.cleanupExpiredSessions()
        if (cleaned > 0) {
          this.ctx.logger?.debug(`Cleaned up ${cleaned} expired sessions`)
        }
      } catch (error: unknown) {
        this.ctx.logger?.warn('Session cleanup failed', error)
      }
    }

    // Run initial cleanup
    cleanup()

    // Schedule periodic cleanup
    const interval = setInterval(cleanup, CLEANUP_INTERVAL)

    // Clean up on service disposal
    this.ctx.on('dispose', () => {
      clearInterval(interval)
    })
  }
}

export default LoginService
