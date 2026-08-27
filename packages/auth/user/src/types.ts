/**
 * Type definitions for DeepSeek Harness authentication system.
 * @module @deepseek-ai/dsh-auth-user/types
 */

/** User account status enumeration */
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'deleted'

/** Core user entity */
export interface User {
  /** Unique user identifier (UUID v4) */
  id: string
  /** Username (3-50 characters, alphanumeric + underscore) */
  username: string
  /** Email address */
  email: string
  /** bcrypt password hash */
  passwordHash: string
  /** Account status */
  status: UserStatus
  /** Creation timestamp (milliseconds) */
  createdAt: number
  /** Last update timestamp (milliseconds) */
  updatedAt: number
  /** Last login timestamp (milliseconds, nullable) */
  lastLoginAt: number | null
}

/** Parameters for creating a new user */
export interface CreateUserParams {
  username: string
  email: string
  passwordHash: string
}

/** Parameters for updating user information */
export interface UpdateUserParams {
  userId: string
  email?: string
  status?: UserStatus
  passwordHash?: string
}

/** User query parameters for listing */
export interface UserQuery {
  /** Page number (1-based) */
  page?: number
  /** Items per page */
  pageSize?: number
  /** Filter by status */
  status?: UserStatus
  /** Sort field */
  sortBy?: 'createdAt' | 'updatedAt' | 'lastLoginAt' | 'username'
  /** Sort direction */
  sortOrder?: 'asc' | 'desc'
}

/** Paginated user list result */
export interface UserListResult {
  users: User[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

/** Public user information (excludes sensitive fields) */
export interface UserInfo {
  userId: string
  username: string
  email: string
  status: UserStatus
  createdAt: number
  updatedAt: number
  lastLoginAt: number | null
}
