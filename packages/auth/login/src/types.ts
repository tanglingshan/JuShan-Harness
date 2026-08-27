/**
 * Type definitions for DeepSeek Harness login service.
 * @module @deepseek-ai/dsh-auth-login/types
 */

/** Login request parameters */
export interface LoginParams {
  /** Username or email */
  username: string
  /** Plain text password */
  password: string
  /** Remember me flag (extends token validity) */
  rememberMe?: boolean
}

/** Login success response */
export interface LoginResult {
  userId: string
  username: string
  email: string
  /** JWT access token */
  accessToken: string
  /** Refresh token for obtaining new access tokens */
  refreshToken: string
  /** Token expiration time in seconds */
  expiresIn: number
  /** Token type (always "Bearer") */
  tokenType: 'Bearer'
}

/** JWT token payload structure */
export interface JwtPayload {
  /** Subject (user ID) */
  sub: string
  username: string
  email: string
  sessionId: string
  /** Issued at timestamp (seconds) */
  iat: number
  /** Expiration timestamp (seconds) */
  exp: number
}

/** Session status enumeration */
export type SessionStatus = 'active' | 'expired' | 'revoked'

/** Session entity stored in database */
export interface SessionInfo {
  /** Session ID (UUID) */
  id: string
  /** Associated user ID */
  userId: string
  /** SHA-256 hash of access token */
  tokenHash: string
  /** SHA-256 hash of refresh token */
  refreshTokenHash: string | null
  /** Access token expiration timestamp (milliseconds) */
  expiresAt: number
  /** Refresh token expiration timestamp (milliseconds) */
  refreshExpiresAt: number | null
  /** Session creation timestamp (milliseconds) */
  createdAt: number
  /** Last activity timestamp (milliseconds) */
  lastActivityAt: number
  /** Client IP address */
  ipAddress: string | null
  /** Client user agent string */
  userAgent: string | null
  /** Session status */
  status: SessionStatus
}

/** Token verification result */
export interface TokenVerificationResult {
  /** Whether the token is valid */
  valid: boolean
  /** Decoded payload (only if valid) */
  payload?: JwtPayload
  /** Expiration timestamp in milliseconds (only if valid) */
  expiresAt?: number
}

/** Refresh token request parameters */
export interface RefreshTokenParams {
  refreshToken: string
}

/** Refresh token response */
export interface RefreshTokenResult {
  /** New access token */
  accessToken: string
  /** Token expiration time in seconds */
  expiresIn: number
  /** Token type */
  tokenType: 'Bearer'
}

/** Login service configuration */
export interface LoginConfig {
  /** JWT signing secret */
  jwtSecret: string
  /** Access token validity period (e.g., "1h", "15m") */
  jwtExpiresIn?: string
  /** Refresh token validity period (e.g., "7d", "30d") */
  jwtRefreshExpiresIn?: string
  /** Remember me token validity period */
  rememberMeExpiresIn?: string
  /** bcrypt cost factor */
  bcryptRounds?: number
  /** Maximum concurrent sessions per user */
  sessionMaxConcurrent?: number
}
