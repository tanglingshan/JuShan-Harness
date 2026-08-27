/**
 * Session management for JWT tokens.
 * @module @deepseek-ai/dsh-auth-login/session
 */

import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type { JwtManager } from './jwt.ts'
import type { SessionInfo } from './types.ts'

/**
 * Session manager for handling user sessions in database.
 */
export class SessionManager {
  constructor(
    private readonly db: DatabaseSync,
    private readonly jwtManager: JwtManager,
  ) {}

  /**
   * Create a new session in the database.
   * @param params - Session creation parameters
   * @returns Created session information
   */
  createSession(params: {
    userId: string
    accessToken: string
    refreshToken: string
    expiresIn: number
    ipAddress?: string
    userAgent?: string
  }): SessionInfo {
    const sessionId = randomUUID()
    const tokenHash = this.jwtManager.hashToken(params.accessToken)
    const refreshTokenHash = this.jwtManager.hashToken(params.refreshToken)
    const now = Date.now()

    const session: SessionInfo = {
      id: sessionId,
      userId: params.userId,
      tokenHash,
      refreshTokenHash,
      expiresAt: now + params.expiresIn * 1000,
      refreshExpiresAt: now + this.jwtManager.getRefreshExpiresInSeconds() * 1000,
      createdAt: now,
      lastActivityAt: now,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      status: 'active',
    }

    // Insert session into database
    this.db.prepare(`
      INSERT INTO sessions (
        id, user_id, token_hash, refresh_token_hash,
        expires_at, refresh_expires_at, created_at, last_activity_at,
        ip_address, user_agent, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      session.id,
      session.userId,
      session.tokenHash,
      session.refreshTokenHash,
      session.expiresAt,
      session.refreshExpiresAt,
      session.createdAt,
      session.lastActivityAt,
      session.ipAddress,
      session.userAgent,
      session.status,
    )

    return session
  }

  /**
   * Get session by ID.
   * @param sessionId - Session UUID
   * @returns Session info or null if not found
   */
  getSessionById(sessionId: string): SessionInfo | null {
    const row = this.db.prepare(`
      SELECT id, user_id, token_hash, refresh_token_hash,
             expires_at, refresh_expires_at, created_at, last_activity_at,
             ip_address, user_agent, status
      FROM sessions
      WHERE id = ?
    `).get(sessionId)

    return row ? this.mapRowToSession(row) : null
  }

  /**
   * Get session by token hash.
   * @param tokenHash - SHA-256 hash of the access token
   * @returns Session info or null if not found
   */
  getSessionByTokenHash(tokenHash: string): SessionInfo | null {
    const row = this.db.prepare(`
      SELECT id, user_id, token_hash, refresh_token_hash,
             expires_at, refresh_expires_at, created_at, last_activity_at,
             ip_address, user_agent, status
      FROM sessions
      WHERE token_hash = ? AND status = 'active'
    `).get(tokenHash)

    return row ? this.mapRowToSession(row) : null
  }

  /**
   * Get session by refresh token hash.
   * @param refreshTokenHash - SHA-256 hash of the refresh token
   * @returns Session info or null if not found
   */
  getSessionByRefreshTokenHash(refreshTokenHash: string): SessionInfo | null {
    const row = this.db.prepare(`
      SELECT id, user_id, token_hash, refresh_token_hash,
             expires_at, refresh_expires_at, created_at, last_activity_at,
             ip_address, user_agent, status
      FROM sessions
      WHERE refresh_token_hash = ? AND status = 'active'
    `).get(refreshTokenHash)

    return row ? this.mapRowToSession(row) : null
  }

  /**
   * Update session's access token.
   * @param sessionId - Session ID
   * @param newAccessToken - New access token
   * @param expiresIn - New expiration duration in seconds
   */
  updateSessionToken(sessionId: string, newAccessToken: string, expiresIn: number): void {
    const tokenHash = this.jwtManager.hashToken(newAccessToken)
    const now = Date.now()

    this.db.prepare(`
      UPDATE sessions
      SET token_hash = ?,
          expires_at = ?,
          last_activity_at = ?
      WHERE id = ?
    `).run(tokenHash, now + expiresIn * 1000, now, sessionId)
  }

  /**
   * Update last activity timestamp.
   * @param sessionId - Session ID
   */
  updateActivity(sessionId: string): void {
    this.db.prepare(`
      UPDATE sessions
      SET last_activity_at = ?
      WHERE id = ?
    `).run(Date.now(), sessionId)
  }

  /**
   * Revoke a session (logout).
   * @param sessionId - Session ID to revoke
   */
  revokeSession(sessionId: string): void {
    this.db.prepare(`
      UPDATE sessions
      SET status = 'revoked'
      WHERE id = ?
    `).run(sessionId)
  }

  /**
   * Revoke all sessions for a user.
   * @param userId - User ID
   * @returns Number of revoked sessions
   */
  revokeAllUserSessions(userId: string): number {
    const result = this.db.prepare(`
      UPDATE sessions
      SET status = 'revoked'
      WHERE user_id = ? AND status = 'active'
    `).run(userId)

    return result.changes
  }

  /**
   * Get active sessions for a user.
   * @param userId - User ID
   * @returns Array of active sessions
   */
  getUserActiveSessions(userId: string): SessionInfo[] {
    const rows = this.db.prepare(`
      SELECT id, user_id, token_hash, refresh_token_hash,
             expires_at, refresh_expires_at, created_at, last_activity_at,
             ip_address, user_agent, status
      FROM sessions
      WHERE user_id = ? AND status = 'active'
      ORDER BY created_at DESC
    `).all(userId)

    return rows.map(row => this.mapRowToSession(row))
  }

  /**
   * Clean up expired sessions.
   * @returns Number of cleaned sessions
   */
  cleanupExpiredSessions(): number {
    const now = Date.now()
    const result = this.db.prepare(`
      DELETE FROM sessions
      WHERE status = 'active' AND expires_at < ?
    `).run(now)

    return result.changes
  }

  /**
   * Enforce maximum concurrent sessions per user.
   * Revokes oldest sessions if limit is exceeded.
   * @param userId - User ID
   * @param maxSessions - Maximum allowed concurrent sessions
   * @returns Number of revoked sessions
   */
  enforceSessionLimit(userId: string, maxSessions: number): number {
    const activeSessions = this.getUserActiveSessions(userId)

    if (activeSessions.length <= maxSessions) {
      return 0
    }

    // Sort by creation time, oldest first
    const sessionsToRevoke = activeSessions
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, activeSessions.length - maxSessions)

    let revokedCount = 0
    for (const session of sessionsToRevoke) {
      this.revokeSession(session.id)
      revokedCount++
    }

    return revokedCount
  }

  /**
   * Map database row to SessionInfo object.
   * @param row - Raw database row
   * @returns Typed SessionInfo object
   */
  private mapRowToSession(row: unknown): SessionInfo {
    const r = row as Record<string, unknown>
    return {
      id: r.id as string,
      userId: r.user_id as string,
      tokenHash: r.token_hash as string,
      refreshTokenHash: r.refresh_token_hash as string | null,
      expiresAt: r.expires_at as number,
      refreshExpiresAt: r.refresh_expires_at as number | null,
      createdAt: r.created_at as number,
      lastActivityAt: r.last_activity_at as number,
      ipAddress: r.ip_address as string | null,
      userAgent: r.user_agent as string | null,
      status: r.status as SessionInfo['status'],
    }
  }
}
