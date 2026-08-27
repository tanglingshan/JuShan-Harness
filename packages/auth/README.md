# DeepSeek Harness 认证系统架构设计

## 概览

DeepSeek Harness 认证系统是一个基于 Cordis 插件架构的模块化用户认证解决方案，提供用户注册、登录、会话管理和权限控制功能。

**设计原则**：
- **Everything is a Plugin**：遵循 Cordis 插件系统，所有功能模块化
- **类型安全**：完全使用 TypeScript + ESM
- **数据持久化**：基于 SQLite，参考 session-persistence-sqlite 模式
- **RPC 通信**：使用 Typert Gateway 进行远程调用
- **安全优先**：bcrypt 密码加密 + JWT token + 参数校验

---

## 系统架构

### 模块划分

```
packages/auth/
├── user/                    # 用户管理核心模块
│   ├── src/
│   │   ├── index.ts        # 用户服务主入口
│   │   ├── store.ts        # SQLite 数据访问层
│   │   ├── schema.ts       # 数据库表结构定义
│   │   ├── types.ts        # 用户相关类型定义
│   │   └── invariant.ts    # 运行时断言
│   ├── resources/sql/
│   │   └── schema.sql      # 数据库 DDL
│   ├── tests/              # 单元测试
│   ├── package.json
│   └── tsconfig.json
│
├── login/                   # 登录认证模块
│   ├── src/
│   │   ├── index.ts        # 登录服务主入口
│   │   ├── jwt.ts          # JWT token 生成与验证
│   │   ├── session.ts      # 会话管理
│   │   └── invariant.ts
│   ├── tests/
│   ├── package.json
│   └── tsconfig.json
│
├── registration/            # 注册服务模块
│   ├── src/
│   │   ├── index.ts        # 注册服务主入口
│   │   ├── validator.ts    # 参数校验
│   │   └── invariant.ts
│   ├── tests/
│   ├── package.json
│   └── tsconfig.json
│
├── README.md               # 架构设计文档（本文件）
├── DATABASE.md             # 数据库设计文档
└── API.md                  # 接口规范文档
```

### 依赖关系

```
┌─────────────────┐
│  registration   │
│  (注册服务)      │
└────────┬────────┘
         │
         ├──────────┐
         │          │
         v          v
┌────────────┐  ┌──────────┐
│   login    │  │   user   │
│ (登录认证)  │──>│ (用户管理)│
└────────────┘  └──────────┘
                     │
                     v
              ┌─────────────┐
              │   SQLite    │
              │ (数据持久化) │
              └─────────────┘
```

**依赖说明**：
- `registration` 依赖 `user` 进行用户创建
- `login` 依赖 `user` 进行用户查询和验证
- `user` 是核心模块，负责所有数据库操作
- 所有模块依赖 `@deepseek-ai/cordis` 和 `@deepseek-ai/schemastery`

---

## 核心模块设计

### 1. User 模块（用户管理）

**职责**：
- 用户 CRUD 操作
- SQLite 数据库访问层
- 密码哈希存储
- 用户状态管理

**核心接口**：

```typescript
// packages/auth/user/src/types.ts
export interface User {
  id: string                  // UUID
  username: string
  email: string
  passwordHash: string
  status: 'active' | 'inactive' | 'suspended' | 'deleted'
  createdAt: number
  updatedAt: number
  lastLoginAt: number | null
}

export interface CreateUserParams {
  username: string
  email: string
  passwordHash: string
}

export interface UpdateUserParams {
  userId: string
  email?: string
  status?: User['status']
}

export interface UserQuery {
  page?: number
  pageSize?: number
  status?: User['status']
  sortBy?: 'createdAt' | 'updatedAt' | 'username'
  sortOrder?: 'asc' | 'desc'
}
```

**数据库操作**：

```typescript
// packages/auth/user/src/store.ts
export class UserStore {
  constructor(private db: DatabaseSync) {}

  async createUser(params: CreateUserParams): Promise<User>
  async getUserById(userId: string): Promise<User | null>
  async getUserByUsername(username: string): Promise<User | null>
  async getUserByEmail(email: string): Promise<User | null>
  async updateUser(params: UpdateUserParams): Promise<User>
  async deleteUser(userId: string): Promise<void>
  async listUsers(query: UserQuery): Promise<{ users: User[], total: number }>
  async updateLastLogin(userId: string): Promise<void>
}
```

**Cordis 插件集成**：

```typescript
// packages/auth/user/src/index.ts
import { Context, Service } from '@deepseek-ai/cordis'
import { UserStore } from './store.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    user: UserService
  }
}

export class UserService extends Service {
  private store: UserStore

  constructor(ctx: Context) {
    super(ctx, 'user', true)
    this.store = new UserStore(ctx.database)
  }

  async createUser(params: CreateUserParams): Promise<User> {
    // 校验用户名和邮箱唯一性
    const existingUsername = await this.store.getUserByUsername(params.username)
    if (existingUsername) {
      throw new Error('AUTH_USER_ALREADY_EXISTS')
    }

    const existingEmail = await this.store.getUserByEmail(params.email)
    if (existingEmail) {
      throw new Error('AUTH_USER_ALREADY_EXISTS')
    }

    return this.store.createUser(params)
  }

  // ... 其他方法
}

export default UserService
```

---

### 2. Login 模块（登录认证）

**职责**：
- 用户凭证验证
- JWT token 生成与验证
- 会话管理（session 表操作）
- 刷新令牌处理

**核心接口**：

```typescript
// packages/auth/login/src/types.ts
export interface LoginParams {
  username: string
  password: string
  rememberMe?: boolean
}

export interface LoginResult {
  userId: string
  username: string
  email: string
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: 'Bearer'
}

export interface JwtPayload {
  sub: string              // userId
  username: string
  email: string
  sessionId: string
  iat: number
  exp: number
}

export interface SessionInfo {
  id: string
  userId: string
  tokenHash: string
  refreshTokenHash: string | null
  expiresAt: number
  refreshExpiresAt: number | null
  createdAt: number
  lastActivityAt: number
  ipAddress: string | null
  userAgent: string | null
  status: 'active' | 'expired' | 'revoked'
}
```

**JWT 处理**：

```typescript
// packages/auth/login/src/jwt.ts
import jwt from 'jsonwebtoken'
import { createHash } from 'node:crypto'

export class JwtManager {
  constructor(
    private secret: string,
    private expiresIn: string = '1h',
    private refreshExpiresIn: string = '7d'
  ) {}

  generateAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn,
      algorithm: 'HS256',
      issuer: 'deepseek-harness',
      audience: 'dsh-client'
    })
  }

  generateRefreshToken(): string {
    const randomBytes = crypto.randomBytes(32)
    return `rt_${randomBytes.toString('hex')}`
  }

  verifyToken(token: string): JwtPayload {
    return jwt.verify(token, this.secret, {
      algorithms: ['HS256'],
      issuer: 'deepseek-harness',
      audience: 'dsh-client'
    }) as JwtPayload
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }
}
```

**会话管理**：

```typescript
// packages/auth/login/src/session.ts
export class SessionManager {
  constructor(
    private db: DatabaseSync,
    private jwtManager: JwtManager
  ) {}

  async createSession(params: {
    userId: string
    accessToken: string
    refreshToken: string
    expiresIn: number
    ipAddress?: string
    userAgent?: string
  }): Promise<SessionInfo> {
    const sessionId = randomUUID()
    const tokenHash = this.jwtManager.hashToken(params.accessToken)
    const refreshTokenHash = this.jwtManager.hashToken(params.refreshToken)
    const now = Date.now()

    const session: SessionInfo = {
      id: sessionId,
      userId: params.userId,
      tokenHash,
      refreshTokenHash,
      expiresAt: now + params.expiresIn * 1000,
      refreshExpiresAt: now + 7 * 24 * 3600 * 1000,
      createdAt: now,
      lastActivityAt: now,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      status: 'active'
    }

    // 插入数据库
    this.db.prepare(`
      INSERT INTO sessions (
        id, user_id, token_hash, refresh_token_hash,
        expires_at, refresh_expires_at, created_at, last_activity_at,
        ip_address, user_agent, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      session.id, session.userId, session.tokenHash, session.refreshTokenHash,
      session.expiresAt, session.refreshExpiresAt, session.createdAt,
      session.lastActivityAt, session.ipAddress, session.userAgent, session.status
    )

    return session
  }

  async revokeSession(sessionId: string): Promise<void> {
    this.db.prepare(`
      UPDATE sessions SET status = 'revoked' WHERE id = ?
    `).run(sessionId)
  }

  async cleanupExpiredSessions(): Promise<number> {
    const now = Date.now()
    const result = this.db.prepare(`
      DELETE FROM sessions WHERE status = 'active' AND expires_at < ?
    `).run(now)
    return result.changes
  }
}
```

**Cordis 插件集成**：

```typescript
// packages/auth/login/src/index.ts
import { Context, Service } from '@deepseek-ai/cordis'
import bcrypt from 'bcrypt'
import { JwtManager } from './jwt.ts'
import { SessionManager } from './session.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    login: LoginService
  }
}

export class LoginService extends Service {
  private jwtManager: JwtManager
  private sessionManager: SessionManager

  constructor(ctx: Context, config: LoginConfig) {
    super(ctx, 'login', true)
    this.jwtManager = new JwtManager(config.jwtSecret, config.jwtExpiresIn)
    this.sessionManager = new SessionManager(ctx.database, this.jwtManager)
  }

  async login(params: LoginParams): Promise<LoginResult> {
    // 查询用户
    const user = await this.ctx.user.getUserByUsername(params.username)
      || await this.ctx.user.getUserByEmail(params.username)

    if (!user) {
      throw new Error('AUTH_INVALID_CREDENTIALS')
    }

    // 验证密码
    const isValid = await bcrypt.compare(params.password, user.passwordHash)
    if (!isValid) {
      throw new Error('AUTH_INVALID_CREDENTIALS')
    }

    // 检查账户状态
    if (user.status === 'suspended') {
      throw new Error('AUTH_ACCOUNT_SUSPENDED')
    }
    if (user.status === 'deleted') {
      throw new Error('AUTH_ACCOUNT_DELETED')
    }

    // 生成 token
    const sessionId = randomUUID()
    const accessToken = this.jwtManager.generateAccessToken({
      sub: user.id,
      username: user.username,
      email: user.email,
      sessionId
    })
    const refreshToken = this.jwtManager.generateRefreshToken()

    // 创建会话
    const expiresIn = params.rememberMe ? 30 * 24 * 3600 : 3600
    await this.sessionManager.createSession({
      userId: user.id,
      accessToken,
      refreshToken,
      expiresIn
    })

    // 更新最后登录时间
    await this.ctx.user.updateLastLogin(user.id)

    return {
      userId: user.id,
      username: user.username,
      email: user.email,
      accessToken,
      refreshToken,
      expiresIn,
      tokenType: 'Bearer'
    }
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessionManager.revokeSession(sessionId)
  }

  async verifyToken(token: string): Promise<{ valid: boolean; payload?: JwtPayload }> {
    try {
      const payload = this.jwtManager.verifyToken(token)
      return { valid: true, payload }
    } catch {
      return { valid: false }
    }
  }
}

export default LoginService
```

---

### 3. Registration 模块（注册服务）

**职责**：
- 用户注册参数校验
- 密码加密（bcrypt）
- 调用 User 模块创建用户

**核心接口**：

```typescript
// packages/auth/registration/src/types.ts
export interface RegisterParams {
  username: string
  email: string
  password: string
}

export interface RegisterResult {
  userId: string
  username: string
  email: string
  createdAt: number
}
```

**参数校验**：

```typescript
// packages/auth/registration/src/validator.ts
import { Schema } from '@deepseek-ai/schemastery'

export const RegisterSchema = Schema.object({
  username: Schema.string()
    .min(3).max(50)
    .pattern(/^[a-zA-Z0-9_]+$/)
    .required()
    .description('用户名：3-50字符，仅限字母数字下划线'),

  email: Schema.string()
    .pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
    .max(255)
    .required()
    .description('邮箱地址'),

  password: Schema.string()
    .min(8).max(128)
    .required()
    .description('密码：8-128字符')
})

export function validateRegisterParams(params: unknown): RegisterParams {
  return RegisterSchema(params)
}
```

**Cordis 插件集成**：

```typescript
// packages/auth/registration/src/index.ts
import { Context, Service } from '@deepseek-ai/cordis'
import bcrypt from 'bcrypt'
import { validateRegisterParams } from './validator.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    registration: RegistrationService
  }
}

export class RegistrationService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'registration', true)
  }

  async register(params: RegisterParams): Promise<RegisterResult> {
    // 参数校验
    const validated = validateRegisterParams(params)

    // 密码加密
    const passwordHash = await bcrypt.hash(validated.password, 10)

    // 创建用户
    const user = await this.ctx.user.createUser({
      username: validated.username,
      email: validated.email,
      passwordHash
    })

    return {
      userId: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt
    }
  }
}

export default RegistrationService
```

---

## Typert Remote 集成

### Gateway 路由注册

```typescript
// 在主应用入口注册认证路由
import { Context } from '@deepseek-ai/cordis'
import UserService from '@deepseek-ai/dsh-auth-user'
import LoginService from '@deepseek-ai/dsh-auth-login'
import RegistrationService from '@deepseek-ai/dsh-auth-registration'

export function setupAuth(ctx: Context) {
  // 加载插件
  ctx.plugin(UserService)
  ctx.plugin(LoginService, {
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    jwtExpiresIn: '1h'
  })
  ctx.plugin(RegistrationService)

  // 注册 Typert Remote 方法
  ctx.typert.method('auth/register', async (params) => {
    return ctx.registration.register(params)
  })

  ctx.typert.method('auth/login', async (params) => {
    return ctx.login.login(params)
  })

  ctx.typert.method('auth/logout', async (params) => {
    const sessionId = ctx.sessionId // 从 JWT 中间件提取
    await ctx.login.logout(sessionId)
    return { message: 'Logged out successfully' }
  })

  ctx.typert.method('auth/getUser', async (params) => {
    return ctx.user.getUserById(params.userId)
  })

  ctx.typert.method('auth/getCurrentUser', async () => {
    const userId = ctx.userId // 从 JWT 中间件提取
    return ctx.user.getUserById(userId)
  })

  ctx.typert.method('auth/listUsers', async (params) => {
    return ctx.user.listUsers(params)
  })

  ctx.typert.method('auth/updateUser', async (params) => {
    return ctx.user.updateUser(params)
  })

  ctx.typert.method('auth/changePassword', async (params) => {
    const userId = ctx.userId
    const user = await ctx.user.getUserById(userId)

    const isValid = await bcrypt.compare(params.currentPassword, user.passwordHash)
    if (!isValid) {
      throw new Error('AUTH_INVALID_CREDENTIALS')
    }

    const newPasswordHash = await bcrypt.hash(params.newPassword, 10)
    await ctx.user.updateUser({ userId, passwordHash: newPasswordHash })

    return { message: 'Password changed successfully', updatedAt: Date.now() }
  })

  ctx.typert.method('auth/verifyToken', async (params) => {
    return ctx.login.verifyToken(params.token)
  })

  ctx.typert.method('auth/refresh', async (params) => {
    // 刷新令牌逻辑
    return ctx.login.refreshToken(params.refreshToken)
  })
}
```

---

## 配置规范

### 环境变量

```bash
# JWT 配置
JWT_SECRET=your-jwt-secret-key-change-in-production
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# 数据库配置
AUTH_DB_PATH=./data/auth.db
AUTH_DB_JOURNAL_MODE=wal

# 密码配置
BCRYPT_ROUNDS=10

# 会话配置
SESSION_MAX_CONCURRENT=5
SESSION_CLEANUP_INTERVAL=3600000
```

### Schemastery 配置

```typescript
// packages/auth/login/src/config.ts
import { Schema } from '@deepseek-ai/schemastery'

export interface LoginConfig {
  jwtSecret: string
  jwtExpiresIn: string
  jwtRefreshExpiresIn: string
  bcryptRounds: number
  sessionMaxConcurrent: number
}

export const LoginConfigSchema = Schema.object({
  jwtSecret: Schema.string()
    .required()
    .description('JWT 签名密钥'),

  jwtExpiresIn: Schema.string()
    .default('1h')
    .description('访问令牌有效期'),

  jwtRefreshExpiresIn: Schema.string()
    .default('7d')
    .description('刷新令牌有效期'),

  bcryptRounds: Schema.number()
    .min(4).max(20)
    .default(10)
    .description('bcrypt cost factor'),

  sessionMaxConcurrent: Schema.number()
    .min(1).max(100)
    .default(5)
    .description('单用户最大并发会话数')
})
```

---

## 测试策略

### 单元测试结构

```
packages/auth/user/tests/
├── store.test.ts          # 数据库操作测试
├── service.test.ts        # 用户服务测试
└── fixtures.ts            # 测试数据

packages/auth/login/tests/
├── jwt.test.ts            # JWT 生成验证测试
├── session.test.ts        # 会话管理测试
└── service.test.ts        # 登录服务集成测试

packages/auth/registration/tests/
├── validator.test.ts      # 参数校验测试
└── service.test.ts        # 注册服务测试
```

### 测试覆盖目标

- **User 模块**: 数据库 CRUD 操作、唯一性约束、错误处理
- **Login 模块**: JWT 签名验证、会话创建撤销、密码验证
- **Registration 模块**: 参数校验、密码加密、重复注册检测

---

## 安全考虑

### 密码安全

1. **bcrypt 加密**：使用 cost factor = 10
2. **禁止明文存储**：数据库仅存储 `password_hash`
3. **禁止明文传输**：API 响应永不返回密码字段
4. **禁止日志输出**：日志中过滤所有敏感字段

### Token 安全

1. **存储哈希值**：sessions 表存储 `token_hash` 而非明文
2. **短有效期**：访问令牌 1 小时，刷新令牌 7 天
3. **签名验证**：使用 HS256 算法，强制验证 issuer/audience
4. **撤销机制**：支持单个会话撤销和全局登出

### 注入防护

1. **参数化查询**：所有 SQL 使用 `db.prepare()` 和参数绑定
2. **Schema 校验**：使用 Schemastery 进行严格类型校验
3. **输入清洗**：用户名仅允许字母数字下划线

### 限流保护

1. **注册限流**：1小时内最多 5 次
2. **登录限流**：15分钟内最多 10 次
3. **会话上限**：单用户最多 5 个并发会话

---

## 部署清单

### 数据库初始化

```bash
# 执行 SQL 脚本
sqlite3 ./data/auth.db < packages/auth/user/resources/sql/schema.sql
```

### 依赖安装

```bash
# 在项目根目录
pnpm install

# 构建认证模块
pnpm --filter "@deepseek-ai/dsh-auth-*" run bundle
```

### 环境配置

```bash
# 生成 JWT 密钥
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# 写入 .env
echo "JWT_SECRET=<生成的密钥>" >> .env
```

---

## 后续扩展

### 可选功能

1. **邮箱验证**：注册后发送验证邮件
2. **双因素认证（2FA）**：TOTP 支持
3. **OAuth 集成**：GitHub/Google 第三方登录
4. **角色权限**：RBAC 权限控制
5. **审计日志**：用户操作记录

### 扩展模块

```
packages/auth/
├── email-verification/    # 邮箱验证
├── oauth/                # OAuth 集成
├── rbac/                 # 角色权限控制
└── audit/                # 审计日志
```

---

## 相关文档

- **数据库设计**: [DATABASE.md](./DATABASE.md)
- **API 规范**: [API.md](./API.md)
- **Cordis 文档**: https://cordis.js.org
- **Typert 文档**: 项目内部文档

---

## 维护者

DeepSeek Harness Team

## 许可证

MIT
