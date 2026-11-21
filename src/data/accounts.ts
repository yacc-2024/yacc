import type { Account, Session } from './schema'
import { ACCOUNTS_KEY, SESSION_KEY } from './schema'
import { storageDel, storageGet, storageSet } from './storage'
import { pbkdf2Hex } from '../lib/sha256'

export const PBKDF2_ITERATIONS = 100_000
/** 纯 JS 兜底用更少的轮数：JS 比原生慢一个数量级，2 万轮约 100–300ms */
export const JS_PBKDF2_ITERATIONS = 20_000

/**
 * `crypto.subtle` 只在安全上下文（https / localhost）存在。
 * 手机通过 http://192.168.x.x 访问时它是 undefined。
 */
export function isSecureCryptoAvailable(): boolean {
  return typeof globalThis.crypto !== 'undefined' && !!globalThis.crypto.subtle
}
const SESSION_DAYS = 7

export class AuthError extends Error {}

const enc = new TextEncoder()

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function randomSalt(): Uint8Array {
  const salt = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(salt)
  } else {
    for (let i = 0; i < salt.length; i += 1) salt[i] = Math.floor(Math.random() * 256)
  }
  return salt
}

export async function deriveHash(
  password: string,
  saltHex: string,
  iterations = PBKDF2_ITERATIONS,
): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    throw new AuthError('当前浏览器不支持安全哈希，请换用其他浏览器')
  }
  const key = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: fromHex(saltHex) as unknown as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    key,
    256,
  )
  return toHex(bits)
}

/* ---------------- 密码哈希（自动选择原生 / 纯 JS） ---------------- */

type Algo = 'native' | 'js'

interface ParsedHash {
  algo: Algo
  iterations: number
  hex: string
}

const NATIVE_RE = /^pbkdf2-sha256\$(\d+)\$([0-9a-f]{64})$/
const JS_RE = /^pbkdf2-sha256-js\$(\d+)\$([0-9a-f]{64})$/
const LEGACY_RE = /^[0-9a-f]{64}$/

export function parseStoredHash(value: string): ParsedHash | null {
  const native = NATIVE_RE.exec(value)
  if (native) {
    return { algo: 'native', iterations: Number(native[1]), hex: native[2] }
  }
  const js = JS_RE.exec(value)
  if (js) {
    return { algo: 'js', iterations: Number(js[1]), hex: js[2] }
  }
  // 旧数据：裸的 64 位十六进制，等价于原生 10 万轮
  if (LEGACY_RE.test(value)) {
    return { algo: 'native', iterations: PBKDF2_ITERATIONS, hex: value }
  }
  return null
}

/** 根据当前环境选择算法，并把算法写进结果里，校验时才知道怎么算 */
export async function hashPassword(
  password: string,
  saltHex: string,
): Promise<string> {
  if (isSecureCryptoAvailable()) {
    const hex = await deriveHash(password, saltHex, PBKDF2_ITERATIONS)
    return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${hex}`
  }
  const hex = pbkdf2Hex(password, saltHex, JS_PBKDF2_ITERATIONS)
  return `pbkdf2-sha256-js$${JS_PBKDF2_ITERATIONS}$${hex}`
}

export async function verifyPassword(
  password: string,
  saltHex: string,
  stored: string,
): Promise<boolean> {
  const parsed = parseStoredHash(stored)
  if (!parsed) return false

  if (parsed.algo === 'native') {
    if (!isSecureCryptoAvailable()) {
      throw new AuthError(
        '这个账号是在 https 或 localhost 下创建的，当前地址无法验证密码。请换回 https，或重新注册一个。',
      )
    }
    const hex = await deriveHash(password, saltHex, parsed.iterations)
    return hex === parsed.hex
  }

  const hex = pbkdf2Hex(password, saltHex, parsed.iterations)
  return hex === parsed.hex
}

export async function listAccounts(): Promise<Account[]> {
  const list = await storageGet<Account[]>(ACCOUNTS_KEY)
  return Array.isArray(list) ? list : []
}

async function saveAccounts(list: Account[]): Promise<void> {
  await storageSet(ACCOUNTS_KEY, list)
}

export interface RegisterInput {
  name: string
  password: string
  inviteCode: string
  expectedInviteCode: string
  role?: 'admin' | 'member'
  memberId?: string | null
}

export async function register(input: RegisterInput): Promise<Account> {
  const name = input.name.trim()
  if (name.length < 2 || name.length > 12) {
    throw new AuthError('昵称需要 2–12 个字符')
  }
  if (input.password.length < 6) {
    throw new AuthError('密码至少 6 位')
  }
  if (input.role !== 'admin') {
    if (input.inviteCode.trim().toUpperCase() !== input.expectedInviteCode.trim().toUpperCase()) {
      throw new AuthError('邀请码不对')
    }
  }
  const accounts = await listAccounts()
  if (accounts.some((a) => a.name.trim() === name)) {
    throw new AuthError('这个昵称已经有人用了')
  }
  const salt = toHex(randomSalt().buffer as ArrayBuffer)
  const passwordHash = await hashPassword(input.password, salt)
  const account: Account = {
    id: `u-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`,
    name,
    passwordHash,
    salt,
    role: input.role === 'admin' ? 'admin' : 'member',
    memberId: input.memberId ?? null,
    createdAt: new Date().toISOString(),
  }
  await saveAccounts([...accounts, account])
  return account
}

export async function login(name: string, password: string): Promise<Account> {
  const accounts = await listAccounts()
  const account = accounts.find((a) => a.name.trim() === name.trim())
  if (!account) throw new AuthError('没有这个账号')
  const ok = await verifyPassword(password, account.salt, account.passwordHash)
  if (!ok) throw new AuthError('密码不对，再试一次')
  return account
}

export async function changePassword(
  accountId: string,
  oldPassword: string,
  newPassword: string,
): Promise<Account> {
  if (newPassword.length < 6) throw new AuthError('新密码至少 6 位')
  const accounts = await listAccounts()
  const idx = accounts.findIndex((a) => a.id === accountId)
  if (idx < 0) throw new AuthError('账号不存在')
  const account = accounts[idx]
  const ok = await verifyPassword(oldPassword, account.salt, account.passwordHash)
  if (!ok) throw new AuthError('旧密码不对')
  const salt = toHex(randomSalt().buffer as ArrayBuffer)
  const passwordHash = await hashPassword(newPassword, salt)
  const next: Account = { ...account, salt, passwordHash }
  accounts[idx] = next
  await saveAccounts(accounts)
  return next
}

export async function renameAccount(accountId: string, name: string): Promise<Account> {
  const trimmed = name.trim()
  if (trimmed.length < 2 || trimmed.length > 12) {
    throw new AuthError('昵称需要 2–12 个字符')
  }
  const accounts = await listAccounts()
  if (accounts.some((a) => a.id !== accountId && a.name.trim() === trimmed)) {
    throw new AuthError('这个昵称已经有人用了')
  }
  const idx = accounts.findIndex((a) => a.id === accountId)
  if (idx < 0) throw new AuthError('账号不存在')
  const next = { ...accounts[idx], name: trimmed }
  accounts[idx] = next
  await saveAccounts(accounts)
  return next
}

export async function setSession(accountId: string): Promise<Session> {
  const session: Session = {
    accountId,
    expiresAt: new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString(),
  }
  await storageSet(SESSION_KEY, session)
  return session
}

export async function loadSessionAccount(): Promise<Account | null> {
  const session = await storageGet<Session>(SESSION_KEY)
  if (!session || typeof session.expiresAt !== 'string') return null
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    await storageDel(SESSION_KEY)
    return null
  }
  const accounts = await listAccounts()
  return accounts.find((a) => a.id === session.accountId) ?? null
}

export async function clearSession(): Promise<void> {
  await storageDel(SESSION_KEY)
}

export async function hasAnyAccount(): Promise<boolean> {
  const accounts = await listAccounts()
  return accounts.length > 0
}

/** 仅测试 */
export function __resetAccountsForTest(accounts: Account[]): Promise<void> {
  return saveAccounts(accounts)
}
