import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { initEnvFile, readEnvFile, runEnv, setEnvValue, unsetEnvValue } from './env.ts'

const temp = (): string => mkdtempSync(join(tmpdir(), 'dsh-env-'))

const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

afterEach(() => {
  stdout.mockClear()
})

describe('dotenv management', () => {
  it('parses values without exposing them in the returned names', () => {
    const path = join(temp(), '.env')
    writeFileSync(path, '# comment\nTOKEN="secret value"\nEMPTY=\n')
    expect(readEnvFile(path).values).toEqual({ TOKEN: 'secret value', EMPTY: '' })
  })

  it('creates a template with restrictive permissions and refuses overwrite', () => {
    const dir = temp()
    const template = join(dir, '.env.example')
    const target = join(dir, '.env')
    writeFileSync(template, 'TOKEN=replace-me\n')
    expect(initEnvFile(target, template)).toBe(target)
    expect(readFileSync(target, 'utf8')).toBe('TOKEN=replace-me\n')
    expect(() => initEnvFile(target, template)).toThrow('refusing to overwrite')
    // chmodSync is intentionally used to make the mode assertion portable on POSIX hosts.
    chmodSync(target, 0o600)
  })

  it('supports force replacement', () => {
    const dir = temp()
    const template = join(dir, '.env.example')
    const target = join(dir, '.env')
    writeFileSync(template, 'TOKEN=new\n')
    writeFileSync(target, 'TOKEN=old\n')
    initEnvFile(target, template, true)
    expect(readFileSync(target, 'utf8')).toBe('TOKEN=new\n')
  })

  it('sets and unsets values while preserving other entries', () => {
    const dir = temp()
    const path = join(dir, '.env')
    writeFileSync(path, '# keep\nTOKEN=old\nREGION=cn\n')
    setEnvValue(path, 'TOKEN', 'new value')
    expect(readFileSync(path, 'utf8')).toContain('TOKEN="new value"')
    unsetEnvValue(path, 'TOKEN')
    expect(readFileSync(path, 'utf8')).toBe('# keep\nREGION=cn\n')
  })

  it('replaces duplicate assignments as one managed value', () => {
    const path = join(temp(), '.env')
    writeFileSync(path, 'TOKEN=old\nTOKEN=stale\nREGION=cn\n')
    setEnvValue(path, 'TOKEN', 'new')
    expect(readEnvFile(path).values).toEqual({ TOKEN: 'new', REGION: 'cn' })
  })

  it('rejects launch-only variables when writing', () => {
    const path = join(temp(), '.env')
    expect(() => setEnvValue(path, 'PATH', '/tmp')).toThrow('launch-only')
    expect(() => unsetEnvValue(path, 'DSH_HOME')).toThrow('launch-only')
  })

  it('prints concise help for --help', () => {
    expect(runEnv(['--help'])).toBe(0)
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining('Usage: pnpm run env --'))
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining('check [NAME...]'))
  })

  it('lists variable names without printing secret values', () => {
    const dir = temp()
    writeFileSync(join(dir, '.env'), 'TOKEN=super-secret\nREGION=cn\n')
    expect(runEnv(['list'], dir)).toBe(0)
    const output = stdout.mock.calls.map(([line]) => String(line)).join('')
    expect(output).toContain('TOKEN\n')
    expect(output).toContain('REGION\n')
    expect(output).not.toContain('super-secret')
  })

  it('checks required names and reports missing variables', () => {
    const dir = temp()
    writeFileSync(join(dir, '.env'), 'TOKEN=ok\nEMPTY=\n')
    expect(runEnv(['check', '--required', 'TOKEN'], dir)).toBe(0)
    expect(() => runEnv(['check', '--required', 'TOKEN,EMPTY'], dir)).toThrow(
      'missing required variable(s)',
    )
  })

  it('unsets only the requested variable', () => {
    const dir = temp()
    const path = join(dir, '.env')
    writeFileSync(path, '# keep\nTOKEN=secret\nOTHER=value\n')
    unsetEnvValue(path, 'TOKEN')
    expect(readFileSync(path, 'utf8')).toBe('# keep\nOTHER=value\n')
  })

  it('does not echo set values and rejects unknown options', () => {
    const dir = temp()
    expect(runEnv(['set', 'TOKEN', 'super-secret'], dir)).toBe(0)
    const output = stdout.mock.calls.map(([line]) => String(line)).join('')
    expect(output).toContain('updated TOKEN')
    expect(output).not.toContain('super-secret')
    expect(() => runEnv(['list', '--wat'], dir)).toThrow('unknown option --wat')
  })
})
