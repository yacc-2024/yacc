// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { createRequire } from 'node:module'
import { createNodeDb, type DB } from '../../server/db'
import {
  ensureChangelogSeed,
  ensureSuperadmin,
  handleApi,
  normaliseLegacyUids,
  type Env,
} from '../../server/app'
import { validContent } from '../fixtures'

// 用 createRequire 加载，避免打包器把 node:sqlite 当普通依赖去解析
const nodeRequire = createRequire(import.meta.url)
const { DatabaseSync } = nodeRequire('node:sqlite') as {
  DatabaseSync: new (path: string) => never
}

const ADMIN_CODE = 'TEST-ADMIN-CODE'

let env: Env

beforeEach(() => {
  env = {
    db: createNodeDb(':memory:', DatabaseSync as never) as DB,
    adminCode: ADMIN_CODE,
    disableBootstrapSuper: '1',
  }
})

interface Res<T = any> {
  status: number
  body: T
}

async function call<T = any>(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<Res<T>> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (token) headers.authorization = `Bearer ${token}`
  const res = await handleApi(
    new Request(`http://localhost/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
  )
  return { status: res.status, body: await res.json() }
}

async function bootstrapAdmin(name = '导演'): Promise<string> {
  const res = await call('POST', '/auth/activate-admin', {
    code: ADMIN_CODE,
    name,
    password: 'abc123',
  })
  expect(res.status).toBe(200)
  return res.body.data.token
}

async function makeKey(token: string, kind: 'member' | 'visitor' = 'member'): Promise<string> {
  const res = await call('POST', '/admin/keys', { kind, count: 1, expiresInDays: 30 }, token)
  expect(res.status).toBe(200)
  return res.body.data.keys[0]
}

async function registerWithKey(key: string, name: string): Promise<Res> {
  return call('POST', '/auth/register', { name, password: 'abc123', key })
}

describe('内容发布', () => {
  it('还没发布时返回 404', async () => {
    const res = await call('GET', '/content')
    expect(res.status).toBe(404)
  })

  it('未登录不能发布', async () => {
    const res = await call('POST', '/admin/publish', { content: validContent() })
    expect(res.status).toBe(401)
  })

  it('管理员发布后所有人能读到', async () => {
    const token = await bootstrapAdmin()
    const content = validContent()
    content.home.claim = '线上内容'
    const pub = await call('POST', '/admin/publish', { content }, token)
    expect(pub.status).toBe(200)

    const got = await call('GET', '/content')
    expect(got.status).toBe(200)
    expect(got.body.home.claim).toBe('线上内容')
  })

  it('内容不合法时拒绝发布，且不覆盖线上版本', async () => {
    const token = await bootstrapAdmin()
    await call('POST', '/admin/publish', { content: validContent() }, token)

    const bad = validContent() as any
    bad.episodes[0].seasonId = 'not-exist'
    const res = await call('POST', '/admin/publish', { content: bad }, token)
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('校验')

    const got = await call('GET', '/content')
    expect(got.status).toBe(200)
  })
})

describe('管理员初始化', () => {
  it('口令错误不能创建', async () => {
    const res = await call('POST', '/auth/activate-admin', {
      code: 'WRONG',
      name: '导演',
      password: 'abc123',
    })
    expect(res.status).toBe(401)
  })

  it('口令正确创建管理员，并附带初始船员密钥', async () => {
    const res = await call('POST', '/auth/activate-admin', {
      code: ADMIN_CODE,
      name: '导演',
      password: 'abc123',
    })
    expect(res.status).toBe(200)
    expect(res.body.data.user.role).toBe('superadmin')
    expect(res.body.data.keys.length).toBeGreaterThan(0)
  })

  it('只能创建一次', async () => {
    await bootstrapAdmin()
    const again = await call('POST', '/auth/activate-admin', {
      code: ADMIN_CODE,
      name: '第二个',
      password: 'abc123',
    })
    expect(again.status).toBe(409)
  })
})

describe('密钥注册', () => {
  it('无效密钥被拒', async () => {
    await bootstrapAdmin()
    const res = await registerWithKey('YACC-XXXX-XXXX', '同学甲')
    expect(res.status).toBe(401)
  })

  it('密钥只能使用一次', async () => {
    const token = await bootstrapAdmin()
    const key = await makeKey(token)
    expect((await registerWithKey(key, '同学甲')).status).toBe(200)
    expect((await registerWithKey(key, '同学乙')).status).toBe(409)
  })

  it('非管理员注册后统一是「认证访客」', async () => {
    const token = await bootstrapAdmin()
    const key = await makeKey(token, 'member')
    const res = await registerWithKey(key, '同学甲')
    expect(res.status).toBe(200)
    // 即使拿的是老的船员密钥，身份也按认证访客处理
    expect(res.body.data.user.role).toBe('visitor')
    expect(res.body.data.user.verified).toBe(true)
  })

  it('访客密钥注册出来是 visitor', async () => {
    const token = await bootstrapAdmin()
    const key = await makeKey(token, 'visitor')
    const res = await registerWithKey(key, '访客甲')
    expect(res.body.data.user.role).toBe('visitor')
  })

  it('昵称重复被拒', async () => {
    const token = await bootstrapAdmin()
    const k1 = await makeKey(token)
    const k2 = await makeKey(token)
    await registerWithKey(k1, '同学甲')
    const res = await registerWithKey(k2, '同学甲')
    expect(res.status).toBe(409)
  })
})

describe('登录', () => {
  it('密码错误 401', async () => {
    const token = await bootstrapAdmin()
    await makeKey(token)
    const res = await call('POST', '/auth/login', { name: '导演', password: 'nope' })
    expect(res.status).toBe(401)
  })

  it('登录后能拿到自己的身份', async () => {
    const token = await bootstrapAdmin()
    const res = await call('GET', '/auth/me', undefined, token)
    expect(res.status).toBe(200)
    expect(res.body.data.user.role).toBe('superadmin')
  })

  it('退出后 token 失效', async () => {
    const token = await bootstrapAdmin()
    await call('POST', '/auth/logout', undefined, token)
    const res = await call('GET', '/auth/me', undefined, token)
    expect(res.status).toBe(401)
  })
})

describe('评论', () => {
  async function setup() {
    const adminToken = await bootstrapAdmin()
    const key = await makeKey(adminToken, 'visitor')
    const reg = await registerWithKey(key, '访客甲')
    const visitorToken = reg.body.data.token as string
    return { adminToken, visitorToken }
  }

  it('未登录不能评论', async () => {
    const res = await call('POST', '/comments', {
      targetType: 'episode',
      targetId: 'ep-1-1',
      body: '你好',
    })
    expect(res.status).toBe(401)
  })

  it('未认证的用户不能评论', async () => {
    const { adminToken, visitorToken } = await setup()
    const me = await call('GET', '/auth/me', undefined, visitorToken)
    const userId = me.body.data.user.id
    await call('POST', `/admin/users/${userId}`, { verified: false }, adminToken)

    const res = await call(
      'POST',
      '/comments',
      { targetType: 'episode', targetId: 'ep-1-1', body: '你好' },
      visitorToken,
    )
    expect(res.status).toBe(403)
  })

  it('默认需要审核：发出来是 pending，公开列表看不到', async () => {
    const { visitorToken } = await setup()
    const created = await call(
      'POST',
      '/comments',
      { targetType: 'episode', targetId: 'ep-1-1', body: '这条会被审核' },
      visitorToken,
    )
    expect(created.status).toBe(200)
    expect(created.body.data.status).toBe('pending')

    const list = await call('GET', '/comments?targetType=episode&targetId=ep-1-1')
    expect(list.body.data.comments).toHaveLength(0)
  })

  it('管理员通过后公开可见', async () => {
    const { adminToken, visitorToken } = await setup()
    const created = await call(
      'POST',
      '/comments',
      { targetType: 'episode', targetId: 'ep-1-1', body: '通过我' },
      visitorToken,
    )
    const id = created.body.data.id

    const pending = await call('GET', '/admin/comments?status=pending', undefined, adminToken)
    expect(pending.body.data.comments).toHaveLength(1)

    await call('POST', `/admin/comments/${id}`, { status: 'published' }, adminToken)

    const list = await call('GET', '/comments?targetType=episode&targetId=ep-1-1')
    expect(list.body.data.comments).toHaveLength(1)
    expect(list.body.data.comments[0].author).toBe('访客甲')
  })

  it('关掉审核后直接发布', async () => {
    const { adminToken, visitorToken } = await setup()
    await call('POST', '/admin/settings', { moderation: 'off' }, adminToken)
    const created = await call(
      'POST',
      '/comments',
      { targetType: 'episode', targetId: 'ep-1-1', body: '直接可见' },
      visitorToken,
    )
    expect(created.body.data.status).toBe('published')

    const list = await call('GET', '/comments?targetType=episode&targetId=ep-1-1')
    expect(list.body.data.comments).toHaveLength(1)
  })

  it('空内容和超长内容被拒', async () => {
    const { visitorToken } = await setup()
    const empty = await call(
      'POST',
      '/comments',
      { targetType: 'episode', targetId: 'ep-1-1', body: '   ' },
      visitorToken,
    )
    expect(empty.status).toBe(400)

    const long = await call(
      'POST',
      '/comments',
      { targetType: 'episode', targetId: 'ep-1-1', body: '啊'.repeat(201) },
      visitorToken,
    )
    expect(long.status).toBe(400)
  })

  it('只能删自己的评论', async () => {
    const { adminToken, visitorToken } = await setup()
    const otherKey = await makeKey(adminToken, 'visitor')
    const other = await registerWithKey(otherKey, '访客乙')
    const otherToken = other.body.data.token

    const created = await call(
      'POST',
      '/comments',
      { targetType: 'episode', targetId: 'ep-1-1', body: '我发的' },
      visitorToken,
    )
    const id = created.body.data.id

    const denied = await call('DELETE', `/comments/${id}`, undefined, otherToken)
    expect(denied.status).toBe(403)

    const okRes = await call('DELETE', `/comments/${id}`, undefined, visitorToken)
    expect(okRes.status).toBe(200)
  })
})

describe('点赞', () => {
  it('未登录不能点赞', async () => {
    const res = await call('POST', '/reactions/toggle', {
      targetType: 'episode',
      targetId: 'ep-1-1',
    })
    expect(res.status).toBe(401)
  })

  it('点赞与取消，计数正确', async () => {
    const adminToken = await bootstrapAdmin()
    const key = await makeKey(adminToken, 'visitor')
    const reg = await registerWithKey(key, '访客甲')
    const token = reg.body.data.token

    const first = await call(
      'POST',
      '/reactions/toggle',
      { targetType: 'episode', targetId: 'ep-1-1' },
      token,
    )
    expect(first.body.data).toEqual({ active: true, count: 1 })

    const second = await call(
      'POST',
      '/reactions/toggle',
      { targetType: 'episode', targetId: 'ep-1-1' },
      token,
    )
    expect(second.body.data).toEqual({ active: false, count: 0 })
  })

  it('同一个人不会重复计数', async () => {
    const adminToken = await bootstrapAdmin()
    const key = await makeKey(adminToken, 'visitor')
    const token = (await registerWithKey(key, '访客甲')).body.data.token

    await call('POST', '/reactions/toggle', { targetType: 'episode', targetId: 'x' }, token)
    const list = await call('GET', '/reactions?targetType=episode&targetId=x', undefined, token)
    expect(list.body.data).toEqual({ count: 1, mine: true })
  })
})

describe('管理端权限', () => {
  it('普通成员打不开管理接口', async () => {
    const adminToken = await bootstrapAdmin()
    const key = await makeKey(adminToken, 'member')
    const token = (await registerWithKey(key, '同学甲')).body.data.token
    const res = await call('GET', '/admin/keys', undefined, token)
    expect(res.status).toBe(403)
  })

  it('管理员能吊销未使用的密钥', async () => {
    const token = await bootstrapAdmin()
    const key = await makeKey(token)
    const del = await call('DELETE', `/admin/keys/${key}`, undefined, token)
    expect(del.status).toBe(200)
    const reg = await registerWithKey(key, '同学甲')
    expect(reg.status).toBe(401)
  })
})

describe('账号自助修改', () => {
  it('改昵称后生效，重名被拒', async () => {
    const token = await bootstrapAdmin()
    const key = await makeKey(token)
    await registerWithKey(key, '同学甲')

    const renamed = await call('POST', '/auth/rename', { name: '新名字' }, token)
    expect(renamed.status).toBe(200)

    const clash = await call('POST', '/auth/rename', { name: '同学甲' }, token)
    expect(clash.status).toBe(409)
  })

  it('改密码后旧密码失效', async () => {
    const token = await bootstrapAdmin()
    const bad = await call(
      'POST',
      '/auth/password',
      { oldPassword: 'wrong', newPassword: 'newpass' },
      token,
    )
    expect(bad.status).toBe(401)

    const good = await call(
      'POST',
      '/auth/password',
      { oldPassword: 'abc123', newPassword: 'newpass' },
      token,
    )
    expect(good.status).toBe(200)

    expect((await call('POST', '/auth/login', { name: '导演', password: 'abc123' })).status).toBe(401)
    expect((await call('POST', '/auth/login', { name: '导演', password: 'newpass' })).status).toBe(200)
  })

  it('健康检查返回服务名', async () => {
    const res = await call('GET', '/health')
    expect(res.status).toBe(200)
    expect(res.body.data.service).toBe('yacc')
  })
})

describe('账号资料（v1.0.1）', () => {
  it('注册就发一个固定的数字账号 ID', async () => {
    const token = await bootstrapAdmin()
    const k1 = await makeKey(token, 'visitor')
    const k2 = await makeKey(token, 'visitor')
    const a = await registerWithKey(k1, '访客甲')
    const b = await registerWithKey(k2, '访客乙')

    const uidA = a.body.data.user.uid
    const uidB = b.body.data.user.uid
    expect(typeof uidA).toBe('number')
    // 访客密钥默认是认证成员（2 开头，8 年级 0 班）
    expect(uidA).toBeGreaterThanOrEqual(20000)
    expect(uidA).toBeLessThan(30000)
    expect(uidB).toBe(uidA + 1)
  })

  it('管理员也有自己的数字 ID', async () => {
    const token = await bootstrapAdmin('导演')
    const me = await call('GET', '/auth/me', undefined, token)
    expect(me.body.data.user.uid).toEqual(expect.any(Number))
  })

  it('改名后数字 ID 不变', async () => {
    const token = await bootstrapAdmin()
    const before = await call('GET', '/auth/me', undefined, token)
    await call('POST', '/auth/profile', { name: '新名字' }, token)
    const after = await call('GET', '/auth/me', undefined, token)
    expect(after.body.data.user.name).toBe('新名字')
    expect(after.body.data.user.uid).toBe(before.body.data.user.uid)
  })

  it('可以设置和清除头像', async () => {
    const token = await bootstrapAdmin()
    const set = await call(
      'POST',
      '/auth/profile',
      { avatar: 'https://example.com/a.jpg' },
      token,
    )
    expect(set.body.data.user.avatar).toBe('https://example.com/a.jpg')

    const cleared = await call('POST', '/auth/profile', { avatar: null }, token)
    expect(cleared.body.data.user.avatar).toBeNull()
  })

  it('头像地址不合法会被拒', async () => {
    const token = await bootstrapAdmin()
    const res = await call('POST', '/auth/profile', { avatar: 'javascript:alert(1)' }, token)
    expect(res.status).toBe(400)
  })

  it('昵称重复仍然被拒', async () => {
    const token = await bootstrapAdmin()
    const key = await makeKey(token, 'visitor')
    await registerWithKey(key, '占名字的人')
    const res = await call('POST', '/auth/profile', { name: '占名字的人' }, token)
    expect(res.status).toBe(409)
  })
})


describe('单设备登录（v1.0.2）', () => {
  it('新设备登录后，旧设备的 token 立刻失效', async () => {
    const token = await bootstrapAdmin()
    await makeKey(token)

    const first = await call('POST', '/auth/login', { name: '导演', password: 'abc123' })
    const firstToken = first.body.data.token
    expect((await call('GET', '/auth/me', undefined, firstToken)).status).toBe(200)

    // 第二台设备登录同一账号
    const second = await call('POST', '/auth/login', { name: '导演', password: 'abc123' })
    expect(second.status).toBe(200)
    const secondToken = second.body.data.token

    // 旧设备被顶掉
    expect((await call('GET', '/auth/me', undefined, firstToken)).status).toBe(401)
    // 新设备正常
    expect((await call('GET', '/auth/me', undefined, secondToken)).status).toBe(200)
  })

  it('账号下始终只有一条会话', async () => {
    await bootstrapAdmin()
    await call('POST', '/auth/login', { name: '导演', password: 'abc123' })
    await call('POST', '/auth/login', { name: '导演', password: 'abc123' })
    const rows = await env.db
      .prepare('SELECT COUNT(*) AS n FROM sessions')
      .first<{ n: number }>()
    expect(Number(rows?.n)).toBe(1)
  })

  it('换设备登录不影响其他账号', async () => {
    const adminToken = await bootstrapAdmin()
    const key = await makeKey(adminToken, 'visitor')
    const reg = await registerWithKey(key, '访客甲')
    const visitorToken = reg.body.data.token

    await call('POST', '/auth/login', { name: '导演', password: 'abc123' })

    // 访客的会话不受管理员登录影响
    expect((await call('GET', '/auth/me', undefined, visitorToken)).status).toBe(200)
  })
})

describe('五位数字账号编号', () => {
  it('剧组成员：1 + 身份 + 季 + 顺序', async () => {
    const token = await bootstrapAdmin()
    // 编剧 = 2，第二季 = 2
    const res = await call(
      'POST',
      '/admin/keys',
      { kind: 'crew', role: 2, season: 2, count: 2, expiresInDays: 30 },
      token,
    )
    const [k1, k2] = res.body.data.keys
    const a = await registerWithKey(k1, '编剧甲')
    const b = await registerWithKey(k2, '编剧乙')
    expect(a.body.data.user.uid).toBe(12201)
    expect(b.body.data.user.uid).toBe(12202)
  })

  it('认证成员：2 + 年级 + 班级 + 顺序', async () => {
    const token = await bootstrapAdmin()
    const res = await call(
      'POST',
      '/admin/keys',
      { kind: 'member', grade: 8, klass: 7, count: 2, expiresInDays: 30 },
      token,
    )
    const [k1, k2] = res.body.data.keys
    const a = await registerWithKey(k1, '八七甲')
    const b = await registerWithKey(k2, '八七乙')
    expect(a.body.data.user.uid).toBe(28701)
    expect(b.body.data.user.uid).toBe(28702)
  })

  it('两季都参与用 9 表示', async () => {
    const token = await bootstrapAdmin()
    const res = await call(
      'POST',
      '/admin/keys',
      { kind: 'crew', role: 4, season: 9, count: 1, expiresInDays: 30 },
      token,
    )
    const reg = await registerWithKey(res.body.data.keys[0], '摄影甲')
    expect(reg.body.data.user.uid).toBe(14901)
  })

  it('普通访客不用密钥，编号 3 开头并依次排', async () => {
    const a = await call('POST', '/auth/register', { name: '路人甲', password: 'abc123' })
    const b = await call('POST', '/auth/register', { name: '路人乙', password: 'abc123' })
    expect(a.status).toBe(200)
    expect(a.body.data.user.uid).toBe(30001)
    expect(b.body.data.user.uid).toBe(30002)
    // 普通访客没有认证，不能评论
    const c = await call(
      'POST',
      '/comments',
      { targetType: 'episode', targetId: 'ep-1-1', body: '我能说话吗' },
      a.body.data.token,
    )
    expect(c.status).toBe(403)
  })

  it('同一台设备一天最多注册 3 个普通访客', async () => {
    const ip = '203.0.113.9'
    const reg = (name: string) =>
      call(
        'POST',
        '/auth/register',
        { name, password: 'abc123' },
        undefined,
      )
    // 通过 header 模拟同一 IP
    const doReg = async (name: string) => {
      const res = await handleApi(
        new Request('http://localhost/api/auth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
          body: JSON.stringify({ name, password: 'abc123' }),
        }),
        env,
      )
      return { status: res.status, body: await res.json() }
    }
    expect((await doReg('设备甲')).status).toBe(200)
    expect((await doReg('设备乙')).status).toBe(200)
    expect((await doReg('设备丙')).status).toBe(200)
    const fourth = await doReg('设备丁')
    expect(fourth.status).toBe(429)
    expect(reg).toBeTruthy()
  })

  it('用户主页能按编号查到', async () => {
    const token = await bootstrapAdmin()
    const res = await call(
      'POST',
      '/admin/keys',
      { kind: 'member', grade: 7, klass: 3, count: 1, expiresInDays: 30 },
      token,
    )
    await registerWithKey(res.body.data.keys[0], '七三班同学')
    const page = await call('GET', '/users/27301')
    expect(page.status).toBe(200)
    expect(page.body.data.user.name).toBe('七三班同学')
    expect(page.body.data.user.label).toContain('7 年级')
  })
})

describe('总管理员迁移（v1.0.4）', () => {
  it('老版本建的 yacc-admin 会被提升为总管理员', async () => {
    // 先让建表逻辑跑一遍
    await call('GET', '/health')

    // 模拟升级前的数据：role='admin'，没有 perms
    await env.db
      .prepare(
        `INSERT INTO users (id, uid, name, password_hash, salt, role, verified, created_at)
         VALUES ('u-old', 11901, 'yacc-admin', 'x', 'y', 'admin', 1, ?)`,
      )
      .bind(new Date().toISOString())
      .run()

    await ensureSuperadmin(env.db)

    const row = await env.db
      .prepare("SELECT role, perms FROM users WHERE name = 'yacc-admin'")
      .first<{ role: string; perms: string | null }>()
    expect(row?.role).toBe('superadmin')
    expect(row?.perms).toBeNull()
  })

  it('已经有总管理员时不会影响其他人', async () => {
    await bootstrapAdmin('导演')
    await env.db
      .prepare(
        `INSERT INTO users (id, uid, name, password_hash, salt, role, verified, created_at)
         VALUES ('u-sub', 12201, '副管理员', 'x', 'y', 'admin', 1, ?)`,
      )
      .bind(new Date().toISOString())
      .run()

    await call('GET', '/health')
    await ensureSuperadmin(env.db)

    const main = await env.db
      .prepare("SELECT role FROM users WHERE name = '导演'")
      .first<{ role: string }>()
    const sub = await env.db
      .prepare("SELECT role FROM users WHERE name = '副管理员'")
      .first<{ role: string }>()
    expect(main?.role).toBe('superadmin')
    expect(sub?.role).toBe('admin')
  })

  it('总管理员可以发放管理员密钥', async () => {
    const token = await bootstrapAdmin()
    const res = await call(
      'POST',
      '/admin/keys',
      { kind: 'admin', perms: ['content', 'comments'], count: 1, expiresInDays: 30 },
      token,
    )
    expect(res.status).toBe(200)

    const key = res.body.data.keys[0]
    const reg = await registerWithKey(key, '副管理员')
    expect(reg.status).toBe(200)
    expect(reg.body.data.user.role).toBe('admin')
    expect(reg.body.data.user.perms).toEqual(['content', 'comments'])
  })

  it('分管理员只能用被授予的权限', async () => {
    const token = await bootstrapAdmin()
    const res = await call(
      'POST',
      '/admin/keys',
      { kind: 'admin', perms: ['comments'], count: 1, expiresInDays: 30 },
      token,
    )
    const sub = await registerWithKey(res.body.data.keys[0], '只管评论')
    const subToken = sub.body.data.token

    // 评论可以看
    expect((await call('GET', '/admin/comments', undefined, subToken)).status).toBe(200)
    // 发内容不行
    expect(
      (await call('POST', '/admin/publish', { content: validContent() }, subToken)).status,
    ).toBe(403)
    // 发密钥不行
    expect((await call('GET', '/admin/keys', undefined, subToken)).status).toBe(403)
  })
})

describe('删除账号（v1.0.5）', () => {
  async function setup() {
    const adminToken = await bootstrapAdmin()
    const key = await makeKey(adminToken, 'visitor')
    const reg = await registerWithKey(key, '要删的人')
    return { adminToken, key, visitorToken: reg.body.data.token as string }
  }

  it('删除后账号、会话、评论一起消失', async () => {
    const { adminToken, visitorToken } = await setup()

    const me = await call('GET', '/auth/me', undefined, visitorToken)
    const userId = me.body.data.user.id

    // 先让他发一条评论（需审核关闭）
    await call('POST', '/admin/settings', { moderation: 'off' }, adminToken)
    await call(
      'POST',
      '/comments',
      { targetType: 'episode', targetId: 'ep-1-1', body: '待删除' },
      visitorToken,
    )

    const res = await call('DELETE', `/admin/users/${userId}`, undefined, adminToken)
    expect(res.status).toBe(200)

    // 账号没了
    expect((await call('GET', '/auth/me', undefined, visitorToken)).status).toBe(401)
    // 评论也没了
    const list = await call('GET', '/comments?targetType=episode&targetId=ep-1-1')
    expect(list.body.data.comments).toHaveLength(0)
  })

  it('不能删除自己', async () => {
    const adminToken = await bootstrapAdmin()
    const me = await call('GET', '/auth/me', undefined, adminToken)
    const res = await call('DELETE', `/admin/users/${me.body.data.user.id}`, undefined, adminToken)
    expect(res.status).toBe(400)
  })

  it('分管理员不能删除管理员，总管理员可以', async () => {
    const superToken = await bootstrapAdmin()
    const keyRes = await call(
      'POST',
      '/admin/keys',
      { kind: 'admin', perms: ['users'], count: 1, expiresInDays: 30 },
      superToken,
    )
    const subKey = keyRes.body.data.keys[0]
    const sub = await registerWithKey(subKey, '分管理员')
    const subToken = sub.body.data.token

    // 用分管理员去删总管理员 → 拒绝
    const superMe = await call('GET', '/auth/me', undefined, superToken)
    expect(
      (await call('DELETE', `/admin/users/${superMe.body.data.user.id}`, undefined, subToken)).status,
    ).toBe(403)

    // 总管理员删分管理员 → 成功
    const subMe = await call('GET', '/auth/me', undefined, subToken)
    expect(
      (await call('DELETE', `/admin/users/${subMe.body.data.user.id}`, undefined, superToken))
        .status,
    ).toBe(200)
  })

  it('删除后激活密钥可以重新发放', async () => {
    const { adminToken, key, visitorToken } = await setup()
    const me = await call('GET', '/auth/me', undefined, visitorToken)
    await call('DELETE', `/admin/users/${me.body.data.user.id}`, undefined, adminToken)

    const again = await registerWithKey(key, '换个人用')
    expect(again.status).toBe(200)
  })
})

describe('头像上传（data URL）', () => {
  const tinyJpeg =
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=='

  it('可以保存上传的图片', async () => {
    const token = await bootstrapAdmin()
    const res = await call('POST', '/auth/profile', { avatar: tinyJpeg }, token)
    expect(res.status).toBe(200)
    expect(res.body.data.user.avatar).toBe(tinyJpeg)
  })

  it('超大的图片会被拒', async () => {
    const token = await bootstrapAdmin()
    const huge = `data:image/jpeg;base64,${'A'.repeat(210_000)}`
    const res = await call('POST', '/auth/profile', { avatar: huge }, token)
    expect(res.status).toBe(400)
  })

  it('不是图片的 data URL 会被拒', async () => {
    const token = await bootstrapAdmin()
    const res = await call('POST', '/auth/profile', {
      avatar: 'data:text/html;base64,PHNjcmlwdD4=',
    }, token)
    expect(res.status).toBe(400)
  })
})

describe('强制编号与定制称号（v1.0.7）', () => {
  it('可以把编号改成不符合规则的任意值', async () => {
    const token = await bootstrapAdmin()
    const key = await makeKey(token, 'visitor')
    const reg = await registerWithKey(key, '改名的人')
    const id = reg.body.data.user.id

    // 99999 不符合任何身份规则，也允许
    const res = await call('POST', `/admin/users/${id}/uid`, { uid: 99999 }, token)
    expect(res.status).toBe(200)

    const me = await call('GET', '/auth/me', undefined, reg.body.data.token)
    expect(me.body.data.user.uid).toBe(99999)
  })

  it('编号被占用时会拒绝', async () => {
    const token = await bootstrapAdmin()
    const k1 = await makeKey(token, 'visitor')
    const k2 = await makeKey(token, 'visitor')
    const a = await registerWithKey(k1, '甲甲')
    const b = await registerWithKey(k2, '乙乙')

    const res = await call(
      'POST',
      `/admin/users/${a.body.data.user.id}/uid`,
      { uid: b.body.data.user.uid },
      token,
    )
    expect(res.status).toBe(409)
  })

  it('管理员可以发多个称号，主页默认展示第一个', async () => {
    const token = await bootstrapAdmin()
    const key = await makeKey(token, 'visitor')
    const reg = await registerWithKey(key, '有称号的人')
    const id = reg.body.data.user.id
    const uid = reg.body.data.user.uid

    const res = await call('POST', `/admin/users/${id}`, { titles: ['哦', '为', '位'] }, token)
    expect(res.status).toBe(200)

    const page = await call('GET', `/users/${uid}`)
    expect(page.body.data.user.titles).toEqual(['哦', '为', '位'])
    expect(page.body.data.user.shownTitles).toEqual(['哦'])
  })

  it('访客可以从自己的称号里挑最多三个展示', async () => {
    const token = await bootstrapAdmin()
    const key = await makeKey(token, 'visitor')
    const reg = await registerWithKey(key, '挑称号的人')
    const id = reg.body.data.user.id
    const uid = reg.body.data.user.uid
    const userToken = reg.body.data.token

    await call('POST', `/admin/users/${id}`, { titles: ['甲', '乙', '丙', '丁'] }, token)

    const res = await call('POST', '/auth/profile', { shownTitles: ['乙', '丁'] }, userToken)
    expect(res.status).toBe(200)

    const page = await call('GET', `/users/${uid}`)
    expect(page.body.data.user.shownTitles).toEqual(['乙', '丁'])
    expect(page.body.data.user.label).toBe('乙 · 丁')
  })

  it('不能展示管理员没给过的称号，也不能超过三个', async () => {
    const token = await bootstrapAdmin()
    const key = await makeKey(token, 'visitor')
    const reg = await registerWithKey(key, '越权的人')
    const id = reg.body.data.user.id
    const userToken = reg.body.data.token
    await call('POST', `/admin/users/${id}`, { titles: ['甲', '乙', '丙', '丁'] }, token)

    const bad = await call('POST', '/auth/profile', { shownTitles: ['没给过'] }, userToken)
    expect(bad.status).toBe(400)

    const tooMany = await call(
      'POST',
      '/auth/profile',
      { shownTitles: ['甲', '乙', '丙', '丁'] },
      userToken,
    )
    expect(tooMany.status).toBe(200)
    const me = await call('GET', '/auth/me', undefined, userToken)
    expect(me.body.data.user.shownTitles).toHaveLength(3)
  })

  it('称号清空后回到按编号推导', async () => {
    const token = await bootstrapAdmin()
    const key = await makeKey(token, 'visitor')
    const reg = await registerWithKey(key, '清称号的人')
    const id = reg.body.data.user.id
    const uid = reg.body.data.user.uid

    await call('POST', `/admin/users/${id}`, { titles: ['临时称号'] }, token)
    await call('POST', `/admin/users/${id}`, { titles: [] }, token)

    const page = await call('GET', `/users/${uid}`)
    expect(page.body.data.user.titles).toEqual([])
    expect(page.body.data.user.label).toContain('认证成员')
  })

})

describe('成员与账号绑定（v1.0.8）', () => {
  it('剧组成员密钥绑定成员，注册后能查到这个对应关系', async () => {
    const token = await bootstrapAdmin()
    const res = await call(
      'POST',
      '/admin/keys',
      {
        kind: 'crew',
        role: 2,
        season: 2,
        memberId: 'm-zhang',
        memberName: '张睿轩',
        count: 1,
        expiresInDays: 30,
      },
      token,
    )
    expect(res.status).toBe(200)
    expect(res.body.data.keys).toHaveLength(1)

    const reg = await registerWithKey(res.body.data.keys[0], '张睿轩')
    expect(reg.status).toBe(200)
    expect(reg.body.data.user.uid).toBe(12201)

    const links = await call('GET', '/members/links')
    expect(links.status).toBe(200)
    expect(links.body.data.links).toEqual([
      { memberId: 'm-zhang', uid: '12201', name: '张睿轩', avatar: null },
    ])
  })

  it('密钥列表里能看到绑定的成员名', async () => {
    const token = await bootstrapAdmin()
    await call(
      'POST',
      '/admin/keys',
      { kind: 'crew', role: 1, season: 1, memberId: 'm-1', memberName: '李同学', count: 1, expiresInDays: 10 },
      token,
    )
    const list = await call('GET', '/admin/keys', undefined, token)
    const labels = (list.body.data.keys as Array<{ specLabel: string }>).map((k) => k.specLabel)
    expect(labels.some((l) => l.includes('李同学'))).toBe(true)
  })
})

describe('防连点（v1.0.8）', () => {
  it('连续点赞会被拦下并提示', async () => {
    const token = await bootstrapAdmin()
    let last = 200
    for (let i = 0; i < 14; i += 1) {
      const res = await call(
        'POST',
        '/reactions/toggle',
        { targetType: 'episode', targetId: 'ep-1-1' },
        token,
      )
      last = res.status
      if (last === 429) {
        expect(res.body.error).toBe('请勿频繁点击')
        break
      }
    }
    expect(last).toBe(429)
  })
})

describe('编号迁移不会反复覆盖（v1.1.1）', () => {
  it('管理员把自己改成 00001 后，重启也不会被改成 300xx', async () => {
    const token = await bootstrapAdmin()
    const me = await call('GET', '/auth/me', undefined, token)

    // 先跑一次旧访客迁移，标记位写进去
    await normaliseLegacyUids(env.db)

    const res = await call('POST', `/admin/users/${me.body.data.user.id}/uid`, { uid: 1 }, token)
    expect(res.status).toBe(200)

    // 模拟服务重启，再跑一次迁移
    await normaliseLegacyUids(env.db)

    const after = await call('GET', '/auth/me', undefined, token)
    expect(after.body.data.user.uid).toBe(1)
  })

  it('真正没迁移过的老访客仍然会被改成 3 开头', async () => {
    await call('GET', '/health')
    await env.db
      .prepare(
        `INSERT INTO users (id, uid, name, password_hash, salt, role, verified, created_at)
         VALUES ('u-guest', 5, '老访客', 'x', 'y', 'visitor', 0, ?)`,
      )
      .bind(new Date().toISOString())
      .run()

    // 模拟还没做过迁移的老库：清掉标记位
    await env.db.prepare("DELETE FROM settings WHERE key = 'migrate:guest-uid-v3'").run()
    await normaliseLegacyUids(env.db)

    const row = await env.db
      .prepare("SELECT uid FROM users WHERE id = 'u-guest'")
      .first<{ uid: number }>()
    expect(row?.uid).toBeGreaterThanOrEqual(30000)
  })
})

describe('批量删除评论（v1.2.0）', () => {
  it('delete 状态会把评论真正删掉', async () => {
    const token = await bootstrapAdmin()
    await call('POST', '/admin/settings', { moderation: 'off' }, token)
    const key = await makeKey(token, 'visitor')
    const reg = await registerWithKey(key, '评论的人')
    const userToken = reg.body.data.token

    await call(
      'POST',
      '/comments',
      { targetType: 'episode', targetId: 'ep-1-1', body: '要被删掉' },
      userToken,
    )
    const listBefore = await call('GET', '/comments?targetType=episode&targetId=ep-1-1')
    const id = listBefore.body.data.comments[0].id

    expect((await call('POST', `/admin/comments/${id}`, { status: 'delete' }, token)).status).toBe(200)
    const list = await call('GET', '/comments?targetType=episode&targetId=ep-1-1')
    expect(list.body.data.comments).toHaveLength(0)
  })
})

describe('手动绑定成员页（v1.2.1）', () => {
  it('管理员可以把已有账号绑到成员上', async () => {
    const token = await bootstrapAdmin()
    const key = await makeKey(token, 'visitor')
    const reg = await registerWithKey(key, '张睿轩')
    const id = reg.body.data.user.id

    const res = await call('POST', `/admin/users/${id}`, { memberId: 'm-zhang' }, token)
    expect(res.status).toBe(200)

    const links = await call('GET', '/members/links')
    expect(links.body.data.links).toEqual([
      { memberId: 'm-zhang', uid: reg.body.data.user.uid ? String(reg.body.data.user.uid).padStart(5, '0') : '', name: '张睿轩', avatar: null },
    ])
  })

  it('一个成员只能绑一个账号，绑新的会解绑旧的', async () => {
    const token = await bootstrapAdmin()
    const k1 = await makeKey(token, 'visitor')
    const k2 = await makeKey(token, 'visitor')
    const a = await registerWithKey(k1, '甲同学')
    const b = await registerWithKey(k2, '乙同学')

    await call('POST', `/admin/users/${a.body.data.user.id}`, { memberId: 'm-1' }, token)
    await call('POST', `/admin/users/${b.body.data.user.id}`, { memberId: 'm-1' }, token)

    const links = await call('GET', '/members/links')
    expect(links.body.data.links).toHaveLength(1)
    expect(links.body.data.links[0].name).toBe('乙同学')
  })
})

describe('楼中楼与评论点赞（v1.3.0）', () => {
  it('回复挂在顶层评论下，被回复的人收到通知', async () => {
    const token = await bootstrapAdmin()
    await call('POST', '/admin/settings', { moderation: 'off' }, token)
    const k1 = await makeKey(token, 'visitor')
    const k2 = await makeKey(token, 'visitor')
    const a = await registerWithKey(k1, '楼主同学')
    const b = await registerWithKey(k2, '回复同学')

    await call(
      'POST',
      '/comments',
      { targetType: 'episode', targetId: 'ep-1-1', body: '我是楼主' },
      a.body.data.token,
    )
    const list = await call('GET', '/comments?targetType=episode&targetId=ep-1-1')
    const rootId = list.body.data.comments[0].id

    const reply = await call(
      'POST',
      '/comments',
      { targetType: 'episode', targetId: 'ep-1-1', body: '我回复你', parentId: rootId },
      b.body.data.token,
    )
    expect(reply.status).toBe(200)

    const after = await call('GET', '/comments?targetType=episode&targetId=ep-1-1')
    expect(after.body.data.comments).toHaveLength(1)
    expect(after.body.data.comments[0].replies).toHaveLength(1)
    expect(after.body.data.comments[0].replies[0].body).toBe('我回复你')
    expect(after.body.data.comments[0].replies[0].replyToName).toBe('楼主同学')

    const inbox = await call('GET', '/notifications', undefined, a.body.data.token)
    expect(inbox.body.data.unread).toBe(1)
    expect(inbox.body.data.notifications[0].actorName).toBe('回复同学')
  })

  it('回复自己的评论不会给自己发通知', async () => {
    const token = await bootstrapAdmin()
    await call('POST', '/admin/settings', { moderation: 'off' }, token)
    const key = await makeKey(token, 'visitor')
    const me = await registerWithKey(key, '自言自语')

    await call(
      'POST',
      '/comments',
      { targetType: 'episode', targetId: 'ep-1-1', body: '自己说一句' },
      me.body.data.token,
    )
    const list = await call('GET', '/comments?targetType=episode&targetId=ep-1-1')
    await call(
      'POST',
      '/comments',
      { targetType: 'episode', targetId: 'ep-1-1', body: '再回自己', parentId: list.body.data.comments[0].id },
      me.body.data.token,
    )

    const inbox = await call('GET', '/notifications', undefined, me.body.data.token)
    expect(inbox.body.data.unread).toBe(0)
  })

  it('评论可以点赞、取消点赞', async () => {
    const token = await bootstrapAdmin()
    await call('POST', '/admin/settings', { moderation: 'off' }, token)
    const k1 = await makeKey(token, 'visitor')
    const k2 = await makeKey(token, 'visitor')
    const a = await registerWithKey(k1, '被赞的人')
    const b = await registerWithKey(k2, '点赞的人')

    await call(
      'POST',
      '/comments',
      { targetType: 'episode', targetId: 'ep-1-1', body: '给我点赞' },
      a.body.data.token,
    )
    const list = await call('GET', '/comments?targetType=episode&targetId=ep-1-1')
    const id = list.body.data.comments[0].id

    const like1 = await call('POST', `/comments/${id}/like`, {}, b.body.data.token)
    expect(like1.body.data).toEqual({ liked: true, likes: 1 })

    const list2 = await call('GET', '/comments?targetType=episode&targetId=ep-1-1', undefined, b.body.data.token)
    expect(list2.body.data.comments[0].liked).toBe(true)
    expect(list2.body.data.comments[0].likes).toBe(1)

    const like2 = await call('POST', `/comments/${id}/like`, {}, b.body.data.token)
    expect(like2.body.data).toEqual({ liked: false, likes: 0 })
  })

  it('只有管理员能置顶评论，置顶排在最前', async () => {
    const token = await bootstrapAdmin()
    await call('POST', '/admin/settings', { moderation: 'off' }, token)
    const k1 = await makeKey(token, 'visitor')
    const k2 = await makeKey(token, 'visitor')
    const a = await registerWithKey(k1, '早来的')
    const b = await registerWithKey(k2, '晚来的')

    await call('POST', '/comments', { targetType: 'episode', targetId: 'ep-1-1', body: '第一条' }, a.body.data.token)
    await call('POST', '/comments', { targetType: 'episode', targetId: 'ep-1-1', body: '第二条' }, b.body.data.token)

    const list = await call('GET', '/comments?targetType=episode&targetId=ep-1-1')
    const firstId = list.body.data.comments.find((c: { body: string }) => c.body === '第一条').id

    // 普通用户不能置顶
    expect((await call('POST', `/comments/${firstId}/pin`, { pinned: true }, a.body.data.token)).status).toBe(403)

    // 管理员可以
    expect((await call('POST', `/comments/${firstId}/pin`, { pinned: true }, token)).status).toBe(200)
    const after = await call('GET', '/comments?targetType=episode&targetId=ep-1-1')
    expect(after.body.data.comments[0].body).toBe('第一条')
    expect(after.body.data.comments[0].pinned).toBe(true)
  })
})

describe('多设备授权登录（v1.4.0）', () => {
  it('第二台设备登录时先返回 need_authorize', async () => {
    const token = await bootstrapAdmin()
    await makeKey(token)

    const first = await call('POST', '/auth/login', { name: '导演', password: 'abc123', device: '手机A', replace: true })
    expect(first.status).toBe(200)

    const second = await call('POST', '/auth/login', { name: '导演', password: 'abc123', device: '手机B' })
    expect(second.status).toBe(409)
    expect(second.body.code).toBe('need_authorize')
    expect(second.body.requestId).toBeTruthy()
  })

  it('主设备批准后，第二台设备拿到令牌', async () => {
    const token = await bootstrapAdmin()
    await makeKey(token)
    const a = await call('POST', '/auth/login', { name: '导演', password: 'abc123', device: '手机A', replace: true })
    const b = await call('POST', '/auth/login', { name: '导演', password: 'abc123', device: '手机B' })

    // 主设备看到申请
    const inbox = await call('GET', '/auth/requests', undefined, a.body.data.token)
    expect(inbox.body.data.requests).toHaveLength(1)
    expect(inbox.body.data.requests[0].device).toBe('手机B')

    // 批准
    expect(
      (await call('POST', `/auth/requests/${b.body.requestId}`, { action: 'approve' }, a.body.data.token)).status,
    ).toBe(200)

    // 第二台设备轮询到令牌
    const status = await call('GET', `/auth/request-status?id=${b.body.requestId}`)
    expect(status.body.data.status).toBe('approved')
    expect(status.body.data.token).toBeTruthy()

    // 两台设备都能用
    expect((await call('GET', '/auth/me', undefined, a.body.data.token)).status).toBe(200)
    expect((await call('GET', '/auth/me', undefined, status.body.data.token)).status).toBe(200)
  })

  it('拒绝后第二台拿不到令牌', async () => {
    const token = await bootstrapAdmin()
    await makeKey(token)
    const a = await call('POST', '/auth/login', { name: '导演', password: 'abc123', device: '手机A', replace: true })
    const b = await call('POST', '/auth/login', { name: '导演', password: 'abc123', device: '手机B' })

    await call('POST', `/auth/requests/${b.body.requestId}`, { action: 'deny' }, a.body.data.token)
    const status = await call('GET', `/auth/request-status?id=${b.body.requestId}`)
    expect(status.body.data.status).toBe('denied')
    expect(status.body.data.token).toBeNull()
  })

  it('直接顶掉时不需要授权', async () => {
    const token = await bootstrapAdmin()
    await makeKey(token)
    await call('POST', '/auth/login', { name: '导演', password: 'abc123', device: '手机A' })
    const b = await call('POST', '/auth/login', {
      name: '导演',
      password: 'abc123',
      device: '手机B',
      replace: true,
    })
    expect(b.status).toBe(200)
    expect(b.body.data.token).toBeTruthy()
  })

  it('能看到当前登录的设备', async () => {
    const token = await bootstrapAdmin()
    await makeKey(token)
    const a = await call('POST', '/auth/login', { name: '导演', password: 'abc123', device: '手机A', replace: true })
    const list = await call('GET', '/auth/sessions', undefined, a.body.data.token)
    expect(list.body.data.sessions.some((s: { name: string }) => s.name === '手机A')).toBe(true)
  })
})

describe('设备记忆与下线（v1.5.0）', () => {
  it('批准过的设备再次登录不需要授权', async () => {
    const token = await bootstrapAdmin()
    await makeKey(token)
    const a = await call('POST', '/auth/login', {
      name: '导演', password: 'abc123', device: '手机A', deviceId: 'dev-a', replace: true,
    })
    const b = await call('POST', '/auth/login', {
      name: '导演', password: 'abc123', device: '手机B', deviceId: 'dev-b',
    })
    await call('POST', `/auth/requests/${b.body.requestId}`, { action: 'approve' }, a.body.data.token)

    // 同一台设备再来一次，直接放行
    const again = await call('POST', '/auth/login', {
      name: '导演', password: 'abc123', device: '手机B', deviceId: 'dev-b',
    })
    expect(again.status).toBe(200)
    expect(again.body.data.token).toBeTruthy()
  })

  it('主设备可以让其他设备下线', async () => {
    const token = await bootstrapAdmin()
    await makeKey(token)
    const a = await call('POST', '/auth/login', {
      name: '导演', password: 'abc123', device: '手机A', deviceId: 'dev-a', replace: true,
    })
    const b = await call('POST', '/auth/login', {
      name: '导演', password: 'abc123', device: '手机B', deviceId: 'dev-b',
    })
    await call('POST', `/auth/requests/${b.body.requestId}`, { action: 'approve' }, a.body.data.token)
    const bToken = (await call('GET', `/auth/request-status?id=${b.body.requestId}`)).body.data.token

    const list = await call('GET', '/auth/sessions', undefined, a.body.data.token)
    const other = list.body.data.sessions.find((s: { current: boolean }) => !s.current)
    expect(other).toBeTruthy()

    expect(
      (await call('DELETE', `/auth/devices/${encodeURIComponent(other.key)}`, undefined, a.body.data.token))
        .status,
    ).toBe(200)

    // 被下线的设备令牌失效
    expect((await call('GET', '/auth/me', undefined, bToken)).status).toBe(401)
  })

  it('不能删除当前设备', async () => {
    const token = await bootstrapAdmin()
    await makeKey(token)
    const a = await call('POST', '/auth/login', {
      name: '导演', password: 'abc123', device: '手机A', deviceId: 'dev-a', replace: true,
    })
    const list = await call('GET', '/auth/sessions', undefined, a.body.data.token)
    const cur = list.body.data.sessions.find((s: { current: boolean }) => s.current)
    expect(
      (await call('DELETE', `/auth/devices/${encodeURIComponent(cur.key)}`, undefined, a.body.data.token))
        .status,
    ).toBe(400)
  })
})

describe('论坛与关注（v1.6.0）', () => {
  async function makeUser(adminToken: string, name: string) {
    const key = await makeKey(adminToken, 'visitor')
    const reg = await registerWithKey(key, name)
    return { token: reg.body.data.token as string, id: reg.body.data.user.id as string, uid: reg.body.data.user.uid as number }
  }

  it('可以发帖、看列表、看详情（浏览量只给作者）', async () => {
    const adminToken = await bootstrapAdmin()
    const a = await makeUser(adminToken, '发帖人')

    const created = await call('POST', '/posts', { body: '第一次发帖' }, a.token)
    expect(created.status).toBe(200)

    const list = await call('GET', '/posts')
    expect(list.body.data.posts).toHaveLength(1)
    expect(list.body.data.posts[0].body).toBe('第一次发帖')

    const one = await call('GET', `/posts/${created.body.data.id}`)
    expect(one.status).toBe(200)
    expect(one.body.data.post.views).toBe(0)
  })

  it('没认证的人不能发帖', async () => {
    await bootstrapAdmin()
    const guest = await call('POST', '/auth/register', { name: '路人', password: 'abc123' })
    const res = await call('POST', '/posts', { body: '我能发吗' }, guest.body.data.token)
    expect(res.status).toBe(403)
  })

  it('帖子可以点赞、可以带图片', async () => {
    const adminToken = await bootstrapAdmin()
    const a = await makeUser(adminToken, '有图的人')
    const img = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=='

    const created = await call('POST', '/posts', { body: '带图', images: [img] }, a.token)
    const list = await call('GET', '/posts')
    expect(list.body.data.posts[0].images).toHaveLength(1)

    const like = await call('POST', `/posts/${created.body.data.id}/like`, {}, a.token)
    expect(like.body.data).toEqual({ liked: true, likes: 1 })

    const mediaRes = await handleApi(
      new Request(`http://localhost/api/media/${list.body.data.posts[0].images[0]}`),
      env,
    )
    expect(mediaRes.status).toBe(200)
    expect(mediaRes.headers.get('content-type')).toContain('image/')
  })

  it('关注、取消关注，粉丝数会变，对方收到通知', async () => {
    const adminToken = await bootstrapAdmin()
    const a = await makeUser(adminToken, '被关注者')
    const b = await makeUser(adminToken, '粉丝')

    const res = await call('POST', `/follows/${a.id}`, { action: 'follow' }, b.token)
    expect(res.body.data.following).toBe(true)

    const page = await call('GET', `/users/${a.uid}`)
    expect(page.body.data.user.followers).toBe(1)

    const inbox = await call('GET', '/notifications', undefined, a.token)
    expect(inbox.body.data.notifications[0].type).toBe('follow')

    await call('POST', `/follows/${a.id}`, { action: 'unfollow' }, b.token)
    const after = await call('GET', `/users/${a.uid}`)
    expect(after.body.data.user.followers).toBe(0)
  })

  it('帖子下面可以评论', async () => {
    const adminToken = await bootstrapAdmin()
    const a = await makeUser(adminToken, '楼主')
    await call('POST', '/admin/settings', { moderation: 'off' }, adminToken)
    const created = await call('POST', '/posts', { body: '来聊聊' }, a.token)

    const comment = await call(
      'POST',
      '/comments',
      { targetType: 'post', targetId: created.body.data.id, body: '沙发' },
      a.token,
    )
    expect(comment.status).toBe(200)

    const list = await call('GET', `/comments?targetType=post&targetId=${created.body.data.id}`)
    expect(list.body.data.comments).toHaveLength(1)
  })
})

describe('更新日志自动补齐（v1.6.0）', () => {
  it('线上内容缺少新版本时，会自动补进去', async () => {
    const token = await bootstrapAdmin()
    // 先发布一份只有旧日志的内容
    const base = validContent()
    const old = {
      ...base,
      changelog: [{ version: '1.0.0', date: '2026-11-20', items: ['第一版上线'] }],
    }
    await call('POST', '/admin/publish', { content: old }, token)

    // 清掉标记，模拟升级后的第一次启动
    await env.db.prepare("DELETE FROM settings WHERE key = 'migrate:changelog-v23'").run()
    await ensureChangelogSeed(env.db)

    const res = await call('GET', '/content')
    const changelog = (res.body as { changelog: Array<{ version: string }> }).changelog
    const versions = changelog.map((c) => c.version)
    expect(versions).toContain('1.0.15')
    expect(versions).toContain('1.0.9')
    expect(versions).toContain('1.0.0')
  })

  it('已有同版本时不重复添加', async () => {
    const token = await bootstrapAdmin()
    const base = validContent()
    const mine = {
      ...base,
      changelog: [{ version: '1.0.15', date: '2026-11-22', items: ['我自己写的'] }],
    }
    await call('POST', '/admin/publish', { content: mine }, token)
    await env.db.prepare("DELETE FROM settings WHERE key = 'migrate:changelog-v23'").run()
    await ensureChangelogSeed(env.db)

    const res = await call('GET', '/content')
    const changelog = (res.body as { changelog: Array<{ version: string; items: string[] }> })
      .changelog
    const entry = changelog.filter((c) => c.version === '1.0.15')
    expect(entry).toHaveLength(1)
    expect(entry[0].items[0]).toBe('我自己写的')
  })
})

describe('实时调整管理员权限（v1.7.0）', () => {
  it('总管理员可以改别人的权限，立刻生效', async () => {
    const superToken = await bootstrapAdmin()
    const keyRes = await call(
      'POST',
      '/admin/keys',
      { kind: 'admin', perms: ['comments'], count: 1, expiresInDays: 30 },
      superToken,
    )
    const sub = await registerWithKey(keyRes.body.data.keys[0], '分管理员')
    const subToken = sub.body.data.token
    const subId = sub.body.data.user.id

    // 现在只能看评论
    expect((await call('GET', '/admin/comments', undefined, subToken)).status).toBe(200)
    expect((await call('GET', '/admin/users', undefined, subToken)).status).toBe(403)

    // 总管理员加上「账号管理」
    const res = await call('POST', `/admin/users/${subId}`, { perms: ['comments', 'users'] }, superToken)
    expect(res.status).toBe(200)

    // 立刻可以访问用户管理
    expect((await call('GET', '/admin/users', undefined, subToken)).status).toBe(200)
    // 但内容相关的还是不行
    expect(
      (await call('POST', '/admin/publish', { content: validContent() }, subToken)).status,
    ).toBe(403)
  })

  it('取消权限后立刻失效', async () => {
    const superToken = await bootstrapAdmin()
    const keyRes = await call(
      'POST',
      '/admin/keys',
      { kind: 'admin', perms: ['users'], count: 1, expiresInDays: 30 },
      superToken,
    )
    const sub = await registerWithKey(keyRes.body.data.keys[0], '要收权的')
    const subToken = sub.body.data.token
    expect((await call('GET', '/admin/users', undefined, subToken)).status).toBe(200)

    await call('POST', `/admin/users/${sub.body.data.user.id}`, { perms: [] }, superToken)
    expect((await call('GET', '/admin/users', undefined, subToken)).status).toBe(403)
  })

  it('分管理员不能改别人的权限', async () => {
    const superToken = await bootstrapAdmin()
    const k1 = await call('POST', '/admin/keys', { kind: 'admin', perms: ['users'], count: 1, expiresInDays: 30 }, superToken)
    const k2 = await call('POST', '/admin/keys', { kind: 'admin', perms: ['comments'], count: 1, expiresInDays: 30 }, superToken)
    const a = await registerWithKey(k1.body.data.keys[0], '管理甲')
    const b = await registerWithKey(k2.body.data.keys[0], '管理乙')

    const res = await call('POST', `/admin/users/${b.body.data.user.id}`, { perms: ['content'] }, a.body.data.token)
    expect(res.status).toBe(403)
  })
})

describe('版本历史与回滚（v2.0）', () => {
  it('能看到历史版本并回滚', async () => {
    const token = await bootstrapAdmin()
    const first = validContent()
    await call('POST', '/admin/publish', { content: first }, token)

    const changed = validContent()
    changed.site.name = '改过的名字'
    await call('POST', '/admin/publish', { content: changed }, token)

    const list = await call('GET', '/admin/versions', undefined, token)
    expect(list.status).toBe(200)
    expect(list.body.data.versions.length).toBeGreaterThanOrEqual(2)

    const oldest = list.body.data.versions[list.body.data.versions.length - 1]
    const res = await call('POST', '/admin/rollback', { version: oldest.version }, token)
    expect(res.status).toBe(200)

    const now = await call('GET', '/content')
    expect((now.body as { site: { name: string } }).site.name).toBe('yacc')
  })

  it('没有发布权限的管理员看不到版本历史', async () => {
    const superToken = await bootstrapAdmin()
    const key = await call(
      'POST',
      '/admin/keys',
      { kind: 'admin', perms: ['comments:review'], count: 1, expiresInDays: 30 },
      superToken,
    )
    const sub = await registerWithKey(key.body.data.keys[0], '只管评论')
    expect((await call('GET', '/admin/versions', undefined, sub.body.data.token)).status).toBe(403)
  })
})

describe('协作冲突与动态（v2.0）', () => {
  it('基于旧版本发布会返回 409', async () => {
    const token = await bootstrapAdmin()
    const a = validContent()
    a.updatedAt = '2026-11-23T01:00:00+08:00'
    await call('POST', '/admin/publish', { content: a }, token)

    // 别人又发了一版
    const b = validContent()
    b.updatedAt = '2026-11-23T02:00:00+08:00'
    await call('POST', '/admin/publish', { content: b }, token)

    // 我拿着旧版本去发
    const res = await call(
      'POST',
      '/admin/publish',
      { content: a, baseUpdatedAt: '2026-11-23T01:00:00+08:00' },
      token,
    )
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('conflict')
  })

  it('版本一致时可以正常发布', async () => {
    const token = await bootstrapAdmin()
    const a = validContent()
    a.updatedAt = '2026-11-23T03:00:00+08:00'
    await call('POST', '/admin/publish', { content: a }, token)

    const res = await call(
      'POST',
      '/admin/publish',
      { content: a, baseUpdatedAt: '2026-11-23T03:00:00+08:00' },
      token,
    )
    expect(res.status).toBe(200)
  })

  it('发布后会留下动态记录', async () => {
    const token = await bootstrapAdmin()
    await call('POST', '/admin/publish', { content: validContent() }, token)
    const res = await call('GET', '/admin/activity', undefined, token)
    expect(res.status).toBe(200)
    expect(res.body.data.activity[0].userName).toBe('导演')
  })
})

describe('称号框（v2.1）', () => {
  it('管理员可以给账号指定称号框，公开主页能看到', async () => {
    const token = await bootstrapAdmin()
    const key = await makeKey(token, 'visitor')
    const reg = await registerWithKey(key, '要称号框的人')
    const id = reg.body.data.user.id
    const uid = reg.body.data.user.uid

    const res = await call('POST', `/admin/users/${id}`, { badgeStyle: 'svip' }, token)
    expect(res.status).toBe(200)

    const page = await call('GET', `/users/${uid}`)
    expect(page.body.data.user.badgeStyle).toBe('svip')
  })

  it('不认识的称号框会被拒绝', async () => {
    const token = await bootstrapAdmin()
    const key = await makeKey(token, 'visitor')
    const reg = await registerWithKey(key, '乱来的人')
    const res = await call(
      'POST',
      `/admin/users/${reg.body.data.user.id}`,
      { badgeStyle: 'whatever' },
      token,
    )
    expect(res.status).toBe(400)
  })

  it('auto 会清空自定义称号框', async () => {
    const token = await bootstrapAdmin()
    const key = await makeKey(token, 'visitor')
    const reg = await registerWithKey(key, '恢复默认')
    const id = reg.body.data.user.id
    await call('POST', `/admin/users/${id}`, { badgeStyle: 'vip' }, token)
    await call('POST', `/admin/users/${id}`, { badgeStyle: 'auto' }, token)

    const page = await call('GET', `/users/${reg.body.data.user.uid}`)
    expect(page.body.data.user.badgeStyle).toBeNull()
  })
})

describe('签名与访客（v1.1）', () => {
  it('可以保存个性签名并在主页看到', async () => {
    const key = await makeKey(await bootstrapAdmin(), 'visitor')
    const reg = await registerWithKey(key, '写签名的人')
    const token = reg.body.data.token
    const res = await call('POST', '/auth/profile', { signature: '今天也要好好拍' }, token)
    expect(res.status).toBe(200)

    const page = await call('GET', `/users/${reg.body.data.user.uid}`)
    expect(page.body.data.user.signature).toBe('今天也要好好拍')
  })

  it('别人访问主页会留下访客记录，只有本人能看到', async () => {
    const admin = await bootstrapAdmin()
    const host = await registerWithKey(await makeKey(admin, 'visitor'), '被看的人')
    const guest = await registerWithKey(await makeKey(admin, 'visitor'), '来串门的人')

    await call('GET', `/users/${host.body.data.user.uid}`, undefined, guest.body.data.token)

    const mine = await call('GET', `/users/${host.body.data.user.uid}`, undefined, host.body.data.token)
    expect(mine.body.data.user.visitors.length).toBe(1)
    expect(mine.body.data.user.visitors[0].name).toBe('来串门的人')

    const other = await call('GET', `/users/${host.body.data.user.uid}`, undefined, guest.body.data.token)
    expect(other.body.data.user.visitors.length).toBe(0)
  })
})

describe('等级与积分（v1.1）', () => {
  it('登录后获得积分，主页显示等级', async () => {
    const key = await makeKey(await bootstrapAdmin(), 'visitor')
    const reg = await registerWithKey(key, '新来的')
    const page = await call('GET', `/users/${reg.body.data.user.uid}`)
    expect(page.body.data.user.level).toBeGreaterThanOrEqual(1)
    expect(page.body.data.user.points).toBeGreaterThan(0)
  })

  it('发帖与评论会加分，人气随访客增长', async () => {
    const admin = await bootstrapAdmin()
    const a = await registerWithKey(await makeKey(admin, 'visitor'), '发帖的人')
    const b = await registerWithKey(await makeKey(admin, 'visitor'), '围观的人')

    await call('POST', '/posts', { body: '第一条帖子' }, a.body.data.token)
    await call('POST', '/comments', { targetType: 'post', targetId: 'x', body: '评论一下' }, a.body.data.token)

    const before = await call('GET', `/users/${a.body.data.user.uid}`)
    const beforePoints = before.body.data.user.points

    await call('GET', `/users/${a.body.data.user.uid}`, undefined, b.body.data.token)
    const after = await call('GET', `/users/${a.body.data.user.uid}`)
    expect(after.body.data.user.points).toBe(beforePoints)
    expect(after.body.data.user.popularity).toBeGreaterThan(0)
  })
})

describe('消息分类（v1.1）', () => {
  it('点赞、关注、称号都会进消息，并带分类', async () => {
    const admin = await bootstrapAdmin()
    const author = await registerWithKey(await makeKey(admin, 'visitor'), '作者')
    const fan = await registerWithKey(await makeKey(admin, 'visitor'), '粉丝')

    const post = await call('POST', '/posts', { body: '来看看这个' }, author.body.data.token)
    await call('POST', '/reactions/toggle', { targetType: 'post', targetId: post.body.data.id }, fan.body.data.token)
    await call('POST', `/follows/${author.body.data.user.id}`, undefined, fan.body.data.token)
    await call(
      'POST',
      `/admin/users/${author.body.data.user.id}`,
      { titles: ['优秀'] },
      admin,
    )

    const inbox = await call('GET', '/notifications', undefined, author.body.data.token)
    const types = inbox.body.data.notifications.map((n: { type: string }) => n.type)
    expect(types).toContain('like')
    expect(types).toContain('follow')
    expect(types).toContain('title')

    const titleNote = inbox.body.data.notifications.find(
      (n: { type: string }) => n.type === 'title',
    )
    expect(titleNote.category).toBe('system')

    const likeNote = inbox.body.data.notifications.find(
      (n: { type: string }) => n.type === 'like',
    )
    expect(likeNote.category).toBe('social')
    expect(likeNote.body).toContain('赞了你的帖子')
  })
})

describe('总管理员自举（v1.1）', () => {
  it('库里没有 yacc-admin 时会自动建出来并能登录', async () => {
    env.disableBootstrapSuper = '0'
    // 全新库：ensureSchema 会调用 ensureSuperadmin
    const health = await call('GET', '/health')
    expect(health.status).toBe(200)

    const res = await call('POST', '/auth/login', { name: 'yacc-admin', password: 'yacc2026-yu' })
    expect(res.status).toBe(200)
    expect(res.body.data.user.role).toBe('superadmin')
  })
})

describe('外观保存（v1.1）', () => {
  it('可以保存头像框与主页外观', async () => {
    const key = await makeKey(await bootstrapAdmin(), 'visitor')
    const reg = await registerWithKey(key, '换外观的人')
    const token = reg.body.data.token

    const frame = await call('POST', '/auth/profile', { avatarFrame: 'ring-gold' }, token)
    expect(frame.status).toBe(200)
    expect(frame.body.data.user.avatarFrame).toBe('ring-gold')

    const style = await call('POST', '/auth/profile', { profileStyle: 'normal' }, token)
    expect(style.status).toBe(200)
  })

  it('没有获得的外观不能选', async () => {
    const key = await makeKey(await bootstrapAdmin(), 'visitor')
    const reg = await registerWithKey(key, '没外观的人')
    const token = reg.body.data.token

    const vip = await call('POST', '/auth/profile', { profileStyle: 'vip' }, token)
    expect(vip.status).toBe(403)
  })
})

describe('商品上下架与删除（v1.1）', () => {
  it('带短横线的商品 id 也能下架和删除', async () => {
    const token = await bootstrapAdmin()
    const created = await call(
      'POST',
      '/admin/products',
      {
        title: '测试商品',
        price: 10,
        currency: 'points',
        kind: 'nameplate',
        value: 'vip',
        durationDays: 7,
        active: true,
      },
      token,
    )
    expect(created.status).toBe(200)
    const id = created.body.data.id

    const off = await call('POST', `/admin/products/${id}`, { active: false }, token)
    expect(off.status).toBe(200)

    const removed = await call('DELETE', `/admin/products/${id}`, undefined, token)
    expect(removed.status).toBe(200)
  })

  it('种子商品（含短横线 id）可以下架', async () => {
    const token = await bootstrapAdmin()
    const res = await call('POST', '/admin/products/p-frame-7', { active: false }, token)
    expect(res.status).toBe(200)
  })
})

describe('总管理员不计入访客（v1.1）', () => {
  it('yacc-admin 访问主页不会留下访客记录', async () => {
    env.disableBootstrapSuper = '0'
    await call('GET', '/health')
    const admin = await call('POST', '/auth/login', { name: 'yacc-admin', password: 'yacc2026-yu' })
    expect(admin.status).toBe(200)

    const key = await makeKey(admin.body.data.token, 'visitor')
    const reg = await registerWithKey(key, '被看的人')
    const token = reg.body.data.token
    const uid = reg.body.data.user.uid

    await call('GET', `/users/${uid}`, undefined, admin.body.data.token)
    const page = await call('GET', `/users/${uid}`, undefined, token)
    expect(page.body.data.user.visitors.length).toBe(0)
  })
})

describe('发放时限（v1.1）', () => {
  it('头像框可以带天数发放', async () => {
    const token = await bootstrapAdmin()
    const key = await makeKey(token, 'visitor')
    const reg = await registerWithKey(key, '拿头像框的人')
    const id = reg.body.data.user.id
    const uid = reg.body.data.user.uid

    const res = await call(
      'POST',
      `/admin/users/${id}`,
      { avatarFrame: 'ring-gold', avatarFrameDays: 30 },
      token,
    )
    expect(res.status).toBe(200)

    const page = await call('GET', `/users/${uid}`)
    expect(page.body.data.user.avatarFrame).toBe('ring-gold')
  })

  it('称号可以带天数，过期后不再返回', async () => {
    const token = await bootstrapAdmin()
    const key = await makeKey(token, 'visitor')
    const reg = await registerWithKey(key, '拿称号的人')
    const id = reg.body.data.user.id

    const res = await call(
      'POST',
      `/admin/users/${id}`,
      { titles: ['限时称号'], titleDays: 30 },
      token,
    )
    expect(res.status).toBe(200)
  })
})

describe('铭牌发放（v1.1）', () => {
  it('管理员可以发放铭牌并带时限', async () => {
    const token = await bootstrapAdmin()
    const key = await makeKey(token, 'visitor')
    const reg = await registerWithKey(key, '拿铭牌的人')
    const id = reg.body.data.user.id
    const uid = reg.body.data.user.uid

    const res = await call(
      'POST',
      `/admin/users/${id}`,
      { plates: ['vip', 'gold'], plateDays: 30 },
      token,
    )
    expect(res.status).toBe(200)

    const page = await call('GET', `/users/${uid}`)
    expect(page.body.data.user.plates).toContain('vip')
  })
})

describe('关注/粉丝列表（v1.1）', () => {
  it('可以取到关注与粉丝列表，隐私关闭后为空', async () => {
    const admin = await bootstrapAdmin()
    const a = await registerWithKey(await makeKey(admin, 'visitor'), '甲同学')
    const b = await registerWithKey(await makeKey(admin, 'visitor'), '乙同学')
    await call('POST', `/follows/${b.body.data.user.id}`, undefined, a.body.data.token)

    const following = await call('GET', `/users/${a.body.data.user.uid}/following`)
    expect(following.status).toBe(200)
    expect(following.body.data.list.length).toBe(1)

    const followers = await call('GET', `/users/${b.body.data.user.uid}/followers`)
    expect(followers.body.data.list.length).toBe(1)

    await call(
      'POST',
      '/auth/profile',
      { privacy: { showFollowers: false } },
      b.body.data.token,
    )
    const hidden = await call('GET', `/users/${b.body.data.user.uid}/followers`)
    expect(hidden.body.data.hidden).toBe(true)
  })
})
