/**
 * Type definitions for DeepSeek Harness registration service.
 * @module @deepseek-ai/dsh-auth-registration/types
 */

/** Registration request parameters */
export interface RegisterParams {
  /** Username (3-50 characters, alphanumeric + underscore) */
  username: string
  /** Email address */
  email: string
  /** Plain text password (8-128 characters) */
  password: string
}

/** Registration success response */
export interface RegisterResult {
  /** Newly created user ID */
  userId: string
  username: string
  email: string
  /** Account creation timestamp (milliseconds) */
  createdAt: number
}

/** Registration validation error details */
export interface ValidationError {
  field: string
  value: unknown
  constraint: string
}
