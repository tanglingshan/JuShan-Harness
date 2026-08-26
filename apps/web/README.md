# Web authentication

The web shell now starts behind a login/register gate. It calls the following
server endpoints, using same-origin cookies by default:

- `POST /api/auth/register` with `{ "email", "password", "name" }`
- `POST /api/auth/login` with `{ "email", "password" }`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/auth/keys`
- `POST /api/auth/keys` with `{ "name" }`
- `DELETE /api/auth/keys/:id`

Successful login and registration responses use `{ "user": { "id", "email",
"name" } }`. Set `VITE_AUTH_API_URL` when the API is hosted elsewhere. The
browser never receives `AUTH_DATABASE_URL`; configure that value only in the
server-side authentication service when connecting the remote database.

Key listing returns `{ "keys": [{ "id", "name", "createdAt", "lastUsedAt" }] }`.
Creation returns `{ "key": { "id", "name", "createdAt", "secret" } }`; the
secret is shown once in the Web UI. All key endpoints use the signed-in account
session and must enforce account ownership on the server.

Until the API is deployed, network/404 responses use a browser-local
development account store so the UI can be exercised. This fallback is not a
production identity store.
