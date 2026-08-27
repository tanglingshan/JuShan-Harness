/**
 * User registration service for DeepSeek Harness.
 * @module @deepseek-ai/dsh-auth-registration/service
 */

import type { Context } from '@deepseek-ai/cordis'
import { Service } from '@deepseek-ai/cordis'
import bcrypt from 'bcrypt'
import { validateRegisterParams } from './validator.ts'
import type { RegisterParams, RegisterResult } from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    registration: RegistrationService
  }
}

/**
 * Registration service configuration.
 */
export interface RegistrationConfig {
  /** bcrypt cost factor (default: 10) */
  bcryptRounds?: number
  /** Whether to allow registration (default: true) */
  enableRegistration?: boolean
}

const DEFAULT_CONFIG: Required<RegistrationConfig> = {
  bcryptRounds: 10,
  enableRegistration: true,
}

/**
 * Cordis service for user registration.
 * Handles parameter validation, password hashing, and user creation.
 */
export class RegistrationService extends Service {
  static readonly inject = ['user']
  private config: Required<RegistrationConfig>

  constructor(ctx: Context, config?: RegistrationConfig) {
    super(ctx, 'registration', true)
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Register a new user account.
   * @param params - Registration parameters
   * @returns Registration result with user info
   * @throws Error with codes:
   *   - AUTH_VALIDATION_ERROR: Invalid parameters
   *   - AUTH_USER_ALREADY_EXISTS: Username or email already exists
   *   - AUTH_REGISTRATION_DISABLED: Registration is disabled
   */
  async register(params: RegisterParams): Promise<RegisterResult> {
    // Check if registration is enabled
    if (!this.config.enableRegistration) {
      throw new Error('AUTH_REGISTRATION_DISABLED')
    }

    // Validate parameters using Schemastery
    const validated = validateRegisterParams(params)

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(validated.password, this.config.bcryptRounds)

    // Create user via UserService
    const user = await this.ctx.user.createUser({
      username: validated.username,
      email: validated.email,
      passwordHash,
    })

    // Return public registration result
    return {
      userId: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
    }
  }

  /**
   * Check if username is available.
   * @param username - Username to check
   * @returns True if available, false if taken
   */
  async isUsernameAvailable(username: string): Promise<boolean> {
    const existing = await this.ctx.user.getUserByUsername(username)
    return existing === null
  }

  /**
   * Check if email is available.
   * @param email - Email to check
   * @returns True if available, false if taken
   */
  async isEmailAvailable(email: string): Promise<boolean> {
    const existing = await this.ctx.user.getUserByEmail(email)
    return existing === null
  }

  /**
   * Validate registration parameters without creating account.
   * Useful for client-side validation feedback.
   * @param params - Parameters to validate
   * @returns Validation result with available checks
   */
  async validateRegistration(params: RegisterParams): Promise<{
    valid: boolean
    errors?: Array<{ field: string; message: string }>
  }> {
    const errors: Array<{ field: string; message: string }> = []

    // Schema validation
    try {
      validateRegisterParams(params)
    } catch (error: unknown) {
      errors.push({
        field: 'params',
        message: error instanceof Error ? error.message : 'Validation failed',
      })
      return { valid: false, errors }
    }

    // Check username availability
    const usernameAvailable = await this.isUsernameAvailable(params.username)
    if (!usernameAvailable) {
      errors.push({
        field: 'username',
        message: 'Username is already taken',
      })
    }

    // Check email availability
    const emailAvailable = await this.isEmailAvailable(params.email)
    if (!emailAvailable) {
      errors.push({
        field: 'email',
        message: 'Email is already registered',
      })
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    }
  }
}

export default RegistrationService
