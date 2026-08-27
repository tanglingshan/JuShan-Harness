/**
 * User management service for DeepSeek Harness authentication system.
 * @module @deepseek-ai/dsh-auth-user/service
 */

import type { Context } from '@deepseek-ai/cordis'
import { Service } from '@deepseek-ai/cordis'
import type { DatabaseSync } from 'node:sqlite'
import { UserStore } from './store.ts'
import type {
  User,
  CreateUserParams,
  UpdateUserParams,
  UserQuery,
  UserListResult,
  UserInfo,
} from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    user: UserService
  }
}

/**
 * User service configuration.
 */
export interface UserConfig {
  /** Path to SQLite database file */
  dbPath?: string
  /** Database instance (if already initialized) */
  database?: DatabaseSync
}

/**
 * Cordis service for user management.
 * Provides user CRUD operations and authentication support.
 */
export class UserService extends Service {
  static readonly inject = ['database']
  private store!: UserStore

  constructor(ctx: Context, config?: UserConfig) {
    super(ctx, 'user', true)

    // Initialize store with database from context or config
    ctx.on('ready', async () => {
      const db = config?.database ?? (ctx as unknown as { database?: DatabaseSync }).database
      if (!db) {
        throw new Error('UserService requires a database instance')
      }
      this.store = new UserStore(db)
      await this.initializeDatabase(db)
    })
  }

  /**
   * Initialize database schema if needed.
   * @param db - Database instance
   */
  private async initializeDatabase(db: DatabaseSync): Promise<void> {
    // Enable foreign keys
    db.exec('PRAGMA foreign_keys = ON')

    // Check if tables exist
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='users'
    `).get()

    if (!tableExists) {
      // Create schema from SQL file
      const schemaPath = new URL('../resources/sql/schema.sql', import.meta.url)
      const { readFileSync } = await import('node:fs')
      const schema = readFileSync(schemaPath, 'utf-8')
      db.exec(schema)
    }
  }

  /**
   * Create a new user account.
   * @param params - User creation parameters
   * @returns The newly created user
   * @throws Error with code AUTH_USER_ALREADY_EXISTS if username or email exists
   */
  async createUser(params: CreateUserParams): Promise<User> {
    // Check for existing username
    const existingUsername = this.store.getUserByUsername(params.username)
    if (existingUsername) {
      throw new Error('AUTH_USER_ALREADY_EXISTS')
    }

    // Check for existing email
    const existingEmail = this.store.getUserByEmail(params.email)
    if (existingEmail) {
      throw new Error('AUTH_USER_ALREADY_EXISTS')
    }

    return this.store.createUser(params)
  }

  /**
   * Get user by ID.
   * @param userId - User UUID
   * @returns User object or null if not found
   */
  async getUserById(userId: string): Promise<User | null> {
    return this.store.getUserById(userId)
  }

  /**
   * Get user by username.
   * @param username - Username to search for
   * @returns User object or null if not found
   */
  async getUserByUsername(username: string): Promise<User | null> {
    return this.store.getUserByUsername(username)
  }

  /**
   * Get user by email address.
   * @param email - Email to search for
   * @returns User object or null if not found
   */
  async getUserByEmail(email: string): Promise<User | null> {
    return this.store.getUserByEmail(email)
  }

  /**
   * Update user information.
   * @param params - Update parameters
   * @returns Updated user
   * @throws Error with code AUTH_USER_NOT_FOUND if user doesn't exist
   */
  async updateUser(params: UpdateUserParams): Promise<User> {
    // If updating email, check for conflicts
    if (params.email !== undefined) {
      const existing = this.store.getUserByEmail(params.email)
      if (existing && existing.id !== params.userId) {
        throw new Error('AUTH_USER_ALREADY_EXISTS')
      }
    }

    return this.store.updateUser(params)
  }

  /**
   * Delete a user (soft delete).
   * @param userId - User ID to delete
   * @throws Error with code AUTH_USER_NOT_FOUND if user doesn't exist
   */
  async deleteUser(userId: string): Promise<void> {
    return this.store.deleteUser(userId)
  }

  /**
   * List users with pagination and filtering.
   * @param query - Query parameters
   * @returns Paginated user list
   */
  async listUsers(query: UserQuery): Promise<UserListResult> {
    return this.store.listUsers(query)
  }

  /**
   * Update last login timestamp.
   * @param userId - User ID
   * @throws Error with code AUTH_USER_NOT_FOUND if user doesn't exist
   */
  async updateLastLogin(userId: string): Promise<void> {
    return this.store.updateLastLogin(userId)
  }

  /**
   * Convert User to public UserInfo (strips sensitive fields).
   * @param user - Full user object
   * @returns Public user information
   */
  toUserInfo(user: User): UserInfo {
    return {
      userId: user.id,
      username: user.username,
      email: user.email,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
    }
  }
}

export default UserService
