/**
 * Registration service index - exports main service and types.
 * @module @deepseek-ai/dsh-auth-registration
 */

export * from './types.ts'
export { RegistrationService, type RegistrationConfig } from './service.ts'
export { validateRegisterParams, RegisterSchema } from './validator.ts'
export { default } from './service.ts'
