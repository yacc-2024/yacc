const encoder = new TextEncoder()
const ITERATIONS = 100_000

export function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: fromHex(saltHex) as unknown as BufferSource,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    256,
  )
  return toHex(bits)
}

export async function verifyPassword(
  password: string,
  saltHex: string,
  expected: string,
): Promise<boolean> {
  const actual = await hashPassword(password, saltHex)
  // 定长比较，避免逐字节提前返回
  if (actual.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < actual.length; i += 1) {
    diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return toHex(digest)
}

/** 生成形如 YACC-7K2M-9QX4 的激活密钥 */
export function generateKey(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const pick = (n: number) =>
    Array.from(crypto.getRandomValues(new Uint8Array(n)))
      .map((b) => alphabet[b % alphabet.length])
      .join('')
  return `YACC-${pick(4)}-${pick(4)}`
}
