/**
 * 纯 JS 的 SHA-256 / HMAC-SHA256 / PBKDF2。
 *
 * 为什么需要它：浏览器的 `crypto.subtle` 只在「安全上下文」可用
 * （https 或 localhost）。用手机通过 http://192.168.x.x 打开时，
 * `crypto.subtle` 是 undefined，登录注册会直接失败。
 * 这里给一个等价实现兜底，算法一致，只是慢一些。
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n))

export function sha256(input: Uint8Array): Uint8Array {
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ])

  const len = input.length
  const blocks = Math.ceil((len + 9) / 64)
  const padded = new Uint8Array(blocks * 64)
  padded.set(input)
  padded[len] = 0x80

  const view = new DataView(padded.buffer)
  const bitLen = len * 8
  view.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000))
  view.setUint32(padded.length - 4, bitLen >>> 0)

  const w = new Uint32Array(64)

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4)

    for (let i = 16; i < 64; i += 1) {
      const x = w[i - 15]
      const y = w[i - 2]
      const s0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)
      const s1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
    }

    let a = h[0]
    let b = h[1]
    let c = h[2]
    let d = h[3]
    let e = h[4]
    let f = h[5]
    let g = h[6]
    let hh = h[7]

    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) >>> 0

      hh = g
      g = f
      f = e
      e = (d + t1) >>> 0
      d = c
      c = b
      b = a
      a = (t1 + t2) >>> 0
    }

    h[0] = (h[0] + a) >>> 0
    h[1] = (h[1] + b) >>> 0
    h[2] = (h[2] + c) >>> 0
    h[3] = (h[3] + d) >>> 0
    h[4] = (h[4] + e) >>> 0
    h[5] = (h[5] + f) >>> 0
    h[6] = (h[6] + g) >>> 0
    h[7] = (h[7] + hh) >>> 0
  }

  const out = new Uint8Array(32)
  const outView = new DataView(out.buffer)
  for (let i = 0; i < 8; i += 1) outView.setUint32(i * 4, h[i])
  return out
}

const BLOCK = 64

export function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  let k = key
  if (k.length > BLOCK) k = sha256(k)
  const padded = new Uint8Array(BLOCK)
  padded.set(k)

  const inner = new Uint8Array(BLOCK + message.length)
  const outer = new Uint8Array(BLOCK + 32)
  for (let i = 0; i < BLOCK; i += 1) {
    inner[i] = padded[i] ^ 0x36
    outer[i] = padded[i] ^ 0x5c
  }
  inner.set(message, BLOCK)
  outer.set(sha256(inner), BLOCK)
  return sha256(outer)
}

/** PBKDF2-HMAC-SHA256，输出 32 字节 */
export function pbkdf2Sha256(
  password: Uint8Array,
  salt: Uint8Array,
  iterations: number,
): Uint8Array {
  const block = new Uint8Array(salt.length + 4)
  block.set(salt)
  block[salt.length + 3] = 0x01

  let u = hmacSha256(password, block)
  const t = new Uint8Array(u)

  for (let i = 1; i < iterations; i += 1) {
    u = hmacSha256(password, u)
    for (let j = 0; j < t.length; j += 1) t[j] ^= u[j]
  }
  return t
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, '0')
  }
  return out
}

export function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(Math.floor(hex.length / 2))
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

const encoder = new TextEncoder()

/** 纯 JS 版 PBKDF2，返回 32 字节的十六进制字符串 */
export function pbkdf2Hex(
  password: string,
  saltHex: string,
  iterations: number,
): string {
  return bytesToHex(
    pbkdf2Sha256(encoder.encode(password), hexToBytes(saltHex), iterations),
  )
}
