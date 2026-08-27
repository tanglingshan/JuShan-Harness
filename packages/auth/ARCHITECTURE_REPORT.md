# DeepSeek Harness 认证系统架构设计完成报告

## 执行摘要

已成功完成 DeepSeek Harness 用户认证系统的完整架构设计。该系统基于 Cordis 插件体系，采用模块化设计，遵循项目现有的代码规范和目录结构。

**完成时间**: 2026-08-27
**架构版本**: 1.0.0
**模块数量**: 3 个核心模块（user, login, registration）

---

## 一、交付物清单

### 1.1 目录结构

```
packages/auth/
├── user/                           # 用户管理核心模块
│   ├── src/
│   │   ├── index.ts               # 模块导出入口
│   │   ├── types.ts               # TypeScript 类型定义
│   │   └── invariant.ts           # 运行时断言
│   ├── resources/sql/
│   │   └── schema.sql             # SQLite 数据库架构
│   ├── tests/                     # 单元测试目录（待实现）
│   ├── package.json               # 包配置文件
│   └── tsconfig.json              # TypeScript 配置
│
├── login/                          # 登录认证模块
│   ├── src/
│   │   ├── index.ts               # 模块导出入口
│   │   ├── types.ts               # TypeScript 类型定义
│   │   └── invariant.ts           # 运行时断言
│   ├── tests/                     # 单元测试目录（待实现）
│   ├── package.json               # 包配置文件
│   └── tsconfig.json              # TypeScript 配置
│
├── registration/                   # 注册服务模块
│   ├── src/
│   │   ├── index.ts               # 模块导出入口
│   │   ├── types.ts               # TypeScript 类型定义
│   │   └── invariant.ts           # 运行时断言
│   ├── tests/                     # 单元测试目录（待实现）
│   ├── package.json               # 包配置文件
│   └── tsconfig.json              # TypeScript 配置
│
├── README.md                       # 架构设计总览文档
├── DATABASE.md                     # 数据库设计详细文档
└── API.md                          # 接口规范文档
```

### 1.2 已创建文件列表

**配置文件 (6个)**:
- `/d/project/deepseek-harness-master/packages/auth/user/package.json`
- `/d/project/deepseek-harness-master/packages/auth/user/tsconfig.json`
- `/d/project/deepseek-harness-master/packages/auth/login/package.json`
- `/d/project/deepseek-harness-master/packages/auth/login/tsconfig.json`
- `/d/project/deepseek-harness-master/packages/auth/registration/package.json`
- `/d/project/deepseek-harness-master/packages/auth/registration/tsconfig.json`

**源代码文件 (9个)**:
- `/d/project/deepseek-harness-master/packages/auth/user/src/index.ts`
- `/d/project/deepseek-harness-master/packages/auth/user/src/types.ts`
- `/d/project/deepseek-harness-master/packages/auth/user/src/invariant.ts`
- `/d/project/deepseek-harness-master/packages/auth/login/src/index.ts`
- `/d/project/deepseek-harness-master/packages/auth/login/src/types.ts`
- `/d/project/deepseek-harness-master/packages/auth/login/src/invariant.ts`
- `/d/project/deepseek-harness-master/packages/auth/registration/src/index.ts`
- `/d/project/deepseek-harness-master/packages/auth/registration/src/types.ts`
- `/d/project/deepseek-harness-master/packages/auth/registration/src/invariant.ts`

**数据库文件 (1个)**:
- `/d/project/deepseek-harness-master/packages/auth/user/resources/sql/schema.sql`

**文档文件 (3个)**:
- `/d/project/deepseek-harness-master/packages/auth/README.md` (架构设计文档)
- `/d/project/deepseek-harness-master/packages/auth/DATABASE.md` (数据库设计文档)
- `/d/project/deepseek-harness-master/packages/auth/API.md` (接口规范文档)

**总计**: 19 个文件

---

## 二、数据库设计

### 2.1 数据库标识

- **Application ID**: `0x44534841` (DSHA - DeepSeek Harness Auth)
- **Schema Version**: `1`
- **Journal Mode**: `WAL` (Write-Ahead Logging)
- **Synchronous**: `FULL`

### 2.2 数据表结构

#### users 表（用户账户）

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 格式 |
| username | TEXT | UNIQUE, NOT NULL | 3-50字符，仅字母数字下划线 |
| email | TEXT | UNIQUE, NOT NULL | 邮箱地址，5-255字符 |
| password_hash | TEXT | NOT NULL | bcrypt 哈希值 |
| status | TEXT | NOT NULL | active/inactive/suspended/deleted |
| created_at | INTEGER | NOT NULL | 创建时间戳（毫秒） |
| updated_at | INTEGER | NOT NULL | 更新时间戳（毫秒） |
| last_login_at | INTEGER | NULL | 最后登录时间戳（毫秒） |

**索引**:
- `idx_users_username`
- `idx_users_email`
- `idx_users_status`
- `idx_users_created_at`

#### sessions 表（会话管理）

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 格式 |
| user_id | TEXT | FOREIGN KEY | 关联 users.id |
| token_hash | TEXT | NOT NULL | JWT token SHA-256 哈希 |
| refresh_token_hash | TEXT | NULL | 刷新令牌 SHA-256 哈希 |
| expires_at | INTEGER | NOT NULL | token 过期时间戳 |
| refresh_expires_at | INTEGER | NULL | 刷新令牌过期时间戳 |
| created_at | INTEGER | NOT NULL | 会话创建时间戳 |
| last_activity_at | INTEGER | NOT NULL | 最后活动时间戳 |
| ip_address | TEXT | NULL | 客户端 IP 地址 |
| user_agent | TEXT | NULL | 客户端 User-Agent |
| status | TEXT | NOT NULL | active/expired/revoked |

**索引**:
- `idx_sessions_user_id`
- `idx_sessions_token_hash`
- `idx_sessions_expires_at`
- `idx_sessions_status`
- `idx_sessions_user_status` (复合索引)

### 2.3 DDL 语句

完整的数据库架构定义位于：
`/d/project/deepseek-harness-master/packages/auth/user/resources/sql/schema.sql`

---

## 三、接口规范

### 3.1 Typert Remote 方法清单

| 方法名 | 功能 | 参数 | 返回值 |
|--------|------|------|--------|
| `auth/register` | 用户注册 | username, email, password | userId, username, email, createdAt |
| `auth/login` | 用户登录 | username, password, rememberMe | accessToken, refreshToken, expiresIn |
| `auth/logout` | 登出 | sessionId (可选) | message |
| `auth/refresh` | 刷新 Token | refreshToken | accessToken, expiresIn |
| `auth/getUser` | 获取用户信息 | userId | UserInfo |
| `auth/getCurrentUser` | 获取当前用户 | - | CurrentUserInfo + sessionId |
| `auth/listUsers` | 用户列表 | page, pageSize, status, sortBy | users[], pagination |
| `auth/updateUser` | 更新用户 | userId, email?, status? | updatedFields[] |
| `auth/changePassword` | 修改密码 | currentPassword, newPassword | message |
| `auth/verifyToken` | 验证 Token | token | valid, payload?, expiresAt? |

### 3.2 统一响应格式

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
  timestamp: number
}
```

### 3.3 错误代码体系

- `AUTH_INVALID_CREDENTIALS` - 用户名或密码错误
- `AUTH_USER_NOT_FOUND` - 用户不存在
- `AUTH_USER_ALREADY_EXISTS` - 用户名或邮箱已存在
- `AUTH_TOKEN_INVALID` - Token 无效
- `AUTH_TOKEN_EXPIRED` - Token 已过期
- `AUTH_VALIDATION_ERROR` - 参数校验失败
- `AUTH_PERMISSION_DENIED` - 权限不足
- `AUTH_ACCOUNT_SUSPENDED` - 账户已暂停
- `AUTH_INTERNAL_ERROR` - 内部错误

---

## 四、开发规范

### 4.1 密码加密

- **算法**: bcrypt
- **Cost Factor**: 10
- **库**: `bcrypt` (npm package)
- **存储**: 仅存储哈希值，禁止明文

```typescript
import bcrypt from 'bcrypt'
const passwordHash = await bcrypt.hash(plainPassword, 10)
const isValid = await bcrypt.compare(plainPassword, passwordHash)
```

### 4.2 JWT Token

- **算法**: HS256
- **签名密钥**: 环境变量 `JWT_SECRET`
- **有效期**:
  - 访问令牌: 1 小时
  - 刷新令牌: 7 天
  - 记住我: 30 天
- **Payload 结构**:
  ```typescript
  {
    sub: string         // userId
    username: string
    email: string
    sessionId: string
    iat: number
    exp: number
  }
  ```

### 4.3 参数校验

- **库**: `@deepseek-ai/schemastery`
- **规则**:
  - username: 3-50字符，`/^[a-zA-Z0-9_]+$/`
  - email: 标准邮箱格式，最大255字符
  - password: 8-128字符

### 4.4 SQL 注入防护

- **强制使用**: 参数化查询 (`db.prepare()`)
- **禁止**: 字符串拼接 SQL

```typescript
// ✅ 正确
db.prepare('SELECT * FROM users WHERE username = ?').get(username)

// ❌ 错误
db.exec(`SELECT * FROM users WHERE username = '${username}'`)
```

### 4.5 错误处理

- **统一抛出**: `throw new Error('AUTH_ERROR_CODE')`
- **日志过滤**: 禁止输出 `password_hash`, `token_hash`
- **响应封装**: 所有错误通过 `ApiResponse` 格式返回

---

## 五、模块依赖关系

```
@deepseek-ai/dsh-auth-registration
  ├── @deepseek-ai/dsh-auth-user (workspace:^)
  ├── @deepseek-ai/schemastery (workspace:^)
  ├── @deepseek-ai/cordis (workspace:^)
  └── bcrypt (^5.1.1)

@deepseek-ai/dsh-auth-login
  ├── @deepseek-ai/dsh-auth-user (workspace:^)
  ├── @deepseek-ai/schemastery (workspace:^)
  ├── @deepseek-ai/cordis (workspace:^)
  ├── jsonwebtoken (^9.0.2)
  └── bcrypt (^5.1.1)

@deepseek-ai/dsh-auth-user
  ├── @deepseek-ai/schemastery (workspace:^)
  ├── @deepseek-ai/cordis (workspace:^)
  └── bcrypt (^5.1.1)
```

---

## 六、TypeScript 类型系统

### 6.1 核心类型定义

**User 模块** (`@deepseek-ai/dsh-auth-user/types`):
- `User` - 完整用户实体
- `UserInfo` - 公开用户信息（不含密码）
- `CreateUserParams` - 创建用户参数
- `UpdateUserParams` - 更新用户参数
- `UserQuery` - 查询参数
- `UserListResult` - 分页结果

**Login 模块** (`@deepseek-ai/dsh-auth-login/types`):
- `LoginParams` - 登录参数
- `LoginResult` - 登录结果
- `JwtPayload` - JWT 载荷
- `SessionInfo` - 会话信息
- `TokenVerificationResult` - Token 验证结果
- `LoginConfig` - 登录服务配置

**Registration 模块** (`@deepseek-ai/dsh-auth-registration/types`):
- `RegisterParams` - 注册参数
- `RegisterResult` - 注册结果
- `ValidationError` - 校验错误详情

### 6.2 类型导出

每个模块的 `index.ts` 导出所有公开类型：

```typescript
// @deepseek-ai/dsh-auth-user
export * from './types.ts'
export { UserService } from './service.ts'
export { UserStore } from './store.ts'
```

---

## 七、后续实现步骤

### 7.1 待实现文件（业务逻辑）

**User 模块**:
- `packages/auth/user/src/service.ts` - UserService 实现
- `packages/auth/user/src/store.ts` - UserStore 数据访问层
- `packages/auth/user/src/schema.ts` - 数据库 schema 管理

**Login 模块**:
- `packages/auth/login/src/service.ts` - LoginService 实现
- `packages/auth/login/src/jwt.ts` - JwtManager 实现
- `packages/auth/login/src/session.ts` - SessionManager 实现

**Registration 模块**:
- `packages/auth/registration/src/service.ts` - RegistrationService 实现
- `packages/auth/registration/src/validator.ts` - 参数校验器

### 7.2 测试用例（待编写）

- `packages/auth/user/tests/*.test.ts`
- `packages/auth/login/tests/*.test.ts`
- `packages/auth/registration/tests/*.test.ts`

### 7.3 集成步骤

1. 安装依赖: `pnpm install`
2. 实现业务逻辑代码（参考 README.md 中的代码示例）
3. 编写单元测试
4. 构建模块: `pnpm --filter "@deepseek-ai/dsh-auth-*" run bundle`
5. 初始化数据库: `sqlite3 ./data/auth.db < packages/auth/user/resources/sql/schema.sql`
6. 在主应用中集成（参考 README.md 的集成示例）
7. 注册 Typert Remote 方法

---

## 八、安全检查清单

✅ **密码安全**:
- 使用 bcrypt (cost=10) 加密
- 禁止明文存储和传输
- 禁止日志输出

✅ **Token 安全**:
- 存储 SHA-256 哈希而非明文
- 短有效期（1小时访问，7天刷新）
- 支持会话撤销

✅ **注入防护**:
- 强制参数化查询
- Schemastery 参数校验
- 用户名白名单字符

✅ **限流保护**:
- 注册: 5次/小时
- 登录: 10次/15分钟
- 会话上限: 5个/用户

---

## 九、文档完整性

### 9.1 架构文档 (README.md)

包含内容：
- 系统架构概览
- 模块划分与依赖关系
- 核心模块设计（User, Login, Registration）
- Typert Remote 集成示例
- 配置规范（环境变量、Schemastery）
- 测试策略
- 安全考虑
- 部署清单
- 后续扩展建议

### 9.2 数据库文档 (DATABASE.md)

包含内容：
- 数据库标识配置
- 表结构详细定义（users, sessions）
- 字段约束与索引
- 数据类型说明（时间戳、UUID、密码哈希）
- 数据迁移策略
- 性能优化（WAL、索引策略）
- 安全规范（参数化查询、敏感字段保护）
- 维护操作（会话清理、统计查询）
- 示例数据

### 9.3 API 文档 (API.md)

包含内容：
- 通用规范（请求/响应格式、错误代码）
- 10 个核心接口定义（register, login, logout, refresh, getUser, getCurrentUser, listUsers, updateUser, changePassword, verifyToken）
- 每个接口的：
  - 方法名
  - 参数定义
  - 校验规则
  - 响应数据
  - 完整示例
- 安全规范（JWT 配置、密码策略、限流、会话管理）
- 中间件集成示例
- 错误处理示例

---

## 十、项目规范遵循

✅ **目录结构**: 遵循 `packages/<group>/<pkg>/` 规范
✅ **命名规范**: `@deepseek-ai/dsh-auth-*` package 命名
✅ **TypeScript**: 完全类型化，ESM 模块
✅ **Cordis 集成**: 插件式架构设计
✅ **构建工具**: 使用 `tsdown` 打包
✅ **依赖管理**: workspace 协议引用内部包
✅ **配置文件**: tsconfig.json 继承 `tsconfig.base.json`
✅ **导出规范**: exports 字段定义明确的导出路径

---

## 十一、验收标准

| 标准 | 状态 | 说明 |
|------|------|------|
| 目录结构完整 | ✅ | 3个模块，每个包含 src/, tests/, package.json, tsconfig.json |
| 数据库设计完成 | ✅ | schema.sql + DATABASE.md |
| 接口规范完成 | ✅ | API.md 定义 10 个接口 |
| 架构文档完成 | ✅ | README.md 详细设计说明 |
| 类型定义完整 | ✅ | types.ts 定义所有核心类型 |
| 配置文件就绪 | ✅ | package.json, tsconfig.json 符合项目规范 |
| 不包含业务实现 | ✅ | 仅提供架构设计，未编写具体业务代码 |
| 不包含前端页面 | ✅ | 纯后端 API 设计 |
| 不包含测试用例 | ✅ | tests/ 目录预留但未编写 |

---

## 十二、交付成果总结

### 已交付

1. **完整的目录结构** (12个目录)
2. **3个模块的配置文件** (6个 package.json + tsconfig.json)
3. **9个 TypeScript 类型定义文件** (index.ts, types.ts, invariant.ts × 3)
4. **1个数据库 DDL 文件** (schema.sql)
5. **3份完整的设计文档** (README.md, DATABASE.md, API.md)
6. **接口定义清单** (10个 Typert Remote 方法)

### 未交付（按要求）

1. ❌ 具体业务实现代码（service.ts, store.ts, jwt.ts, session.ts, validator.ts）
2. ❌ 前端页面
3. ❌ 测试用例

---

## 附录：快速开始指南

### A. 查看架构设计

```bash
cat /d/project/deepseek-harness-master/packages/auth/README.md
```

### B. 查看数据库设计

```bash
cat /d/project/deepseek-harness-master/packages/auth/DATABASE.md
```

### C. 查看接口规范

```bash
cat /d/project/deepseek-harness-master/packages/auth/API.md
```

### D. 初始化数据库

```bash
sqlite3 ./data/auth.db < /d/project/deepseek-harness-master/packages/auth/user/resources/sql/schema.sql
```

### E. 下一步操作

参考 `packages/auth/README.md` 第九章节「后续实现步骤」，按照架构设计实现：
1. UserService, UserStore
2. LoginService, JwtManager, SessionManager
3. RegistrationService, Validator
4. 单元测试
5. Typert Remote 集成

---

**报告生成时间**: 2026-08-27
**架构师**: DeepSeek Harness Architect Agent
**项目**: DeepSeek Harness Authentication System v1.0
