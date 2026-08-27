import type { LoginRequest, RegisterRequest, LoginResponse, User, UserListResponse } from '../types/auth'

const API_BASE = '/api/auth'
const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

export class AuthService {
  private token: string | null = null

  constructor() {
    this.token = this.getStoredToken()
  }

  private getStoredToken(): string | null {
    return localStorage.getItem(TOKEN_KEY)
  }

  private setStoredToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token)
    this.token = token
  }

  private clearStoredToken(): void {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    this.token = null
  }

  getToken(): string | null {
    return this.token
  }

  isAuthenticated(): boolean {
    return this.token !== null
  }

  async login(request: LoginRequest): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Login failed')
    }

    const data: LoginResponse = await response.json()
    this.setStoredToken(data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.user))
    return data
  }

  async register(request: RegisterRequest): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Registration failed')
    }

    const data: LoginResponse = await response.json()
    this.setStoredToken(data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.user))
    return data
  }

  async logout(): Promise<void> {
    if (!this.token) return

    try {
      await fetch(`${API_BASE}/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
        },
      })
    } finally {
      this.clearStoredToken()
    }
  }

  async getUser(userId: string): Promise<User> {
    const response = await fetch(`${API_BASE}/user/${userId}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to fetch user')
    }

    return response.json()
  }

  async getUserList(page: number = 1, pageSize: number = 20): Promise<UserListResponse> {
    const response = await fetch(`${API_BASE}/users?page=${page}&pageSize=${pageSize}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to fetch users')
    }

    return response.json()
  }

  getCurrentUser(): User | null {
    const userData = localStorage.getItem(USER_KEY)
    return userData ? JSON.parse(userData) : null
  }
}

export const authService = new AuthService()
