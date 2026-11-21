import { describe, it, expect } from 'vitest'
import { pbkdf2Sync, createHash } from 'node:crypto'
import { sha256, hmacSha256, pbkdf2Sha256, bytesToHex } from '../../src/lib/sha256'

const enc = new TextEncoder()

describe('纯 JS SHA-256（用于 http 环境兜底）', () => {
  it('空字符串', () => {
    expect(bytesToHex(sha256(enc.encode('')))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
  })

  it('abc 的标准向量', () => {
    expect(bytesToHex(sha256(enc.encode('abc')))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('跨块的长输入与 node 一致', () => {
    const input = 'yacc'.repeat(200)
    const node = createHash('sha256').update(input).digest('hex')
    expect(bytesToHex(sha256(enc.encode(input)))).toBe(node)
  })

  it('中文输入与 node 一致', () => {
    const input = '反对校园霸凌，人人有责'
    const node = createHash('sha256').update(input).digest('hex')
    expect(bytesToHex(sha256(enc.encode(input)))).toBe(node)
  })
})

describe('HMAC-SHA256', () => {
  it('与 node 一致', () => {
    const key = enc.encode('secret-key')
    const msg = enc.encode('the quick brown fox')
    const node = createHash('sha256')
      .update(
        Buffer.concat([
          Buffer.from(
            Array.from(key).map((b) => b ^ 0x5c).concat(new Array(64 - key.length).fill(0x5c)),
          ),
          createHash('sha256')
            .update(
              Buffer.concat([
                Buffer.from(
                  Array.from(key).map((b) => b ^ 0x36).concat(new Array(64 - key.length).fill(0x36)),
                ),
                Buffer.from(msg),
              ]),
            )
            .digest(),
        ]),
      )
      .digest('hex')
    expect(bytesToHex(hmacSha256(key, msg))).toBe(node)
  })
})

describe('PBKDF2-HMAC-SHA256', () => {
  it('输出与 node 的 pbkdf2Sync 完全一致', () => {
    const cases: Array<[string, string, number]> = [
      ['abc123', 'aabbccddeeff0011', 1000],
      ['中文密码', '00112233', 500],
      ['', 'deadbeef', 100],
    ]
    for (const [password, saltHex, iterations] of cases) {
      const ours = bytesToHex(
        pbkdf2Sha256(enc.encode(password), Buffer.from(saltHex, 'hex'), iterations),
      )
      const node = pbkdf2Sync(
        password,
        Buffer.from(saltHex, 'hex'),
        iterations,
        32,
        'sha256',
      ).toString('hex')
      expect(ours).toBe(node)
    }
  })
})
