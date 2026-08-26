CREATE TABLE IF NOT EXISTS auth_users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  name text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_users_email_lower_idx ON auth_users (lower(email));

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions (user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions (expires_at);

CREATE TABLE IF NOT EXISTS auth_api_keys (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  name text NOT NULL,
  secret_hash text NOT NULL UNIQUE,
  secret_prefix text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS auth_api_keys_user_active_idx
  ON auth_api_keys (user_id, created_at DESC)
  WHERE revoked_at IS NULL;
