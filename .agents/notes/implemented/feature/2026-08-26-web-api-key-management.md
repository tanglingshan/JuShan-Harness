# Agent Note: Account-scoped Web API keys

Status: implemented

English | [中文](2026-08-26-web-api-key-management.zh.md)

## Problem

Signed-in Web users had no way to create, inspect, or revoke API credentials,
and a future remote key store had no account ownership contract.

## Decision

The authenticated account bar opens an API Key panel with account-scoped list,
creation, one-time secret display and copy, and revocation actions. The browser
uses `/keys` endpoints under the configured auth API and sends the existing
session cookie. The `dsh-web-app` host plugin now serves those endpoints from
PostgreSQL, applies `auth-schema.sql` on startup, enforces ownership in every
query, and stores only hashed secrets. A local development fallback stores keys
under the account ID and never shares them between accounts.

## Alternatives considered

**One global key list in browser storage.** Rejected because credentials must be
isolated by account, even in development mode.

**Expose database access from the browser.** Rejected because database
credentials and authorization remain server responsibilities.

## Consequences

Production deployments need `AUTH_DATABASE_URL` and network access to the
PostgreSQL server. Newly created secrets are available for copying at creation;
the list intentionally returns metadata only.
