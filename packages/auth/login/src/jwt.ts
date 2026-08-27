/**
 * JWT token management for authentication.
 * @module @deepseek-ai/dsh-auth-login/jwt
 */

import { createHash, randomBytes } from 'node:crypto'
import jwt from 'jsonwebtoken'
import type { JwtPayload } from './types.ts'

/**
 * JWT token manager for signing and verifying tokens.
 */
export class JwtManager {
  private readonly secret: string
  private readonly expiresIn: string
  private readonly refreshExpiresIn: string
  private readonly issuer = 'deepseek-harness'
  private readonly audience = 'dsh-client'

  constructor(
    secret: string,
    expiresIn: string = '1h',
    refreshExpiresIn: string = '7d',
  ) {
    if (!secret || secret.length < 32) {
      throw new Error('JWT secret must be at least 32 characters')
    }
    this.secret = secret
    this.expiresIn = expiresIn
    this.refreshExpiresIn = refreshExpiresIn
  }

  /**
   * Generate a JWT access token.
   * @param payload - Token payload (without iat/exp)
   * @returns Signed JWT token string
   */
  generateAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, this.secret, {
      expiresIn: this.getExpiresInSeconds(),
      algorithm: 'HS256',
      issuer: this.issuer,
      audience: this.audience,
    })
  }

  /**
   * Generate a random refresh token.
   * @returns Refresh token string (prefixed with rt_)
   */
  generateRefreshToken(): string {
    const randomValue = randomBytes(32).toString('hex')
    return `rt_${randomValue}`
  }

  /**
   * Verify and decode a JWT token.
   * @param token - JWT token to verify
   * @returns Decoded token payload
   * @throws Error if token is invalid or expired
   */
  verifyToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, this.secret, {
        algorithms: ['HS256'],
        issuer: this.issuer,
        audience: this.audience,
      })

      if (typeof decoded === 'string') {
        throw new Error('Invalid token payload')
      }

      return decoded as JwtPayload
    } catch (error: unknown) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('AUTH_TOKEN_EXPIRED')
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('AUTH_TOKEN_INVALID')
      }
      throw error
    }
  }

  /**
   * Hash a token for secure storage.
   * Uses SHA-256 to create a one-way hash.
   * @param token - Token to hash
   * @returns Hex-encoded hash
   */
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  /**
   * Parse expiration time string to seconds.
   * @param expiresIn - Time string (e.g., "1h", "7d", "30m")
   * @returns Duration in seconds
   */
  parseExpiresIn(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/)
    const valueText = match?.[1]
    const unit = match?.[2]
    if (valueText === undefined || unit === undefined) {
      throw new Error(`Invalid expiresIn format: ${expiresIn}`)
    }

    const value = parseInt(valueText, 10)

    switch (unit) {
      case 's': return value
      case 'm': return value * 60
      case 'h': return value * 3600
      case 'd': return value * 86400
      default: throw new Error(`Invalid time unit: ${unit}`)
    }
  }

  /**
   * Get the access token expiration duration in seconds.
   * @returns Duration in seconds
   */
  getExpiresInSeconds(): number {
    return this.parseExpiresIn(this.expiresIn)
  }

  /**
   * Get the refresh token expiration duration in seconds.
   * @returns Duration in seconds
   */
  getRefreshExpiresInSeconds(): number {
    return this.parseExpiresIn(this.refreshExpiresIn)
  }
}
