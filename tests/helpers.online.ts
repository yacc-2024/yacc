import { createRequire } from 'node:module'
import { vi } from 'vitest'
import { createNodeDb } from '../server/db'
import { handleApi, type Env } from '../server/app'
import seed from '../public/content.json'
import { setToken } from '../src/lib/api'

const nodeRequire = createRequire(import.meta.url)
const { DatabaseSync } = nodeRequire('node:sqlite') as {
  DatabaseSync: new (path: string) => never
}

export const ADMIN_CODE = 'TEST-ADMIN-CODE'

/**
 * 把 fetch 接到真正的后端 handler 上：
 * 前端跑在 jsdom 里，后端是同一份 handleApi + 内存 SQLite。
 * 这样测的是真实链路，不是假数据。
 */
export function mountApi(): Env {
  const env: Env = { db: createNodeDb(':memory:', DatabaseSync as never), adminCode: ADMIN_CODE }

  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()

    if (url.startsWith('/api')) {
      return handleApi(new Request(`http://localhost${url}`, init), env)
    }

    if (url.includes('content.json')) {
      return new Response(JSON.stringify(seed), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    return new Response('{}', { status: 200 })
  })

  return env
}

export interface Tokened {
  token: string
  user: { id: string; name: string; role: string; verified: boolean }
}

/** 直接调后端建一个管理员，并把 token 写进客户端 */
export async function makeAdmin(name = '导演'): Promise<Tokened> {
  const res = await fetch('/api/auth/activate-admin', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: ADMIN_CODE, name, password: 'abc123' }),
  })
  const body = await res.json()
  setToken(body.data.token)
  return { token: body.data.token, user: body.data.user }
}

export async function makeKey(token: string, kind: 'member' | 'visitor' = 'visitor'): Promise<string> {
  const res = await fetch('/api/admin/keys', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ kind, count: 1, expiresInDays: 30 }),
  })
  const body = await res.json()
  return body.data.keys[0]
}

export async function registerUser(key: string, name: string): Promise<Tokened> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, password: 'abc123', key }),
  })
  const body = await res.json()
  setToken(body.data.token)
  return { token: body.data.token, user: body.data.user }
}

export async function setModeration(token: string, value: 'on' | 'off'): Promise<void> {
  await fetch('/api/admin/settings', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ moderation: value }),
  })
}
