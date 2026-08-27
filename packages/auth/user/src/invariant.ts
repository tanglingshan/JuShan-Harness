/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-auth-user`.
 * @module @deepseek-ai/dsh-auth-user/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-auth-user'

/** Cordis companion plugin name. */
export const name = 'auth-user-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: user records are owned by SQLite rows this package
 * writes, with no independent event stream a companion can compare.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
