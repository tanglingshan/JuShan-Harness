/** Manage local dotenv files without exposing their values. */

import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { basename, isAbsolute, resolve } from 'node:path'

/** Parsed dotenv file with an absolute path and string values. */
export interface EnvFile {
  path: string
  values: Record<string, string>
}

/** Parse a dotenv file and return its variable names and values. */
export function readEnvFile(path: string): EnvFile {
  const absolute = resolve(path)
  const content = readFileSync(absolute, 'utf8')
  return { path: absolute, values: parseEnv(content) as Record<string, string> }
}

/** Create a dotenv file from a template, refusing to overwrite an existing file. */
export function initEnvFile(target: string, template: string, force = false): string {
  const targetPath = resolve(target)
  if (existsSync(targetPath) && !force) {
    throw new Error(`env: refusing to overwrite ${targetPath}; pass --force to replace it`)
  }
  const templatePath = resolve(template)
  const content = readFileSync(templatePath, 'utf8')
  parseEnv(content)
  writeFileSync(targetPath, content, { encoding: 'utf8', mode: 0o600 })
  try {
    chmodSync(targetPath, 0o600)
  } catch {
    // Some platforms do not support POSIX file modes; the file was still written safely.
  }
  return targetPath
}

const NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/
const BOOTSTRAP_NAMES = new Set([
  'PATH', 'HOME', 'USERPROFILE', 'SHELL', 'NODE_OPTIONS', 'NODE_PATH',
  'NODE_EXTRA_CA_CERTS', 'LD_PRELOAD', 'LD_LIBRARY_PATH', 'LD_AUDIT',
  'BASH_ENV', 'ENV', 'SHELLOPTS', 'BASHOPTS', 'PYTHONSTARTUP', 'PYTHONPATH',
  'RUBYOPT', 'RUBYLIB', 'JAVA_TOOL_OPTIONS', '_JAVA_OPTIONS', 'JDK_JAVA_OPTIONS',
  'GIT_SSH', 'GIT_SSH_COMMAND', 'GIT_EXTERNAL_DIFF', 'GIT_PAGER', 'GIT_EDITOR',
  'GIT_ASKPASS', 'SSH_ASKPASS', 'GIT_CONFIG_GLOBAL', 'GIT_CONFIG_SYSTEM',
  'GIT_CONFIG_COUNT', 'EDITOR', 'VISUAL', 'PAGER', 'BROWSER', 'DEEPSEEK_BASE_URL',
  'DEEPSEEK_SEARCH_BASE_URL', 'SSL_CERT_FILE', 'SSL_CERT_DIR', 'HTTP_PROXY',
  'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'REQUESTS_CA_BUNDLE', 'CURL_CA_BUNDLE',
  'NODE_TLS_REJECT_UNAUTHORIZED',
])
const BOOTSTRAP_PREFIXES = ['DSH_', 'XDG_', 'DYLD_', 'BASH_FUNC_']

function assertWritableName(name: string): void {
  if (!NAME_PATTERN.test(name)) throw new Error(`env: invalid variable name "${name}"`)
  const upper = name.toUpperCase()
  if (BOOTSTRAP_NAMES.has(upper) || BOOTSTRAP_PREFIXES.some(prefix => upper.startsWith(prefix))) {
    throw new Error(`env: ${name} is launch-only; export it in the invoking environment`)
  }
}

function quoteValue(value: string): string {
  return /^[A-Za-z0-9_./:@%+,-]*$/.test(value) ? value : JSON.stringify(value)
}

/** Set one variable while retaining comments and unrelated lines. */
export function setEnvValue(path: string, name: string, value: string): string {
  assertWritableName(name)
  const target = resolve(path)
  let content = existsSync(target) ? readFileSync(target, 'utf8') : ''
  parseEnv(content)
  const line = `${name}=${quoteValue(value)}`
  const pattern = new RegExp(`^\\s*${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\s*=.*$`, 'gm')
  content = pattern.test(content) ? content.replace(pattern, line) : `${content}${content.length > 0 && !content.endsWith('\n') ? '\n' : ''}${line}\n`
  parseEnv(content)
  writeFileSync(target, content, { encoding: 'utf8', mode: 0o600 })
  try { chmodSync(target, 0o600) } catch { /* Windows has no POSIX mode bits. */ }
  return target
}

/** Remove one variable while retaining comments and unrelated lines. */
export function unsetEnvValue(path: string, name: string): string {
  assertWritableName(name)
  const target = resolve(path)
  if (!existsSync(target)) return target
  const content = readFileSync(target, 'utf8')
  parseEnv(content)
  const escaped = name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')
  const next = content.split(/\r?\n/).filter((line: string) => !new RegExp(String.raw`^\s*${escaped}\s*=`).test(line)).join('\n')
  writeFileSync(target, next, { encoding: 'utf8', mode: 0o600 })
  try { chmodSync(target, 0o600) } catch { /* Windows has no POSIX mode bits. */ }
  return target
}

function usage(): string {
  return [
    'Usage: pnpm run env -- <check|list|init|set|unset> [options]',
    '',
    '  check [NAME...]       validate syntax and optionally require variables',
    '  list                  print variable names (never values)',
    '  init                  create .env from .env.example',
    '  set NAME VALUE        set one variable without printing its value',
    '  unset NAME            remove one variable',
    '',
    'Options:',
    '  --file <path>         dotenv path (default: .env)',
    '  --template <path>     init template (default: .env.example)',
    '  --required <names>    comma-separated names required by check',
    '  --force               allow init to replace an existing file',
  ].join('\n')
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name)
  if (index < 0) return undefined
  const value = args[index + 1]
  if (value === undefined || value.startsWith('--')) throw new Error(`env: ${name} requires a value`)
  return value
}

function positionals(args: readonly string[]): string[] {
  const values: string[] = []
  for (let index = 1; index < args.length; index += 1) {
    const argument = args[index]
    if (argument?.startsWith('--')) {
      if (argument !== '--force') index += 1
      continue
    }
    if (argument !== undefined) {
      values.push(argument)
    }
  }
  return values
}

/** Execute the dotenv management command and return its process exit code. */
export function runEnv(args: readonly string[], cwd = process.cwd()): number {
  const command = args[0]
  if (command === undefined || command === '--help' || command === '-h') {
    process.stdout.write(`${usage()}\n`)
    return 0
  }
  if (!['check', 'list', 'init', 'set', 'unset'].includes(command)) throw new Error(`env: unknown command ${command}\n\n${usage()}`)

  const knownOptions = new Set(['--file', '--template', '--required', '--force'])
  for (let index = 1; index < args.length; index += 1) {
    const argument = args[index]
    if (!argument?.startsWith('--')) continue
    if (!knownOptions.has(argument)) throw new Error(`env: unknown option ${argument}`)
    if (argument !== '--force') index += 1
  }

  const file = resolve(cwd, option([...args], '--file') ?? '.env')
  if (command === 'init') {
    const template = resolve(cwd, option([...args], '--template') ?? '.env.example')
    const created = initEnvFile(file, template, args.includes('--force'))
    process.stdout.write(`env: created ${created} from ${template}\n`)
    return 0
  }

  if (command === 'set' || command === 'unset') {
    const values = positionals(args)
    const name = values[0]
    if (name === undefined) throw new Error(`env: ${command} requires a variable name`)
    if (command === 'set') {
      if (values.length > 2) throw new Error('env: set accepts exactly NAME and VALUE')
      const value = values[1]
      if (value === undefined) throw new Error('env: set requires NAME and VALUE')
      setEnvValue(file, name, value)
      process.stdout.write(`env: updated ${name} in ${file}\n`)
    } else {
      if (values.length > 1) throw new Error('env: unset accepts exactly NAME')
      unsetEnvValue(file, name)
      process.stdout.write(`env: removed ${name} from ${file}\n`)
    }
    return 0
  }

  const env = readEnvFile(file)
  const names = Object.keys(env.values).sort((left, right) => left.localeCompare(right))
  if (command === 'list') {
    for (const name of names) process.stdout.write(`${name}\n`)
    return 0
  }

  const required = [
    ...(option([...args], '--required') ?? '').split(',').map(name => name.trim()).filter(Boolean),
    ...args.slice(1).filter((arg, index, all) => {
      if (arg.startsWith('--')) return false
      if (index > 0 && all[index - 1]?.startsWith('--')) return false
      return all[index - 1] !== '--file' && all[index - 1] !== '--template'
    }),
  ]
  const missing = [...new Set(required)].filter(name => env.values[name] === undefined || env.values[name] === '')
  if (missing.length > 0) throw new Error(`env: missing required variable(s) in ${basename(file)}: ${missing.join(', ')}`)
  process.stdout.write(`env: ${file} is valid (${String(names.length)} variable${names.length === 1 ? '' : 's'})\n`)
  return 0
}

if (process.argv[1] && isAbsolute(process.argv[1]) && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try {
    process.exitCode = runEnv(process.argv.slice(2), process.cwd())
  } catch (error) {
    process.stderr.write(`${String(error instanceof Error ? error.message : error)}\n`)
    process.exitCode = 1
  }
}
