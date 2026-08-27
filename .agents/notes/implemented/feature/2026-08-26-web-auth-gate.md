# Agent Note: Web authentication gate

Status: implemented

English | [中文](2026-08-26-web-auth-gate.zh.md)

## Problem

The Web shell had no account entry point, so a deployment could not require an
identity before opening sessions or connect a future remote account service.

## Decision

The `apps/web` entry mounts a login/register gate before `AppWebEntry` and shows
the authenticated user's name with a logout action. The `dsh-web-app` host
plugin serves the `/register`, `/login`, `/me`, and `/logout` endpoints from
PostgreSQL configured by server-only `AUTH_DATABASE_URL`, with hashed passwords
and HttpOnly sessions. Until that service is configured, network, 404, and 503
responses use a browser-local development store with SHA-256 password hashes;
the browser never receives the database URL.

## Alternatives considered

**Direct browser-to-database access.** Rejected because it would expose database
credentials and bypass server-side authorization.

**Blocking the UI until the remote service exists.** Rejected for local
development: the browser fallback allows the shell and form flow to be tested
before deployment wiring is complete.

## Consequences

Deployments must provide `AUTH_DATABASE_URL` and allow the Web process to reach
PostgreSQL. The local fallback is intentionally non-production and is replaced
automatically when the remote API responds.
