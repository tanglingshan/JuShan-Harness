# Agent Note: A bounded command for local `.env` files

Status: implemented

English | [中文](2026-08-27-env-management-script.zh.md)

## Problem

Developers need a repeatable way to validate and bootstrap the gitignored `.env` files used by the harness. The existing launch path intentionally reads these files as ordinary environment layers, while credentials managed by the product have a separate YAML store. A helper that prints values, overwrites a file by default, or edits the credential store would make local setup less safe and blur those ownership rules.

## Decision

The repository exposes `pnpm run env -- <command>` through `scripts/env.ts`. The command set is deliberately bounded:

- `check [NAME...]` parses one file (default `.env`) and optionally requires named variables through positional names or `--required name1,name2`.
- `list` parses one file and prints sorted variable names only; values never reach command output.
- `init` copies a validated `.env.example` (or `--template`) to the target file and refuses to replace an existing target unless `--force` is supplied.
- `set NAME VALUE` adds or replaces one ordinary variable while retaining unrelated lines; `unset NAME` removes one ordinary variable. Both commands reject launch-only names (`DSH_*`, bootstrap/runtime selectors, network routing, and related names) before writing.

`--file` selects the dotenv path and `--template` selects the init source. Parsing uses Node's `parseEnv`, so the checker and launcher apply the same dotenv grammar. Init writes UTF-8 with owner-only `0600` permissions and attempts to restore that mode after writing; unsupported file modes do not prevent setup. Errors are reported on stderr with a non-zero exit code, while successful operations use concise status lines that do not include secret values.

This helper owns syntax and local-file setup only. It does not mutate `process.env`, apply launch-layer precedence, or write `$DSH_HOME/.credentials.yaml`; launch precedence and bootstrap-variable rejection remain owned by `dsh-app-boot`, and secret records remain owned by `dsh-credentials-local`.

## Alternatives considered

**Expose a general-purpose dotenv editor.** Rejected: the script supports only one-key `set`/`unset` operations, validates the complete file before and after each rewrite, preserves unrelated lines, and refuses launch-only names. A broader editor would need additional quoting and duplicate-key policy.

**Reuse `dsh-credentials-local` for all `.env` writes.** Rejected because that provider's versioned YAML document intentionally stores credential records, not arbitrary environment variables. Combining the stores would change precedence and could make non-secret variables unreachable.

**Print `NAME=value` from `list` or `check`.** Rejected because `.env` commonly contains API keys and tokens; diagnostics and inventory must remain useful without copying secret material into logs or terminals.

**Overwrite `.env` during `init` by default.** Rejected because an existing file may contain credentials or local overrides. Replacement is an explicit `--force` action.

## Consequences

Local setup can be scripted with `pnpm run env -- init`, validated in CI with `check --required`, and inspected safely with `list`. The command does not guarantee that a file will be accepted by the product launcher: bootstrap-only names are rejected by `loadLayeredEnv` at launch, and that policy remains centralized there. Future editing commands must preserve this separation, avoid value-bearing output, and add focused tests for any new syntax or rewrite behavior.
