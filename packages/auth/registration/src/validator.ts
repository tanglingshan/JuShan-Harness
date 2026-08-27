/**
 * Registration parameter validation using Schemastery.
 * @module @deepseek-ai/dsh-auth-registration/validator
 */

import Schema from '@deepseek-ai/schemastery'
import type { RegisterParams } from './types.ts'

/**
 * Schema for registration parameters.
 * Validates username, email, and password requirements.
 */
export const RegisterSchema = Schema.object({
  username: Schema.string()
    .min(3)
    .max(50)
    .pattern(/^[a-zA-Z0-9_]+$/)
    .required()
    .description('Username: 3-50 characters, alphanumeric and underscore only'),

  email: Schema.string()
    .pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
    .max(255)
    .required()
    .description('Valid email address'),

  password: Schema.string()
    .min(8)
    .max(128)
    .required()
    .description('Password: 8-128 characters'),
})

/**
 * Validate registration parameters against schema.
 * @param params - Raw registration parameters
 * @returns Validated parameters
 * @throws Error with validation details if invalid
 */
export function validateRegisterParams(params: unknown): RegisterParams {
  try {
    return RegisterSchema(params as RegisterParams)
  } catch (error: unknown) {
    // Wrap schema validation error with AUTH_VALIDATION_ERROR code
    const validationError = new Error('AUTH_VALIDATION_ERROR')
    Object.assign(validationError, { cause: error })
    throw validationError
  }
}

/**
 * Validate username format.
 * @param username - Username to validate
 * @returns True if valid
 */
export function isValidUsername(username: string): boolean {
  if (username.length < 3 || username.length > 50) {
    return false
  }
  return /^[a-zA-Z0-9_]+$/.test(username)
}

/**
 * Validate email format.
 * @param email - Email to validate
 * @returns True if valid
 */
export function isValidEmail(email: string): boolean {
  if (email.length > 255) {
    return false
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * Validate password strength.
 * @param password - Password to validate
 * @returns True if valid
 */
export function isValidPassword(password: string): boolean {
  return password.length >= 8 && password.length <= 128
}

/**
 * Check password strength and return a score.
 * @param password - Password to check
 * @returns Strength score (0-4: weak to very strong)
 */
export function getPasswordStrength(password: string): number {
  let score = 0

  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++

  return Math.min(score, 4)
}
