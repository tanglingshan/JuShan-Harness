-- DeepSeek Harness Authentication System Database Schema
-- Version: 1.0.0
-- Application ID: 0x44534841 (DSHA - DeepSeek Harness Auth)

-- Users table: stores user account information
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_login_at INTEGER,
  CHECK (length(username) >= 3 AND length(username) <= 50),
  CHECK (length(email) >= 5 AND length(email) <= 255),
  CHECK (status IN ('active', 'inactive', 'suspended', 'deleted'))
);

-- Sessions table: stores JWT token sessions and refresh tokens
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  refresh_token_hash TEXT,
  expires_at INTEGER NOT NULL,
  refresh_expires_at INTEGER,
  created_at INTEGER NOT NULL,
  last_activity_at INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (status IN ('active', 'expired', 'revoked'))
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_user_status ON sessions(user_id, status);
