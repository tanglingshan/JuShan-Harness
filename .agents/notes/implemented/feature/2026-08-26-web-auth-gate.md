# Agent Note: Web authentication gate

Status: implemented

English | [中文](2026-08-26-web-auth-gate.zh.md)

## Problem

The Web shell had no account entry point, so a deployment could not require an
identity before opening sessions or connect a future remote account service.

## Decision

The `apps/web` entry mounts a login/register gate before `AppWebEntry` and shows
the authenticated user's name with a logout action. It calls a configurable
`VITE_AUTH_API_URL` using cookie credentials and expects `/register`, `/login`,
`/me`, and `/logout` endpoints. Until that service exists, network, 404, and 503
responses use a browser-local development store with SHA-256 password hashes.
The server-only `AUTH_DATABASE_URL` location is documented in `.env.example`;
the browser never receives that value.

## Alternatives considered

**Direct browser-to-database access.** Rejected because it would expose database
credentials and bypass server-side authorization.

**Blocking the UI until the remote service exists.** Rejected for local
development: the browser fallback allows the shell and form flow to be tested
before deployment wiring is complete.

## Consequences

Deployments must provide the documented HTTP authentication endpoints for
production identity storage. The local fallback is intentionally non-production
and is replaced automatically when the remote API responds.
