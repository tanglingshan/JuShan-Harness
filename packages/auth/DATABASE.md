# DeepSeek Harness 认证系统数据库设计文档

## 概览

本文档定义了 DeepSeek Harness 认证系统的数据库结构，使用 SQLite 作为存储引擎，遵循项目现有的 session-persistence-sqlite 模式。

**数据库标识**：
- Application ID: `0x44534841` (DSHA - DeepSeek Harness Auth)
- Schema Version: `1`
- Journal Mode: `wal` (Write-Ahead Logging)
- Synchronous: `FULL`

---

## 表结构设计

### 1. users 表

存储用户账户的核心信息。

#### 字段定义

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `id` | TEXT | PRIMARY KEY, NOT NULL | 用户唯一标识符（UUID v4） |
| `username` | TEXT | UNIQUE, NOT NULL | 用户名（3-50 字符） |
| `email` | TEXT | UNIQUE, NOT NULL | 电子邮件（5-255 字符） |
| `password_hash` | TEXT | NOT NULL | bcrypt 密码哈希值 |
| `status` | TEXT | NOT NULL, DEFAULT 'active' | 账户状态（active/inactive/suspended/deleted） |
| `created_at` | INTEGER | NOT NULL | 创建时间戳（毫秒） |
| `updated_at` | INTEGER | NOT NULL | 最后更新时间戳（毫秒） |
| `last_login_at` | INTEGER | NULL | 最后登录时间戳（毫秒） |

#### 约束规则

```sql
CHECK (length(username) >= 3 AND length(username) <= 50)
CHECK (length(email) >= 5 AND length(email) <= 255)
CHECK (status IN ('active', 'inactive', 'suspended', 'deleted'))
```

#### 索引

- `idx_users_username` - 用户名查询优化
- `idx_users_email` - 邮箱查询优化
- `idx_users_status` - 状态筛选优化
- `idx_users_created_at` - 时间排序优化

---

### 2. sessions 表

存储 JWT token 会话和刷新令牌信息。

#### 字段定义

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `id` | TEXT | PRIMARY KEY, NOT NULL | 会话唯一标识符（UUID v4） |
| `user_id` | TEXT | NOT NULL, FOREIGN KEY | 关联用户 ID |
| `token_hash` | TEXT | NOT NULL | JWT token 的 SHA-256 哈希值 |
| `refresh_token_hash` | TEXT | NULL | 刷新令牌的 SHA-256 哈希值 |
| `expires_at` | INTEGER | NOT NULL | token 过期时间戳（毫秒） |
| `refresh_expires_at` | INTEGER | NULL | 刷新令牌过期时间戳（毫秒） |
| `created_at` | INTEGER | NOT NULL | 会话创建时间戳（毫秒） |
| `last_activity_at` | INTEGER | NOT NULL | 最后活动时间戳（毫秒） |
| `ip_address` | TEXT | NULL | 客户端 IP 地址 |
| `user_agent` | TEXT | NULL | 客户端 User-Agent |
| `status` | TEXT | NOT NULL, DEFAULT 'active' | 会话状态（active/expired/revoked） |

#### 外键约束

```sql
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
```

#### 约束规则

```sql
CHECK (status IN ('active', 'expired', 'revoked'))
```

#### 索引

- `idx_sessions_user_id` - 用户会话查询
- `idx_sessions_token_hash` - token 验证优化
- `idx_sessions_expires_at` - 过期会话清理
- `idx_sessions_status` - 状态筛选
- `idx_sessions_user_status` - 复合查询优化

---

## 数据类型说明

### 时间戳格式

所有时间字段使用 **Unix 时间戳（毫秒）**，存储为 INTEGER 类型：

```typescript
const timestamp = Date.now() // 1724832000000
```

### UUID 生成

使用 Node.js `crypto.randomUUID()` 生成符合 RFC 4122 的 UUID v4：

```typescript
import { randomUUID } from 'node:crypto'
const userId = randomUUID() // "550e8400-e29b-41d4-a716-446655440000"
```

### 密码哈希

使用 bcrypt 算法，推荐 cost factor = 10：

```typescript
import bcrypt from 'bcrypt'
const passwordHash = await bcrypt.hash(plainPassword, 10)
```

### Token 哈希

JWT token 和 refresh token 存储时使用 SHA-256 哈希：

```typescript
import { createHash } from 'node:crypto'
const tokenHash = createHash('sha256').update(token).digest('hex')
```

---

## 数据迁移策略

### 初始化脚本

数据库初始化时执行 `schema.sql`：

```sql
PRAGMA application_id = 0x44534841;
PRAGMA user_version = 1;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = FULL;
PRAGMA foreign_keys = ON;
```

### 版本管理

遵循 `user_version` pragma 进行版本控制：

- 启动时检查 `PRAGMA user_version`
- 版本不匹配时拒绝连接并报错
- 升级脚本按版本号顺序执行

### 备份策略

建议使用 SQLite 的 VACUUM INTO 命令进行备份：

```sql
VACUUM INTO '/path/to/backup/auth.db';
```

---

## 性能优化

### WAL 模式

启用 Write-Ahead Logging 提升并发性能：

- 读操作不会阻塞写操作
- 适合高频查询场景
- 定期执行 `PRAGMA wal_checkpoint(TRUNCATE)` 清理 WAL 文件

### 索引策略

- 所有外键字段建立索引
- 高频查询字段（username, email, token_hash）建立索引
- 复合索引用于多条件查询（user_id + status）

### 查询优化

- 使用参数化查询防止 SQL 注入
- 避免 `SELECT *`，明确列出需要的字段
- 分页查询使用 LIMIT + OFFSET

---

## 安全规范

### 数据保护

1. **密码安全**：永远不存储明文密码，仅存储 bcrypt 哈希
2. **Token 安全**：存储 token 的哈希值而非明文
3. **敏感字段**：禁止在日志中输出 `password_hash`, `token_hash`

### 访问控制

1. **外键级联**：删除用户时自动清理关联会话
2. **状态管理**：软删除使用 `status='deleted'` 而非物理删除
3. **会话过期**：定期清理过期会话（`expires_at < now()`）

### 注入防护

所有 SQL 操作必须使用参数化查询：

```typescript
// ✅ 正确
db.prepare('SELECT * FROM users WHERE username = ?').get(username)

// ❌ 错误
db.exec(`SELECT * FROM users WHERE username = '${username}'`)
```

---

## 维护操作

### 会话清理

定期清理过期会话（建议每小时执行）：

```sql
DELETE FROM sessions
WHERE status = 'active'
  AND expires_at < ?;
```

### 统计查询

```sql
-- 活跃用户数
SELECT COUNT(*) FROM users WHERE status = 'active';

-- 在线会话数
SELECT COUNT(*) FROM sessions WHERE status = 'active' AND expires_at > ?;

-- 用户登录统计
SELECT user_id, COUNT(*) as session_count
FROM sessions
WHERE created_at > ?
GROUP BY user_id
ORDER BY session_count DESC;
```

---

## 示例数据

### 插入用户

```sql
INSERT INTO users (id, username, email, password_hash, status, created_at, updated_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'alice',
  'alice@example.com',
  '$2b$10$rBV2L9Z0J3N1j5r0R.JqXuZ3P6M8K9Q4W5Y7T8U9V0W1X2Y3Z4A5B',
  'active',
  1724832000000,
  1724832000000
);
```

### 插入会话

```sql
INSERT INTO sessions (
  id, user_id, token_hash, refresh_token_hash,
  expires_at, refresh_expires_at, created_at, last_activity_at,
  ip_address, user_agent, status
)
VALUES (
  '660e8400-e29b-41d4-a716-446655440001',
  '550e8400-e29b-41d4-a716-446655440000',
  'a3f5b8c9d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8',
  'b4f6c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8',
  1724835600000,
  1724918400000,
  1724832000000,
  1724832000000,
  '192.168.1.100',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'active'
);
```

---

## 相关文件

- **Schema 定义**: `packages/auth/user/resources/sql/schema.sql`
- **架构文档**: `packages/auth/README.md`
- **API 规范**: `packages/auth/API.md`
