/**
 * User data access layer with SQLite operations.
 * @module @deepseek-ai/dsh-auth-user/store
 */

import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type {
  User,
  CreateUserParams,
  UpdateUserParams,
  UserQuery,
  UserListResult,
} from './types.ts'

/**
 * SQLite-based user data store.
 * Handles all database operations for user management.
 */
export class UserStore {
  constructor(private readonly db: DatabaseSync) {}

  /**
   * Create a new user account.
   * @param params - User creation parameters
   * @returns The newly created user
   * @throws Error if username or email already exists
   */
  createUser(params: CreateUserParams): User {
    const id = randomUUID()
    const now = Date.now()

    const user: User = {
      id,
      username: params.username,
      email: params.email,
      passwordHash: params.passwordHash,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    }

    this.db.prepare(`
      INSERT INTO users (
        id, username, email, password_hash, status,
        created_at, updated_at, last_login_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user.id,
      user.username,
      user.email,
      user.passwordHash,
      user.status,
      user.createdAt,
      user.updatedAt,
      user.lastLoginAt,
    )

    return user
  }

  /**
   * Retrieve a user by their unique ID.
   * @param userId - User UUID
   * @returns User object or null if not found
   */
  getUserById(userId: string): User | null {
    const row = this.db.prepare(`
      SELECT id, username, email, password_hash, status,
             created_at, updated_at, last_login_at
      FROM users
      WHERE id = ?
    `).get(userId)

    return row ? this.mapRowToUser(row) : null
  }

  /**
   * Retrieve a user by their username.
   * @param username - Username to search for
   * @returns User object or null if not found
   */
  getUserByUsername(username: string): User | null {
    const row = this.db.prepare(`
      SELECT id, username, email, password_hash, status,
             created_at, updated_at, last_login_at
      FROM users
      WHERE username = ?
    `).get(username)

    return row ? this.mapRowToUser(row) : null
  }

  /**
   * Retrieve a user by their email address.
   * @param email - Email to search for
   * @returns User object or null if not found
   */
  getUserByEmail(email: string): User | null {
    const row = this.db.prepare(`
      SELECT id, username, email, password_hash, status,
             created_at, updated_at, last_login_at
      FROM users
      WHERE email = ?
    `).get(email)

    return row ? this.mapRowToUser(row) : null
  }

  /**
   * Update user information.
   * @param params - Update parameters
   * @returns Updated user object
   * @throws Error if user not found
   */
  updateUser(params: UpdateUserParams): User {
    const updates: string[] = []
    const values: unknown[] = []

    if (params.email !== undefined) {
      updates.push('email = ?')
      values.push(params.email)
    }

    if (params.status !== undefined) {
      updates.push('status = ?')
      values.push(params.status)
    }

    if (params.passwordHash !== undefined) {
      updates.push('password_hash = ?')
      values.push(params.passwordHash)
    }

    if (updates.length === 0) {
      const user = this.getUserById(params.userId)
      if (!user) {
        throw new Error('AUTH_USER_NOT_FOUND')
      }
      return user
    }

    const now = Date.now()
    updates.push('updated_at = ?')
    values.push(now)
    values.push(params.userId)

    const result = this.db.prepare(`
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values)

    if (result.changes === 0) {
      throw new Error('AUTH_USER_NOT_FOUND')
    }

    const user = this.getUserById(params.userId)
    if (!user) {
      throw new Error('AUTH_USER_NOT_FOUND')
    }

    return user
  }

  /**
   * Delete a user (soft delete by setting status to 'deleted').
   * @param userId - User ID to delete
   * @throws Error if user not found
   */
  deleteUser(userId: string): void {
    const result = this.db.prepare(`
      UPDATE users
      SET status = 'deleted', updated_at = ?
      WHERE id = ?
    `).run(Date.now(), userId)

    if (result.changes === 0) {
      throw new Error('AUTH_USER_NOT_FOUND')
    }
  }

  /**
   * List users with pagination and filtering.
   * @param query - Query parameters
   * @returns Paginated user list
   */
  listUsers(query: UserQuery): UserListResult {
    const page = query.page ?? 1
    const pageSize = Math.min(query.pageSize ?? 20, 100)
    const offset = (page - 1) * pageSize
    const sortBy = query.sortBy ?? 'createdAt'
    const sortOrder = query.sortOrder ?? 'desc'

    let whereClause = ''
    const whereParams: unknown[] = []

    if (query.status !== undefined) {
      whereClause = 'WHERE status = ?'
      whereParams.push(query.status)
    }

    const countRow = this.db.prepare(`
      SELECT COUNT(*) as total
      FROM users
      ${whereClause}
    `).get(...whereParams) as { total: number }

    const total = countRow.total

    const rows = this.db.prepare(`
      SELECT id, username, email, password_hash, status,
             created_at, updated_at, last_login_at
      FROM users
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder.toUpperCase()}
      LIMIT ? OFFSET ?
    `).all(...whereParams, pageSize, offset)

    const users = rows.map(row => this.mapRowToUser(row))
    const totalPages = Math.ceil(total / pageSize)

    return {
      users,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    }
  }

  /**
   * Update the last login timestamp for a user.
   * @param userId - User ID
   * @throws Error if user not found
   */
  updateLastLogin(userId: string): void {
    const now = Date.now()
    const result = this.db.prepare(`
      UPDATE users
      SET last_login_at = ?, updated_at = ?
      WHERE id = ?
    `).run(now, now, userId)

    if (result.changes === 0) {
      throw new Error('AUTH_USER_NOT_FOUND')
    }
  }

  /**
   * Map database row to User object.
   * @param row - Raw database row
   * @returns Typed User object
   */
  private mapRowToUser(row: unknown): User {
    const r = row as Record<string, unknown>
    return {
      id: r.id as string,
      username: r.username as string,
      email: r.email as string,
      passwordHash: r.password_hash as string,
      status: r.status as User['status'],
      createdAt: r.created_at as number,
      updatedAt: r.updated_at as number,
      lastLoginAt: r.last_login_at as number | null,
    }
  }
}
