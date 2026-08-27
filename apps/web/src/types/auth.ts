export interface User {
  userId: string
  username: string
  email: string
  createdAt: string
  avatar?: string
}

export interface LoginRequest {
  username: string
  password: string
  rememberMe?: boolean
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
}

export interface LoginResponse {
  token: string
  user: User
}

export interface AuthError {
  message: string
  code?: string
}

export interface UserListResponse {
  users: User[]
  total: number
  page: number
  pageSize: number
}
