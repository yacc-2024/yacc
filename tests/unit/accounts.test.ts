import { describe, it, expect, beforeEach } from 'vitest'
import {
  deriveHash,
  register,
  login,
  changePassword,
  setSession,
  loadSessionAccount,
  clearSession,
  listAccounts,
  renameAccount,
  AuthError,
} from '../../src/data/accounts'
import {
  hashPassword,
  verifyPassword,
  isSecureCryptoAvailable,
  parseStoredHash,
  JS_PBKDF2_ITERATIONS,
} from '../../src/data/accounts'
import { __resetStorage, storageSet } from '../../src/data/storage'
import { SESSION_KEY } from '../../src/data/schema'

const invite = 'YACC2026'

beforeEach(() => {
  __resetStorage()
})

describe('deriveHash', () => {
  it('同密码同盐得到同一个哈希', async () => {
    const a = await deriveHash('abc123', 'aabbcc')
    const b = await deriveHash('abc123', 'aabbcc')
    expect(a).toBe(b)
  })
  it('不同盐得到不同哈希', async () => {
    const a = await deriveHash('abc123', 'aabbcc')
    const b = await deriveHash('abc123', 'ddeeff')
    expect(a).not.toBe(b)
  })
  it('哈希不等于明文', async () => {
    const h = await deriveHash('abc123', 'aabbcc')
    expect(h).not.toBe('abc123')
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('register / login', () => {
  it('注册后能登录', async () => {
    await register({
      name: '导演',
      password: 'abc123',
      inviteCode: invite,
      expectedInviteCode: invite,
    })
    const acc = await login('导演', 'abc123')
    expect(acc.name).toBe('导演')
    expect(acc.role).toBe('member')
  })

  it('密码不落库明文', async () => {
    await register({
      name: '导演',
      password: 'abc123',
      inviteCode: invite,
      expectedInviteCode: invite,
    })
    const accounts = await listAccounts()
    expect(accounts[0].passwordHash).not.toContain('abc123')
    expect(JSON.stringify(accounts)).not.toContain('"abc123"')
  })

  it('邀请码错误被拒', async () => {
    await expect(
      register({
        name: '导演',
        password: 'abc123',
        inviteCode: 'WRONG',
        expectedInviteCode: invite,
      }),
    ).rejects.toThrow(AuthError)
  })

  it('昵称重复被拒', async () => {
    await register({
      name: '导演',
      password: 'abc123',
      inviteCode: invite,
      expectedInviteCode: invite,
    })
    await expect(
      register({
        name: '导演',
        password: 'xyz789',
        inviteCode: invite,
        expectedInviteCode: invite,
      }),
    ).rejects.toThrow('昵称')
  })

  it('密码太短被拒', async () => {
    await expect(
      register({
        name: '导演',
        password: '123',
        inviteCode: invite,
        expectedInviteCode: invite,
      }),
    ).rejects.toThrow('6')
  })

  it('密码错误登录失败', async () => {
    await register({
      name: '导演',
      password: 'abc123',
      inviteCode: invite,
      expectedInviteCode: invite,
    })
    await expect(login('导演', 'wrong')).rejects.toThrow('密码')
  })

  it('账号不存在', async () => {
    await expect(login('没人', 'abc123')).rejects.toThrow('没有这个账号')
  })

  it('管理员注册不需要邀请码', async () => {
    const acc = await register({
      name: '管理员',
      password: 'abc123',
      inviteCode: '',
      expectedInviteCode: invite,
      role: 'admin',
    })
    expect(acc.role).toBe('admin')
  })
})

describe('session', () => {
  it('登录后能读回账号', async () => {
    const acc = await register({
      name: '导演',
      password: 'abc123',
      inviteCode: invite,
      expectedInviteCode: invite,
    })
    await setSession(acc.id)
    const back = await loadSessionAccount()
    expect(back?.id).toBe(acc.id)
  })

  it('过期的会话自动清除', async () => {
    const acc = await register({
      name: '导演',
      password: 'abc123',
      inviteCode: invite,
      expectedInviteCode: invite,
    })
    await storageSet(SESSION_KEY, {
      accountId: acc.id,
      expiresAt: '2020-01-01T00:00:00.000Z',
    })
    expect(await loadSessionAccount()).toBeNull()
  })

  it('退出后读不到', async () => {
    const acc = await register({
      name: '导演',
      password: 'abc123',
      inviteCode: invite,
      expectedInviteCode: invite,
    })
    await setSession(acc.id)
    await clearSession()
    expect(await loadSessionAccount()).toBeNull()
  })
})

describe('changePassword / rename', () => {
  it('改密码后旧密码失效', async () => {
    const acc = await register({
      name: '导演',
      password: 'abc123',
      inviteCode: invite,
      expectedInviteCode: invite,
    })
    await changePassword(acc.id, 'abc123', 'newpass')
    await expect(login('导演', 'abc123')).rejects.toThrow()
    const ok = await login('导演', 'newpass')
    expect(ok.id).toBe(acc.id)
  })

  it('旧密码错不能改', async () => {
    const acc = await register({
      name: '导演',
      password: 'abc123',
      inviteCode: invite,
      expectedInviteCode: invite,
    })
    await expect(changePassword(acc.id, 'wrong', 'newpass')).rejects.toThrow('旧密码')
  })

  it('改名后昵称唯一', async () => {
    const a = await register({
      name: '甲乙',
      password: 'abc123',
      inviteCode: invite,
      expectedInviteCode: invite,
    })
    await register({
      name: '乙丙',
      password: 'abc123',
      inviteCode: invite,
      expectedInviteCode: invite,
    })
    await expect(renameAccount(a.id, '乙丙')).rejects.toThrow('昵称')
    const renamed = await renameAccount(a.id, '丙丁')
    expect(renamed.name).toBe('丙丁')
  })
})


/* ------------------------------------------------------------------
   http 环境兜底：crypto.subtle 只在 https / localhost 存在
   ------------------------------------------------------------------ */

function hideSubtle(): () => void {
  Object.defineProperty(globalThis.crypto, 'subtle', {
    value: undefined,
    configurable: true,
  })
  return () => {
    delete (globalThis.crypto as { subtle?: unknown }).subtle
  }
}

describe('不安全上下文（http://192.168.x.x）下的密码哈希', () => {
  it('正常环境用原生 PBKDF2，并带算法前缀', async () => {
    expect(isSecureCryptoAvailable()).toBe(true)
    const stored = await hashPassword('abc123', 'aabbccdd')
    expect(stored.startsWith('pbkdf2-sha256$100000$')).toBe(true)
    expect(parseStoredHash(stored)?.algo).toBe('native')
  })

  it('没有 subtle 时注册仍然成功，用的是 JS 实现', async () => {
    const restore = hideSubtle()
    try {
      expect(isSecureCryptoAvailable()).toBe(false)
      const acc = await register({
        name: '外网成员',
        password: 'abc123',
        inviteCode: invite,
        expectedInviteCode: invite,
      })
      expect(acc.passwordHash.startsWith(`pbkdf2-sha256-js$${JS_PBKDF2_ITERATIONS}$`)).toBe(
        true,
      )
      expect(parseStoredHash(acc.passwordHash)?.algo).toBe('js')

      const back = await login('外网成员', 'abc123')
      expect(back.id).toBe(acc.id)
      await expect(login('外网成员', 'wrong')).rejects.toThrow('密码')
    } finally {
      restore()
    }
  })

  it('JS 哈希的账号，回到 https 后依然能登录', async () => {
    const restore = hideSubtle()
    let acc
    try {
      acc = await register({
        name: '外网成员',
        password: 'abc123',
        inviteCode: invite,
        expectedInviteCode: invite,
      })
    } finally {
      restore()
    }
    expect(isSecureCryptoAvailable()).toBe(true)
    const back = await login('外网成员', 'abc123')
    expect(back.id).toBe(acc.id)
  })

  it('原生哈希的账号在 http 下给出可读提示，而不是"换个浏览器"', async () => {
    await register({
      name: '本机成员',
      password: 'abc123',
      inviteCode: invite,
      expectedInviteCode: invite,
    })
    const restore = hideSubtle()
    try {
      await expect(login('本机成员', 'abc123')).rejects.toThrow(/https 或 localhost/)
    } finally {
      restore()
    }
  })

  it('旧格式（裸 64 位十六进制）仍能被识别', () => {
    const legacy = 'a'.repeat(64)
    expect(parseStoredHash(legacy)).toEqual({
      algo: 'native',
      iterations: 100_000,
      hex: legacy,
    })
  })

  it('乱码哈希返回 false，不抛错', async () => {
    expect(parseStoredHash('not-a-hash')).toBeNull()
    expect(await verifyPassword('abc', 'aabb', 'not-a-hash')).toBe(false)
  })
})
