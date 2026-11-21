// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { createRequire } from 'node:module'
import { createNodeDb, type DB } from '../../server/db'
import { handleApi, type Env } from '../../server/app'
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
    expect(res.body.data.user.role).toBe('admin')
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

  it('船员密钥注册出来是 member 且已认证', async () => {
    const token = await bootstrapAdmin()
    const key = await makeKey(token, 'member')
    const res = await registerWithKey(key, '同学甲')
    expect(res.status).toBe(200)
    expect(res.body.data.user.role).toBe('member')
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
    expect(res.body.data.user.role).toBe('admin')
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
