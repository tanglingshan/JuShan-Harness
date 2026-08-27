# DeepSeek Harness 认证系统 API 规范

## 概览

本文档定义了 DeepSeek Harness 认证系统的 Typert Remote 接口规范，遵循项目现有的 RPC 通信模式。

**协议版本**: 1.0.0
**传输层**: Typert Gateway over HTTP
**数据格式**: JSON
**认证方式**: JWT Bearer Token

---

## 通用规范

### 请求格式

所有 API 请求遵循 Typert Remote 调用规范：

```typescript
interface TypertRequest<T = unknown> {
  method: string           // 远程方法名
  params: T               // 方法参数
  context?: {             // 请求上下文
    sessionId?: string
    agentId?: string
  }
}
```

### 响应格式

统一返回结构：

```typescript
interface ApiResponse<T = unknown> {
  success: boolean        // 操作是否成功
  data?: T               // 成功时返回的数据
  error?: ApiError       // 失败时返回的错误信息
  timestamp: number      // 响应时间戳（毫秒）
}

interface ApiError {
  code: string           // 错误代码
  message: string        // 错误消息
  details?: unknown      // 详细错误信息
}
```

### 错误代码

| 代码 | 说明 | HTTP 状态码 |
|------|------|------------|
| `AUTH_INVALID_CREDENTIALS` | 用户名或密码错误 | 401 |
| `AUTH_USER_NOT_FOUND` | 用户不存在 | 404 |
| `AUTH_USER_ALREADY_EXISTS` | 用户名或邮箱已存在 | 409 |
| `AUTH_TOKEN_INVALID` | Token 无效或已过期 | 401 |
| `AUTH_TOKEN_EXPIRED` | Token 已过期 | 401 |
| `AUTH_SESSION_NOT_FOUND` | 会话不存在 | 404 |
| `AUTH_VALIDATION_ERROR` | 参数校验失败 | 400 |
| `AUTH_PERMISSION_DENIED` | 权限不足 | 403 |
| `AUTH_ACCOUNT_SUSPENDED` | 账户已被暂停 | 403 |
| `AUTH_ACCOUNT_DELETED` | 账户已被删除 | 410 |
| `AUTH_INTERNAL_ERROR` | 内部服务错误 | 500 |

---

## 接口定义

### 1. 用户注册

**方法名**: `auth/register`

**功能**: 创建新用户账户

#### 请求参数

```typescript
interface RegisterParams {
  username: string       // 用户名（3-50字符，字母数字下划线）
  email: string         // 邮箱地址（有效格式）
  password: string      // 密码（8-128字符）
}
```

#### 参数校验规则

```typescript
const RegisterSchema = Schema.object({
  username: Schema.string()
    .min(3).max(50)
    .pattern(/^[a-zA-Z0-9_]+$/)
    .required(),
  email: Schema.string()
    .pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
    .max(255)
    .required(),
  password: Schema.string()
    .min(8).max(128)
    .required()
})
```

#### 响应数据

```typescript
interface RegisterResponse {
  userId: string        // 新创建的用户 ID
  username: string      // 用户名
  email: string        // 邮箱
  createdAt: number    // 创建时间戳
}
```

#### 示例

**请求**:
```json
{
  "method": "auth/register",
  "params": {
    "username": "alice",
    "email": "alice@example.com",
    "password": "SecurePass123!"
  }
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "username": "alice",
    "email": "alice@example.com",
    "createdAt": 1724832000000
  },
  "timestamp": 1724832001000
}
```

---

### 2. 用户登录

**方法名**: `auth/login`

**功能**: 验证用户凭证并生成 JWT token

#### 请求参数

```typescript
interface LoginParams {
  username: string      // 用户名或邮箱
  password: string      // 密码
  rememberMe?: boolean  // 是否保持登录（影响 token 有效期）
}
```

#### 参数校验规则

```typescript
const LoginSchema = Schema.object({
  username: Schema.string()
    .min(3).max(255)
    .required(),
  password: Schema.string()
    .min(1).max(128)
    .required(),
  rememberMe: Schema.boolean()
    .default(false)
})
```

#### 响应数据

```typescript
interface LoginResponse {
  userId: string          // 用户 ID
  username: string        // 用户名
  email: string          // 邮箱
  accessToken: string    // JWT 访问令牌
  refreshToken: string   // 刷新令牌
  expiresIn: number      // token 有效期（秒）
  tokenType: 'Bearer'    // token 类型
}
```

#### JWT Payload 结构

```typescript
interface JwtPayload {
  sub: string           // 用户 ID (subject)
  username: string      // 用户名
  email: string        // 邮箱
  sessionId: string    // 会话 ID
  iat: number          // 签发时间 (issued at)
  exp: number          // 过期时间 (expiration)
}
```

#### 示例

**请求**:
```json
{
  "method": "auth/login",
  "params": {
    "username": "alice",
    "password": "SecurePass123!",
    "rememberMe": true
  }
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "username": "alice",
    "email": "alice@example.com",
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "rt_a3f5b8c9d1e2f3a4b5c6d7e8f9a0b1c2",
    "expiresIn": 86400,
    "tokenType": "Bearer"
  },
  "timestamp": 1724832000000
}
```

---

### 3. 刷新 Token

**方法名**: `auth/refresh`

**功能**: 使用刷新令牌获取新的访问令牌

#### 请求参数

```typescript
interface RefreshParams {
  refreshToken: string   // 刷新令牌
}
```

#### 响应数据

```typescript
interface RefreshResponse {
  accessToken: string    // 新的 JWT 访问令牌
  expiresIn: number      // token 有效期（秒）
  tokenType: 'Bearer'    // token 类型
}
```

#### 示例

**请求**:
```json
{
  "method": "auth/refresh",
  "params": {
    "refreshToken": "rt_a3f5b8c9d1e2f3a4b5c6d7e8f9a0b1c2"
  }
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "tokenType": "Bearer"
  },
  "timestamp": 1724832000000
}
```

---

### 4. 登出

**方法名**: `auth/logout`

**功能**: 撤销当前会话

#### 请求参数

```typescript
interface LogoutParams {
  sessionId?: string     // 会话 ID（可选，默认当前会话）
}
```

#### 响应数据

```typescript
interface LogoutResponse {
  message: string        // 确认消息
}
```

#### 示例

**请求**:
```json
{
  "method": "auth/logout",
  "params": {}
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  },
  "timestamp": 1724832000000
}
```

---

### 5. 获取用户信息

**方法名**: `auth/getUser`

**功能**: 查询指定用户的公开信息

#### 请求参数

```typescript
interface GetUserParams {
  userId: string         // 用户 ID
}
```

#### 参数校验规则

```typescript
const GetUserSchema = Schema.object({
  userId: Schema.string()
    .pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    .required()
})
```

#### 响应数据

```typescript
interface UserInfo {
  userId: string         // 用户 ID
  username: string       // 用户名
  email: string         // 邮箱
  status: 'active' | 'inactive' | 'suspended' | 'deleted'
  createdAt: number     // 创建时间戳
  updatedAt: number     // 更新时间戳
  lastLoginAt?: number  // 最后登录时间戳
}
```

#### 示例

**请求**:
```json
{
  "method": "auth/getUser",
  "params": {
    "userId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "username": "alice",
    "email": "alice@example.com",
    "status": "active",
    "createdAt": 1724832000000,
    "updatedAt": 1724832000000,
    "lastLoginAt": 1724835600000
  },
  "timestamp": 1724836000000
}
```

---

### 6. 获取当前用户信息

**方法名**: `auth/getCurrentUser`

**功能**: 获取当前登录用户的信息

#### 请求参数

无参数（从 JWT token 中提取用户信息）

#### 响应数据

```typescript
interface CurrentUserInfo extends UserInfo {
  sessionId: string      // 当前会话 ID
  sessionExpiresAt: number  // 会话过期时间
}
```

#### 示例

**请求**:
```json
{
  "method": "auth/getCurrentUser",
  "params": {}
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "username": "alice",
    "email": "alice@example.com",
    "status": "active",
    "createdAt": 1724832000000,
    "updatedAt": 1724832000000,
    "lastLoginAt": 1724835600000,
    "sessionId": "660e8400-e29b-41d4-a716-446655440001",
    "sessionExpiresAt": 1724918400000
  },
  "timestamp": 1724836000000
}
```

---

### 7. 用户列表查询

**方法名**: `auth/listUsers`

**功能**: 分页查询用户列表

#### 请求参数

```typescript
interface ListUsersParams {
  page?: number          // 页码（从 1 开始，默认 1）
  pageSize?: number      // 每页数量（默认 20，最大 100）
  status?: 'active' | 'inactive' | 'suspended' | 'deleted'
  sortBy?: 'createdAt' | 'updatedAt' | 'lastLoginAt' | 'username'
  sortOrder?: 'asc' | 'desc'
}
```

#### 参数校验规则

```typescript
const ListUsersSchema = Schema.object({
  page: Schema.number()
    .min(1)
    .default(1),
  pageSize: Schema.number()
    .min(1).max(100)
    .default(20),
  status: Schema.union([
    Schema.const('active'),
    Schema.const('inactive'),
    Schema.const('suspended'),
    Schema.const('deleted')
  ]).optional(),
  sortBy: Schema.union([
    Schema.const('createdAt'),
    Schema.const('updatedAt'),
    Schema.const('lastLoginAt'),
    Schema.const('username')
  ]).default('createdAt'),
  sortOrder: Schema.union([
    Schema.const('asc'),
    Schema.const('desc')
  ]).default('desc')
})
```

#### 响应数据

```typescript
interface ListUsersResponse {
  users: UserInfo[]      // 用户列表
  pagination: {
    page: number         // 当前页码
    pageSize: number     // 每页数量
    total: number        // 总记录数
    totalPages: number   // 总页数
    hasNext: boolean     // 是否有下一页
    hasPrev: boolean     // 是否有上一页
  }
}
```

#### 示例

**请求**:
```json
{
  "method": "auth/listUsers",
  "params": {
    "page": 1,
    "pageSize": 20,
    "status": "active",
    "sortBy": "createdAt",
    "sortOrder": "desc"
  }
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "userId": "550e8400-e29b-41d4-a716-446655440000",
        "username": "alice",
        "email": "alice@example.com",
        "status": "active",
        "createdAt": 1724832000000,
        "updatedAt": 1724832000000,
        "lastLoginAt": 1724835600000
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 1,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  },
  "timestamp": 1724836000000
}
```

---

### 8. 更新用户信息

**方法名**: `auth/updateUser`

**功能**: 更新用户信息（需要管理员权限或本人）

#### 请求参数

```typescript
interface UpdateUserParams {
  userId: string         // 用户 ID
  email?: string        // 新邮箱（可选）
  status?: 'active' | 'inactive' | 'suspended' | 'deleted'  // 新状态（可选）
}
```

#### 响应数据

```typescript
interface UpdateUserResponse {
  userId: string         // 用户 ID
  updatedFields: string[] // 更新的字段列表
  updatedAt: number      // 更新时间戳
}
```

#### 示例

**请求**:
```json
{
  "method": "auth/updateUser",
  "params": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "email": "alice.new@example.com"
  }
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "updatedFields": ["email", "updatedAt"],
    "updatedAt": 1724840000000
  },
  "timestamp": 1724840000000
}
```

---

### 9. 修改密码

**方法名**: `auth/changePassword`

**功能**: 修改当前用户密码

#### 请求参数

```typescript
interface ChangePasswordParams {
  currentPassword: string  // 当前密码
  newPassword: string      // 新密码
}
```

#### 参数校验规则

```typescript
const ChangePasswordSchema = Schema.object({
  currentPassword: Schema.string()
    .min(1).max(128)
    .required(),
  newPassword: Schema.string()
    .min(8).max(128)
    .required()
})
```

#### 响应数据

```typescript
interface ChangePasswordResponse {
  message: string          // 确认消息
  updatedAt: number        // 更新时间戳
}
```

#### 示例

**请求**:
```json
{
  "method": "auth/changePassword",
  "params": {
    "currentPassword": "SecurePass123!",
    "newPassword": "NewSecurePass456!"
  }
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "message": "Password changed successfully",
    "updatedAt": 1724840000000
  },
  "timestamp": 1724840000000
}
```

---

### 10. 验证 Token

**方法名**: `auth/verifyToken`

**功能**: 验证 JWT token 的有效性

#### 请求参数

```typescript
interface VerifyTokenParams {
  token: string          // JWT token
}
```

#### 响应数据

```typescript
interface VerifyTokenResponse {
  valid: boolean         // token 是否有效
  payload?: JwtPayload   // token payload（有效时返回）
  expiresAt?: number     // 过期时间（有效时返回）
}
```

#### 示例

**请求**:
```json
{
  "method": "auth/verifyToken",
  "params": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "payload": {
      "sub": "550e8400-e29b-41d4-a716-446655440000",
      "username": "alice",
      "email": "alice@example.com",
      "sessionId": "660e8400-e29b-41d4-a716-446655440001",
      "iat": 1724832000,
      "exp": 1724918400
    },
    "expiresAt": 1724918400000
  },
  "timestamp": 1724836000000
}
```

---

## 安全规范

### JWT Token 配置

```typescript
const JWT_CONFIG = {
  algorithm: 'HS256',           // 签名算法
  expiresIn: '1h',             // 访问令牌有效期（1小时）
  refreshExpiresIn: '7d',      // 刷新令牌有效期（7天）
  rememberMeExpiresIn: '30d',  // 记住我模式有效期（30天）
  issuer: 'deepseek-harness',  // 签发者
  audience: 'dsh-client'       // 受众
}
```

### 密码策略

```typescript
const PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: false,     // 不强制要求大写字母
  requireLowercase: false,     // 不强制要求小写字母
  requireNumbers: false,       // 不强制要求数字
  requireSpecialChars: false,  // 不强制要求特殊字符
  bcryptRounds: 10            // bcrypt cost factor
}
```

### 请求限流

```typescript
const RATE_LIMITS = {
  'auth/register': {
    windowMs: 3600000,         // 1小时
    max: 5                     // 最多 5 次
  },
  'auth/login': {
    windowMs: 900000,          // 15分钟
    max: 10                    // 最多 10 次
  },
  'auth/refresh': {
    windowMs: 60000,           // 1分钟
    max: 30                    // 最多 30 次
  }
}
```

### 会话管理

```typescript
const SESSION_CONFIG = {
  maxConcurrentSessions: 5,    // 单用户最大并发会话数
  cleanupInterval: 3600000,    // 过期会话清理间隔（1小时）
  activityTimeout: 1800000     // 无活动超时时间（30分钟）
}
```

---

## 中间件集成

### 认证中间件

在需要认证的 Typert Remote 方法中使用：

```typescript
import type { Context } from '@deepseek-ai/cordis'

export async function authMiddleware(ctx: Context, next: () => Promise<void>) {
  const token = ctx.request.headers.authorization?.replace('Bearer ', '')

  if (!token) {
    throw new Error('AUTH_TOKEN_INVALID')
  }

  const verification = await ctx.auth.verifyToken(token)

  if (!verification.valid) {
    throw new Error('AUTH_TOKEN_EXPIRED')
  }

  ctx.userId = verification.payload.sub
  ctx.sessionId = verification.payload.sessionId

  await next()
}
```

### 使用示例

```typescript
ctx.typert.method('protected/someMethod', async (params) => {
  // 自动通过中间件验证认证
  const userId = ctx.userId  // 从 JWT 提取
  // ... 业务逻辑
})
```

---

## 错误处理

### 错误响应示例

```json
{
  "success": false,
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "用户名或密码错误",
    "details": {
      "field": "password",
      "attempt": 3,
      "maxAttempts": 10
    }
  },
  "timestamp": 1724836000000
}
```

### 参数校验错误

```json
{
  "success": false,
  "error": {
    "code": "AUTH_VALIDATION_ERROR",
    "message": "参数校验失败",
    "details": {
      "field": "email",
      "value": "invalid-email",
      "constraint": "必须是有效的邮箱格式"
    }
  },
  "timestamp": 1724836000000
}
```

---

## 相关文件

- **架构文档**: `packages/auth/README.md`
- **数据库设计**: `packages/auth/DATABASE.md`
- **包配置**: `packages/auth/*/package.json`
