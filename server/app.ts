import type { DB } from './db'
import { SCHEMA_SQL } from './schema'
import {
  generateKey,
  hashPassword,
  randomHex,
  sha256Hex,
  verifyPassword,
} from './crypto'
import { validateContent } from '../src/data/validate'

export interface Env {
  db: DB
  /** 首次创建管理员用的口令，部署时用 secret 注入 */
  adminCode: string
}

export interface User {
  id: string
  name: string
  role: 'admin' | 'member' | 'visitor'
  verified: boolean
}

interface UserRow {
  id: string
  name: string
  password_hash: string
  salt: string
  role: string
  verified: number
  created_at: string
}

const SESSION_DAYS = 30
const MAX_COMMENT = 200
const MAX_FILE = 2 * 1024 * 1024

/* ---------------- 响应 ---------------- */

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })

const ok = (data: unknown = {}) => json({ ok: true, data })
const fail = (error: string, status = 400) => json({ ok: false, error }, status)

/* ---------------- schema 只建一次 ---------------- */

const schemas = new WeakMap<DB, Promise<void>>()

function ensureSchema(db: DB): Promise<void> {
  let promise = schemas.get(db)
  if (!promise) {
    const statements = SCHEMA_SQL.split(';')
      .map((s) => s.trim())
      .filter(Boolean)
    promise = (async () => {
      for (const sql of statements) {
        await db.prepare(sql).run()
      }
    })().catch((err) => {
      schemas.delete(db)
      throw err
    })
    schemas.set(db, promise)
  }
  return promise
}

/* ---------------- 小工具 ---------------- */

function cleanName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value.trim()
  if (name.length < 2 || name.length > 12) return null
  return name
}

function cleanPassword(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (value.length < 6 || value.length > 72) return null
  return value
}

const nowIso = () => new Date().toISOString()

function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    role: row.role === 'admin' ? 'admin' : row.role === 'member' ? 'member' : 'visitor',
    verified: row.verified === 1,
  }
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const text = await request.text()
    if (!text) return {}
    if (text.length > MAX_FILE) return null
    const parsed = JSON.parse(text)
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

/* ---------------- 会话 ---------------- */

async function createSession(db: DB, userId: string): Promise<string> {
  const token = randomHex(32)
  const tokenHash = await sha256Hex(token)
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString()
  await db
    .prepare(
      'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    )
    .bind(tokenHash, userId, nowIso(), expires)
    .run()
  return token
}

async function currentUser(db: DB, request: Request): Promise<User | null> {
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return null
  const tokenHash = await sha256Hex(token)
  const row = await db
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .bind(tokenHash, nowIso())
    .first<UserRow>()
  return row ? toUser(row) : null
}

/* ---------------- 设置 ---------------- */

async function getSetting(db: DB, key: string, fallback: string): Promise<string> {
  const row = await db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .bind(key)
    .first<{ value: string }>()
  return row?.value ?? fallback
}

/* ---------------- 主路由 ---------------- */

const TARGET_TYPES = new Set(['episode', 'extra'])

export async function handleApi(request: Request, env: Env): Promise<Response> {
  const db = env.db
  await ensureSchema(db)

  const url = new URL(request.url)
  const path = url.pathname.replace(/^\/api/, '') || '/'
  const method = request.method.toUpperCase()

  try {
    /* ---------- 健康检查 ---------- */

    if (path === '/health' && method === 'GET') {
      return ok({ service: 'yacc', version: 1, time: nowIso() })
    }

    /* ---------- 公开：内容 ---------- */

    if (path === '/content' && method === 'GET') {
      const row = await db
        .prepare('SELECT content, published_at FROM documents ORDER BY version DESC LIMIT 1')
        .first<{ content: string; published_at: string }>()
      if (!row) return fail('还没有发布过内容', 404)
      return new Response(row.content, {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'x-published-at': row.published_at,
        },
      })
    }

    /* ---------- 公开：设置 ---------- */

    if (path === '/settings' && method === 'GET') {
      return ok({
        moderation: await getSetting(db, 'comment_moderation', 'on'),
      })
    }

    /* ---------- 注册登录 ---------- */

    if (path === '/auth/register' && method === 'POST') {
      const body = await readJson(request)
      if (!body) return fail('请求格式不对')
      const name = cleanName(body.name)
      const password = cleanPassword(body.password)
      const key = typeof body.key === 'string' ? body.key.trim().toUpperCase() : ''
      if (!name) return fail('昵称需要 2–12 个字符')
      if (!password) return fail('密码至少 6 位')
      if (!key) return fail('需要邀请码或认证密钥')

      const keyRow = await db
        .prepare('SELECT * FROM activation_keys WHERE code = ?')
        .bind(key)
        .first<{ code: string; kind: string; used_by: string | null; expires_at: string | null }>()
      if (!keyRow) return fail('这个密钥无效', 401)
      if (keyRow.used_by) return fail('这个密钥已经被用过了', 409)
      if (keyRow.expires_at && keyRow.expires_at < nowIso()) {
        return fail('这个密钥已经过期', 410)
      }

      const exists = await db
        .prepare('SELECT id FROM users WHERE name = ?')
        .bind(name)
        .first<{ id: string }>()
      if (exists) return fail('这个昵称已经有人用了', 409)

      const salt = randomHex(16)
      const passwordHash = await hashPassword(password, salt)
      const user: User = {
        id: randomHex(8),
        name,
        role: keyRow.kind === 'member' ? 'member' : 'visitor',
        verified: true,
      }

      await db
        .prepare(
          'INSERT INTO users (id, name, password_hash, salt, role, verified, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(user.id, name, passwordHash, salt, user.role, 1, nowIso())
        .run()

      await db
        .prepare('UPDATE activation_keys SET used_by = ?, used_at = ? WHERE code = ?')
        .bind(user.id, nowIso(), key)
        .run()

      const token = await createSession(db, user.id)
      return ok({ token, user })
    }

    if (path === '/auth/login' && method === 'POST') {
      const body = await readJson(request)
      if (!body) return fail('请求格式不对')
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      const password = typeof body.password === 'string' ? body.password : ''
      const row = await db
        .prepare('SELECT * FROM users WHERE name = ?')
        .bind(name)
        .first<UserRow>()
      if (!row) return fail('没有这个账号', 401)
      const passed = await verifyPassword(password, row.salt, row.password_hash)
      if (!passed) return fail('密码不对，再试一次', 401)
      const token = await createSession(db, row.id)
      return ok({ token, user: toUser(row) })
    }

    if (path === '/auth/activate-admin' && method === 'POST') {
      const body = await readJson(request)
      if (!body) return fail('请求格式不对')
      const code = typeof body.code === 'string' ? body.code.trim() : ''
      const name = cleanName(body.name)
      const password = cleanPassword(body.password)
      if (!env.adminCode) return fail('服务端没有配置管理员口令', 500)
      if (code !== env.adminCode) return fail('激活口令不对', 401)
      if (!name) return fail('昵称需要 2–12 个字符')
      if (!password) return fail('密码至少 6 位')

      const admin = await db
        .prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1")
        .first<{ id: string }>()
      if (admin) return fail('已经存在管理员了，直接用那个账号登录', 409)

      const salt = randomHex(16)
      const passwordHash = await hashPassword(password, salt)
      const user: User = { id: randomHex(8), name, role: 'admin', verified: true }
      await db
        .prepare(
          'INSERT INTO users (id, name, password_hash, salt, role, verified, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(user.id, name, passwordHash, salt, 'admin', 1, nowIso())
        .run()

      // 顺手生成第一批密钥，省得注册完还要再点一次
      const seed = await issueKeys(db, 'member', 6, 365, '初始船员', user.id)
      const token = await createSession(db, user.id)
      return ok({ token, user, keys: seed })
    }

    /* ---------- 需要登录 ---------- */

    const me = await currentUser(db, request)

    if (path === '/auth/me' && method === 'GET') {
      if (!me) return fail('未登录', 401)
      return ok({ user: me })
    }

    if (path === '/auth/rename' && method === 'POST') {
      if (!me) return fail('未登录', 401)
      const body = await readJson(request)
      if (!body) return fail('请求格式不对')
      const name = cleanName(body.name)
      if (!name) return fail('昵称需要 2–12 个字符')
      const taken = await db
        .prepare('SELECT id FROM users WHERE name = ? AND id <> ?')
        .bind(name, me.id)
        .first<{ id: string }>()
      if (taken) return fail('这个昵称已经有人用了', 409)
      await db.prepare('UPDATE users SET name = ? WHERE id = ?').bind(name, me.id).run()
      return ok({ user: { ...me, name } })
    }

    if (path === '/auth/password' && method === 'POST') {
      if (!me) return fail('未登录', 401)
      const body = await readJson(request)
      if (!body) return fail('请求格式不对')
      const oldPassword = typeof body.oldPassword === 'string' ? body.oldPassword : ''
      const newPassword = cleanPassword(body.newPassword)
      if (!newPassword) return fail('新密码至少 6 位')
      const row = await db
        .prepare('SELECT * FROM users WHERE id = ?')
        .bind(me.id)
        .first<UserRow>()
      if (!row) return fail('账号不存在', 404)
      const passed = await verifyPassword(oldPassword, row.salt, row.password_hash)
      if (!passed) return fail('旧密码不对', 401)
      const salt = randomHex(16)
      const hash = await hashPassword(newPassword, salt)
      await db
        .prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?')
        .bind(hash, salt, me.id)
        .run()
      return ok()
    }

    if (path === '/auth/logout' && method === 'POST') {
      const header = request.headers.get('authorization') ?? ''
      const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
      if (token) {
        await db
          .prepare('DELETE FROM sessions WHERE token_hash = ?')
          .bind(await sha256Hex(token))
          .run()
      }
      return ok()
    }

    /* ---------- 评论 ---------- */

    if (path === '/comments' && method === 'GET') {
      const targetType = url.searchParams.get('targetType') ?? ''
      const targetId = url.searchParams.get('targetId') ?? ''
      if (!TARGET_TYPES.has(targetType) || !targetId) return fail('参数不对')
      const rows = await db
        .prepare(
          `SELECT c.id, c.body, c.created_at, c.user_id, u.name AS author
           FROM comments c JOIN users u ON u.id = c.user_id
           WHERE c.target_type = ? AND c.target_id = ? AND c.status = 'published'
           ORDER BY c.created_at ASC`,
        )
        .bind(targetType, targetId)
        .all<{ id: string; body: string; created_at: string; user_id: string; author: string }>()
      return ok({
        comments: rows.map((r) => ({
          id: r.id,
          body: r.body,
          createdAt: r.created_at,
          author: r.author,
          mine: me?.id === r.user_id,
        })),
        me: me ?? null,
      })
    }

    if (path === '/comments' && method === 'POST') {
      if (!me) return fail('登录后才能评论', 401)
      if (!me.verified) return fail('需要学校认证才能评论', 403)
      const body = await readJson(request)
      if (!body) return fail('请求格式不对')
      const targetType = String(body.targetType ?? '')
      const targetId = String(body.targetId ?? '')
      const text = typeof body.body === 'string' ? body.body.trim() : ''
      if (!TARGET_TYPES.has(targetType) || !targetId) return fail('参数不对')
      if (text.length === 0) return fail('说点什么吧')
      if (text.length > MAX_COMMENT) return fail(`最多 ${MAX_COMMENT} 个字`)

      const moderation = await getSetting(db, 'comment_moderation', 'on')
      const status = moderation === 'on' ? 'pending' : 'published'
      const id = randomHex(8)
      await db
        .prepare(
          'INSERT INTO comments (id, target_type, target_id, user_id, body, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(id, targetType, targetId, me.id, text, status, nowIso())
        .run()
      return ok({ id, status })
    }

    const deleteComment = /^\/comments\/([a-z0-9]+)$/.exec(path)
    if (deleteComment && method === 'DELETE') {
      if (!me) return fail('未登录', 401)
      const id = deleteComment[1]
      const row = await db
        .prepare('SELECT user_id FROM comments WHERE id = ?')
        .bind(id)
        .first<{ user_id: string }>()
      if (!row) return fail('找不到这条评论', 404)
      if (row.user_id !== me.id && me.role !== 'admin') {
        return fail('只能删自己的评论', 403)
      }
      await db.prepare('DELETE FROM comments WHERE id = ?').bind(id).run()
      return ok()
    }

    /* ---------- 点赞 ---------- */

    if (path === '/reactions' && method === 'GET') {
      const targetType = url.searchParams.get('targetType') ?? ''
      const targetId = url.searchParams.get('targetId') ?? ''
      if (!TARGET_TYPES.has(targetType) || !targetId) return fail('参数不对')
      const countRow = await db
        .prepare(
          'SELECT COUNT(*) AS n FROM reactions WHERE target_type = ? AND target_id = ?',
        )
        .bind(targetType, targetId)
        .first<{ n: number }>()
      let mine = false
      if (me) {
        const row = await db
          .prepare(
            'SELECT 1 AS x FROM reactions WHERE user_id = ? AND target_type = ? AND target_id = ?',
          )
          .bind(me.id, targetType, targetId)
          .first<{ x: number }>()
        mine = !!row
      }
      return ok({ count: Number(countRow?.n ?? 0), mine })
    }

    if (path === '/reactions/toggle' && method === 'POST') {
      if (!me) return fail('登录后才能点赞', 401)
      const body = await readJson(request)
      if (!body) return fail('请求格式不对')
      const targetType = String(body.targetType ?? '')
      const targetId = String(body.targetId ?? '')
      if (!TARGET_TYPES.has(targetType) || !targetId) return fail('参数不对')

      const existing = await db
        .prepare(
          'SELECT 1 AS x FROM reactions WHERE user_id = ? AND target_type = ? AND target_id = ?',
        )
        .bind(me.id, targetType, targetId)
        .first<{ x: number }>()

      if (existing) {
        await db
          .prepare(
            'DELETE FROM reactions WHERE user_id = ? AND target_type = ? AND target_id = ?',
          )
          .bind(me.id, targetType, targetId)
          .run()
      } else {
        await db
          .prepare(
            'INSERT INTO reactions (user_id, target_type, target_id, created_at) VALUES (?, ?, ?, ?)',
          )
          .bind(me.id, targetType, targetId, nowIso())
          .run()
      }

      const countRow = await db
        .prepare(
          'SELECT COUNT(*) AS n FROM reactions WHERE target_type = ? AND target_id = ?',
        )
        .bind(targetType, targetId)
        .first<{ n: number }>()
      return ok({ active: !existing, count: Number(countRow?.n ?? 0) })
    }

    /* ---------- 管理端 ---------- */

    const isAdmin = me?.role === 'admin'

    if (path.startsWith('/admin/') && !isAdmin) {
      return me ? fail('没有权限', 403) : fail('未登录', 401)
    }

    if (path === '/admin/publish' && method === 'POST') {
      const body = await readJson(request)
      if (!body || typeof body.content !== 'object') return fail('请求格式不对')
      const check = validateContent(body.content)
      if (!check.ok) {
        return fail(`内容校验没通过：${check.errors.slice(0, 3).join('；')}`)
      }
      const raw = JSON.stringify(check.data)
      await db
        .prepare('INSERT INTO documents (content, published_at, published_by) VALUES (?, ?, ?)')
        .bind(raw, nowIso(), me!.id)
        .run()
      const row = await db
        .prepare('SELECT version FROM documents ORDER BY version DESC LIMIT 1')
        .first<{ version: number }>()
      return ok({ version: row?.version ?? 0 })
    }

    if (path === '/admin/keys' && method === 'GET') {
      const rows = await db
        .prepare(
          `SELECT k.*, u.name AS used_by_name FROM activation_keys k
           LEFT JOIN users u ON u.id = k.used_by
           ORDER BY k.created_at DESC LIMIT 200`,
        )
        .all<Record<string, unknown>>()
      return ok({
        keys: rows.map((r) => ({
          code: r.code,
          kind: r.kind,
          note: r.note,
          createdAt: r.created_at,
          usedAt: r.used_at,
          usedBy: r.used_by_name ?? null,
          expiresAt: r.expires_at,
        })),
      })
    }

    if (path === '/admin/keys' && method === 'POST') {
      const body = await readJson(request)
      if (!body) return fail('请求格式不对')
      const kind = body.kind === 'visitor' ? 'visitor' : 'member'
      const count = Math.min(50, Math.max(1, Number(body.count) || 1))
      const days = Math.min(365, Math.max(1, Number(body.expiresInDays) || 30))
      const note = typeof body.note === 'string' ? body.note.slice(0, 40) : ''
      const keys = await issueKeys(db, kind, count, days, note, me!.id)
      return ok({ keys })
    }

    const revokeKey = /^\/admin\/keys\/([A-Za-z0-9-]+)$/.exec(path)
    if (revokeKey && method === 'DELETE') {
      await db
        .prepare('DELETE FROM activation_keys WHERE code = ? AND used_by IS NULL')
        .bind(revokeKey[1].toUpperCase())
        .run()
      return ok()
    }

    if (path === '/admin/comments' && method === 'GET') {
      const status = url.searchParams.get('status') ?? 'pending'
      const rows = await db
        .prepare(
          `SELECT c.id, c.body, c.status, c.created_at, c.target_type, c.target_id,
                  u.name AS author
           FROM comments c JOIN users u ON u.id = c.user_id
           WHERE c.status = ? ORDER BY c.created_at DESC LIMIT 200`,
        )
        .bind(status)
        .all<Record<string, unknown>>()
      return ok({
        comments: rows.map((r) => ({
          id: r.id,
          body: r.body,
          status: r.status,
          createdAt: r.created_at,
          targetType: r.target_type,
          targetId: r.target_id,
          author: r.author,
        })),
      })
    }

    const moderate = /^\/admin\/comments\/([a-z0-9]+)$/.exec(path)
    if (moderate && method === 'POST') {
      const body = await readJson(request)
      if (!body) return fail('请求格式不对')
      const status = String(body.status ?? '')
      if (!['published', 'hidden', 'pending'].includes(status)) return fail('参数不对')
      await db
        .prepare('UPDATE comments SET status = ? WHERE id = ?')
        .bind(status, moderate[1])
        .run()
      return ok()
    }

    if (path === '/admin/users' && method === 'GET') {
      const rows = await db
        .prepare(
          'SELECT id, name, role, verified, created_at FROM users ORDER BY created_at ASC',
        )
        .all<Record<string, unknown>>()
      return ok({
        users: rows.map((r) => ({
          id: r.id,
          name: r.name,
          role: r.role,
          verified: r.verified === 1,
          createdAt: r.created_at,
        })),
      })
    }

    const patchUser = /^\/admin\/users\/([a-z0-9]+)$/.exec(path)
    if (patchUser && method === 'POST') {
      const body = await readJson(request)
      if (!body) return fail('请求格式不对')
      if (typeof body.verified === 'boolean') {
        await db
          .prepare('UPDATE users SET verified = ? WHERE id = ?')
          .bind(body.verified ? 1 : 0, patchUser[1])
          .run()
      }
      return ok()
    }

    if (path === '/admin/settings' && method === 'POST') {
      const body = await readJson(request)
      if (!body) return fail('请求格式不对')
      if (body.moderation === 'on' || body.moderation === 'off') {
        await db
          .prepare(
            'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
          )
          .bind('comment_moderation', body.moderation)
          .run()
      }
      return ok({ moderation: await getSetting(db, 'comment_moderation', 'on') })
    }

    return fail('没有这个接口', 404)
  } catch (err) {
    const message = err instanceof Error ? err.message : '服务器出错了'
    return fail(message, 500)
  }
}

/* ---------------- 密钥生成 ---------------- */

async function issueKeys(
  db: DB,
  kind: 'member' | 'visitor',
  count: number,
  days: number,
  note: string,
  createdBy: string,
): Promise<string[]> {
  const codes: string[] = []
  const expires = new Date(Date.now() + days * 86400_000).toISOString()
  for (let i = 0; i < count; i += 1) {
    let code = generateKey()
    // 极小概率撞码，最多重试几次
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const exists = await db
        .prepare('SELECT 1 AS x FROM activation_keys WHERE code = ?')
        .bind(code)
        .first<{ x: number }>()
      if (!exists) break
      code = generateKey()
    }
    await db
      .prepare(
        'INSERT INTO activation_keys (code, kind, note, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .bind(code, kind, note, createdBy, nowIso(), expires)
      .run()
    codes.push(code)
  }
  return codes
}
