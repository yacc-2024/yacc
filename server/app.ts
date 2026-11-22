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
import {
  allocateUid,
  describeSpec,
  describeUid,
  formatUid,
  normaliseSpec,
  type IdSpec,
} from './uid'

export interface Env {
  db: DB
  /** 首次创建管理员用的口令，部署时用 secret 注入 */
  adminCode: string
}

export type AdminPerm = 'content' | 'users' | 'keys' | 'comments'

export interface User {
  id: string
  /** 固定的数字账号 ID，注册后不再变化 */
  uid: number | null
  name: string
  avatar: string | null
  /** 管理员发过的所有称号 */
  titles: string[]
  /** 自己选择展示的称号（最多 3 个） */
  shownTitles: string[]
  role: 'superadmin' | 'admin' | 'member' | 'visitor'
  verified: boolean
  /** 分管理员的权限；总管理员恒为全部 */
  perms: AdminPerm[]
}

interface UserRow {
  id: string
  uid: number | null
  name: string
  avatar: string | null
  title: string | null
  titles: string | null
  shown_titles: string | null
  member_id: string | null
  perms: string | null
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

/**
 * 极简内存限流：同一个键在窗口期内最多 N 次。
 * Worker 的每个实例独立计数，够挡住手动连点，不追求精确。
 */
const buckets = new Map<string, number[]>()

function tooFast(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  if (hits.length >= limit) {
    buckets.set(key, hits)
    return true
  }
  hits.push(now)
  buckets.set(key, hits)
  if (buckets.size > 5000) buckets.clear()
  return false
}

/** 允许的来源：网站自己 + 安卓壳（Capacitor 默认 https://localhost） */
const ALLOWED_ORIGINS = new Set([
  'https://localhost',
  'http://localhost',
  'capacitor://localhost',
])

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin) return {}
  const ok = ALLOWED_ORIGINS.has(origin) || origin.endsWith('.yacc2026.pages.dev')
  if (!ok) return {}
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-max-age': '86400',
    vary: 'origin',
  }
}

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
      // 老库补列：新库这两条会报「duplicate column」，忽略
      for (const sql of [
        'ALTER TABLE sessions ADD COLUMN device TEXT',
        'ALTER TABLE sessions ADD COLUMN device_id TEXT',
        'ALTER TABLE login_requests ADD COLUMN device_id TEXT',
        'ALTER TABLE posts ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0',
        'ALTER TABLE users ADD COLUMN uid INTEGER',
        'ALTER TABLE users ADD COLUMN avatar TEXT',
        'ALTER TABLE users ADD COLUMN signup_ip TEXT',
        'ALTER TABLE activation_keys ADD COLUMN spec TEXT',
        'ALTER TABLE users ADD COLUMN perms TEXT',
        'ALTER TABLE users ADD COLUMN title TEXT',
        'ALTER TABLE users ADD COLUMN titles TEXT',
        'ALTER TABLE users ADD COLUMN shown_titles TEXT',
        'ALTER TABLE users ADD COLUMN member_id TEXT',
        'ALTER TABLE comments ADD COLUMN parent_id TEXT',
        'ALTER TABLE comments ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0',
        'ALTER TABLE comments ADD COLUMN reply_to_name TEXT',
      ]) {
        try {
          await db.prepare(sql).run()
        } catch {
          /* 列已存在 */
        }
      }
      await normaliseLegacyUids(db)
      await ensureSuperadmin(db)
      await ensureChangelogSeed(db)
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
    uid: row.uid ?? null,
    name: row.name,
    avatar: row.avatar ?? null,
    titles: parseTitles(row.titles, row.title),
    shownTitles: parseShown(row.shown_titles, row.titles, row.title),
    role:
      row.role === 'superadmin'
        ? 'superadmin'
        : row.role === 'admin'
          ? 'admin'
          : 'visitor',
    verified: row.verified === 1,
    perms: parsePerms(row.perms),
  }
}

const ALL_PERMS: AdminPerm[] = ['content', 'users', 'keys', 'comments']

const MAX_TITLES = 10
const MAX_SHOWN = 3

/** 解析称号列表；兼容只有一个称号的老数据 */
function parseTitles(raw: string | null | undefined, legacy: string | null): string[] {
  if (raw) {
    try {
      const list = JSON.parse(raw)
      if (Array.isArray(list)) {
        return list.filter((x): x is string => typeof x === 'string').slice(0, MAX_TITLES)
      }
    } catch {
      /* 忽略 */
    }
  }
  return legacy ? [legacy] : []
}

function parseShown(
  raw: string | null | undefined,
  titlesRaw: string | null | undefined,
  legacy: string | null,
): string[] {
  const all = parseTitles(titlesRaw, legacy)
  if (raw) {
    try {
      const list = JSON.parse(raw)
      if (Array.isArray(list)) {
        const picked = list.filter((x): x is string => typeof x === 'string')
        const valid = picked.filter((t) => all.includes(t)).slice(0, MAX_SHOWN)
        if (valid.length > 0) return valid
      }
    } catch {
      /* 忽略 */
    }
  }
  return all.slice(0, 1)
}

function parsePerms(raw: string | null | undefined): AdminPerm[] {
  if (!raw) return []
  try {
    const list = JSON.parse(raw)
    if (!Array.isArray(list)) return []
    return list.filter((x): x is AdminPerm => ALL_PERMS.includes(x as AdminPerm))
  } catch {
    return []
  }
}

/** 论坛里只显示大类身份，不展示具体分工和季数 */
function shortBadge(role: string | null, uid: number | null): string {
  if (role === 'admin' || role === 'superadmin') return '管理员'
  const code = formatUid(uid)
  if (code[0] === '1') return '剧组成员'
  if (code[0] === '2') return '认证成员'
  return '普通访客'
}

/** 徽章的种类，用来区分颜色和角标 */
function badgeKind(role: string | null, uid: number | null): string {
  if (role === 'admin' || role === 'superadmin') return 'admin'
  const code = formatUid(uid)
  if (code[0] === '1') return 'crew'
  if (code[0] === '2') return 'member'
  return 'guest'
}

function can(me: User | null, perm: AdminPerm): boolean {
  if (!me) return false
  if (me.role === 'superadmin') return true
  if (me.role !== 'admin') return false
  return me.perms.includes(perm)
}

/**
 * 老版本用的是 6 位流水号，这里统一重排成新的五位规则。
 * 老账号先按「剧组成员 · 导演 · 两季都参与」占位，之后可以在后台改。
 */
export async function normaliseLegacyUids(db: DB): Promise<void> {
  // 1) 老版本的 6 位流水号 → 剧组成员
  const rows = await db
    .prepare('SELECT id FROM users WHERE uid IS NULL OR uid >= 100000 ORDER BY created_at ASC')
    .all<{ id: string }>()
  for (const row of rows) {
    const uid = await allocateUid(db, { kind: 'crew', role: 1, season: 9 })
    await db.prepare('UPDATE users SET uid = ? WHERE id = ?').bind(uid, row.id).run()
  }

  // 2) 普通访客从 0xxxx 改成 3xxxx
  //    这一步只做一次：否则管理员手动设的 00001 会被反复改掉
  const migrated = await db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .bind(GUEST_MIGRATION_KEY)
    .first<{ value: string }>()
  if (!migrated) {
    const guests = await db
      .prepare(
        "SELECT id FROM users WHERE uid < 10000 AND role = 'visitor' AND verified = 0 ORDER BY uid ASC",
      )
      .all<{ id: string }>()
    for (const row of guests) {
      const uid = await allocateUid(db, { kind: 'guest' })
      await db.prepare('UPDATE users SET uid = ? WHERE id = ?').bind(uid, row.id).run()
    }
    await db
      .prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      )
      .bind(GUEST_MIGRATION_KEY, '1')
      .run()
  }
}

/**
 * 保证系统里始终有一个总管理员。
 * 老版本建的管理员只有 role='admin'、没有权限字段，升级后会变成「什么都不能管」，
 * 这里把它们中的第一个提升为总管理员。
 * 优先级：名字叫 yacc-admin 的 → 最早创建的管理员。
 */
const GUEST_MIGRATION_KEY = 'migrate:guest-uid-v3'
const CHANGELOG_KEY = 'migrate:changelog-v16'

/** 站点历次更新（面向访客，不含管理端功能） */
const CHANGELOG_SEED = [
  {
    version: '1.6.0',
    date: '2026-11-22',
    items: [
      '新增 YACC 论坛：可以发帖、配图、点赞和评论',
      '帖子支持评论区与楼中楼回复',
      '首页新增论坛入口，只展示最新动态',
      '个人主页新增关注、粉丝与获赞',
      '被关注时会收到消息提醒',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-11-22',
    items: [
      '大幅提升加载速度：评论、帖子、个人主页优先显示本地缓存',
      '页面内容自动同步，无需手动刷新',
      '重做加载动画，不再出现一排灰色方块',
      '修复偶尔自动退出登录的问题',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-11-22',
    items: [
      '一个账号默认只能在一台设备上登录',
      '在新设备登录时，原设备会收到授权请求',
      '确认过的设备下次登录不再重复请求',
      '可以在设备管理里让其他设备下线',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-11-22',
    items: [
      '新增安卓 App，可安装到桌面全屏使用',
      '新增开屏动画，启动不再白屏',
      '支持侧滑返回上一级',
      'App 版本自动跟随网站更新',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-11-21',
    items: [
      '适配电脑：宽屏下使用左侧导航，内容更舒展',
      '桌面端弹窗改为居中显示',
      '手机端保持原有布局',
      '成员页与账号打通，可直接进入成员的个人主页',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-11-21',
    items: [
      '评论区重做：支持回复、楼中楼展示与折叠',
      '评论可以点赞，被回复时会收到消息',
      '评论改为更简洁的时间与排版样式',
      '全站不再使用 S2 · E3 这类英文标记，改为中文标注',
    ],
  },
  {
    version: '1.0.9',
    date: '2026-11-21',
    items: [
      '账号可以拥有多个称号，并自行选择展示',
      '头像支持直接上传并裁剪',
      '个人主页与成员页打通，可展示参演作品',
      '新增消息中心，集中查看回复与关注',
    ],
  },
]

/**
 * 把历次更新补进线上内容里，只做一次。
 * 已经存在的版本以线上为准，不覆盖。
 */
export async function ensureChangelogSeed(db: DB): Promise<void> {
  const done = await db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .bind(CHANGELOG_KEY)
    .first<{ value: string }>()
  if (done) return

  const latest = await db
    .prepare('SELECT version, content FROM documents ORDER BY version DESC LIMIT 1')
    .first<{ version: number; content: string }>()

  if (latest) {
    try {
      const doc = JSON.parse(latest.content) as {
        changelog?: Array<{ version: string; date: string; items: string[] }>
      }
      const existing = Array.isArray(doc.changelog) ? doc.changelog : []
      const have = new Set(existing.map((e) => e.version))
      const merged = [...existing]
      for (const entry of CHANGELOG_SEED) {
        if (!have.has(entry.version)) merged.push(entry)
      }
      merged.sort((a, b) => {
        const byDate = (b.date ?? '').localeCompare(a.date ?? '')
        if (byDate !== 0) return byDate
        return b.version.localeCompare(a.version, undefined, { numeric: true })
      })
      doc.changelog = merged
      const changed = merged.length !== existing.length
      if (changed) {
        await db
          .prepare('INSERT INTO documents (content, published_at, published_by) VALUES (?, ?, ?)')
          .bind(JSON.stringify(doc), nowIso(), null)
          .run()
      }
    } catch {
      /* 内容坏了就跳过，不阻断启动 */
    }
  }

  await db
    .prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    )
    .bind(CHANGELOG_KEY, '1')
    .run()
}

export async function ensureSuperadmin(db: DB): Promise<void> {
  const existing = await db
    .prepare("SELECT id FROM users WHERE role = 'superadmin' LIMIT 1")
    .first<{ id: string }>()
  if (existing) {
    // 已经有总管理员了，但仍要把 yacc-admin 补成总管理员（用户明确指定）
    const named = await db
      .prepare("SELECT id, role FROM users WHERE name = ? COLLATE NOCASE")
      .bind('yacc-admin')
      .first<{ id: string; role: string }>()
    if (named && named.role !== 'superadmin') {
      await db
        .prepare("UPDATE users SET role = 'superadmin', perms = NULL WHERE id = ?")
        .bind(named.id)
        .run()
    }
    return
  }

  const named = await db
    .prepare("SELECT id FROM users WHERE name = ? COLLATE NOCASE")
    .bind('yacc-admin')
    .first<{ id: string }>()
  const target =
    named ??
    (await db
      .prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1")
      .first<{ id: string }>())

  if (!target) return
  await db
    .prepare("UPDATE users SET role = 'superadmin', perms = NULL WHERE id = ?")
    .bind(target.id)
    .run()
}

/** 取客户端 IP（Cloudflare 会带 cf-connecting-ip） */
function clientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
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

async function createSession(db: DB, userId: string, device = '', deviceId = ''): Promise<string> {
  // 默认单设备：新会话建立时把旧会话作废（多设备授权走 login_requests）
  await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run()
  const token = randomHex(32)
  const tokenHash = await sha256Hex(token)
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString()
  await db
    .prepare(
      'INSERT INTO sessions (token_hash, user_id, device, device_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(tokenHash, userId, device, deviceId, nowIso(), expires)
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

const TARGET_TYPES = new Set(['episode', 'extra', 'post'])

export async function handleApi(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('origin')

  if (request.method.toUpperCase() === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) })
  }

  const res = await handleApiInner(request, env)
  const extra = corsHeaders(origin)
  if (Object.keys(extra).length === 0) return res
  const headers = new Headers(res.headers)
  for (const [k, v] of Object.entries(extra)) headers.set(k, v)
  return new Response(res.body, { status: res.status, headers })
}

async function handleApiInner(request: Request, env: Env): Promise<Response> {
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

    const userContent = /^\/users\/(\d{1,6})\/content$/.exec(path)
    if (userContent && method === 'GET') {
      const raw = Number(userContent[1])
      const target = await db
        .prepare('SELECT id FROM users WHERE uid = ?')
        .bind(raw)
        .first<{ id: string }>()
      if (!target) return fail('找不到这个账号', 404)

      const posts = await db
        .prepare(
          `SELECT id, body, created_at, pinned FROM posts
           WHERE user_id = ? AND status = 'published'
           ORDER BY created_at DESC LIMIT 50`,
        )
        .bind(target.id)
        .all<{ id: string; body: string; created_at: string; pinned: number }>()

      const comments = await db
        .prepare(
          `SELECT c.id, c.body, c.created_at, c.target_type, c.target_id
           FROM comments c
           WHERE c.user_id = ? AND c.status = 'published'
           ORDER BY c.created_at DESC LIMIT 50`,
        )
        .bind(target.id)
        .all<{
          id: string
          body: string
          created_at: string
          target_type: string
          target_id: string
        }>()

      return ok({
        posts: posts.map((p) => ({
          id: p.id,
          body: p.body,
          createdAt: p.created_at,
          pinned: p.pinned === 1,
        })),
        comments: comments.map((c) => ({
          id: c.id,
          body: c.body,
          createdAt: c.created_at,
          targetType: c.target_type,
          targetId: c.target_id,
        })),
      })
    }

    /* ---------- 公开：成员页与账号的对应关系 ---------- */

    if (path === '/members/links' && method === 'GET') {
      const rows = await db
        .prepare(
          `SELECT member_id, uid, name, avatar FROM users
           WHERE member_id IS NOT NULL ORDER BY uid ASC`,
        )
        .all<{ member_id: string; uid: number | null; name: string; avatar: string | null }>()
      return ok({
        links: rows.map((r) => ({
          memberId: r.member_id,
          uid: formatUid(r.uid),
          name: r.name,
          avatar: r.avatar ?? null,
        })),
      })
    }

    /* ---------- 公开：用户主页 ---------- */

    const userPage = /^\/users\/(\d{1,6})$/.exec(path)
    if (userPage && method === 'GET') {
      const raw = Number(userPage[1])
      const row = await db
        .prepare('SELECT * FROM users WHERE uid = ?')
        .bind(raw)
        .first<UserRow>()
      if (!row) return fail('找不到这个账号', 404)
      const summary = describeUid(row.uid)
      const commentCount = await db
        .prepare("SELECT COUNT(*) AS n FROM comments WHERE user_id = ? AND status = 'published'")
        .bind(row.id)
        .first<{ n: number }>()
      const followerCount = await db
        .prepare('SELECT COUNT(*) AS n FROM follows WHERE followee_id = ?')
        .bind(row.id)
        .first<{ n: number }>()
      const followingCount = await db
        .prepare('SELECT COUNT(*) AS n FROM follows WHERE follower_id = ?')
        .bind(row.id)
        .first<{ n: number }>()
      const likeCount = await db
        .prepare(
          `SELECT
             (SELECT COUNT(*) FROM post_likes l JOIN posts p ON p.id = l.post_id WHERE p.user_id = ?)
           + (SELECT COUNT(*) FROM reactions r JOIN comments c ON c.id = r.target_id
                WHERE r.target_type = 'comment' AND c.user_id = ?) AS n`,
        )
        .bind(row.id, row.id)
        .first<{ n: number }>()
      const postCount = await db
        .prepare("SELECT COUNT(*) AS n FROM posts WHERE user_id = ? AND status = 'published'")
        .bind(row.id)
        .first<{ n: number }>()
      const viewer = await currentUser(db, request)
      const isFollowing =
        viewer && viewer.id !== row.id
          ? Boolean(
              await db
                .prepare('SELECT 1 AS x FROM follows WHERE follower_id = ? AND followee_id = ?')
                .bind(viewer.id, row.id)
                .first<{ x: number }>(),
            )
          : false
      return ok({
        user: {
          uid: formatUid(row.uid),
          rawUid: row.uid,
          name: row.name,
          avatar: row.avatar ?? null,
          role: toUser(row).role,
          verified: row.verified === 1,
          memberSince: row.created_at,
          memberId: row.member_id ?? null,
          label: (() => {
            const shown = parseShown(row.shown_titles, row.titles, row.title)
            return shown.length ? shown.join(' · ') : summary.label
          })(),
          titles: parseTitles(row.titles, row.title),
          shownTitles: parseShown(row.shown_titles, row.titles, row.title),
          commentCount: Number(commentCount?.n ?? 0),
          followers: Number(followerCount?.n ?? 0),
          followingCount: Number(followingCount?.n ?? 0),
          likes: Number(likeCount?.n ?? 0),
          isFollowing,
          isMe: viewer?.id === row.id,
          userId: row.id,
          postCount: Number(postCount?.n ?? 0),
        },
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

      interface KeyRow {
        code: string
        kind: string
        spec: string | null
        used_by: string | null
        expires_at: string | null
      }

      let spec: IdSpec = { kind: 'guest' }
      let verified = 0
      let keyRow: KeyRow | null = null
      let isAdminSignup = false
      let adminPerms: AdminPerm[] = []

      if (key) {
        keyRow = await db
          .prepare('SELECT * FROM activation_keys WHERE code = ?')
          .bind(key)
          .first<KeyRow>()
        if (!keyRow) return fail('这个密钥无效', 401)
        if (keyRow.used_by) return fail('这个密钥已经被用过了', 409)
        if (keyRow.expires_at && keyRow.expires_at < nowIso()) {
          return fail('这个密钥已经过期', 410)
        }

        let parsed: unknown = null
        try {
          parsed = keyRow.spec ? JSON.parse(keyRow.spec) : null
        } catch {
          parsed = null
        }
        const adminSpec = parsed as { kind?: string; perms?: string[] } | null
        if (adminSpec?.kind === 'admin') {
          const perms = (adminSpec.perms ?? []).filter((p): p is AdminPerm =>
            ALL_PERMS.includes(p as AdminPerm),
          )
          adminPerms = perms.length ? perms : ['content']
          spec = { kind: 'crew', role: 1, season: 9 }
          verified = 1
          isAdminSignup = true
        } else {
          spec =
            normaliseSpec(parsed) ??
            normaliseSpec({ kind: keyRow.kind === 'member' ? 'crew' : 'member', grade: 0, klass: 0 }) ??
            { kind: 'member', grade: 0, klass: 0 }
          verified = 1
        }
      } else {
        // 普通访客：不用密钥，但同一台设备一天最多 3 个账号
        const ip = clientIp(request)
        if (ip !== 'unknown') {
          const since = new Date(Date.now() - 86400_000).toISOString()
          const row = await db
            .prepare('SELECT COUNT(*) AS n FROM users WHERE signup_ip = ? AND created_at > ?')
            .bind(ip, since)
            .first<{ n: number }>()
          if (Number(row?.n ?? 0) >= 3) {
            return fail('这台设备今天注册的账号太多了，明天再来或找负责人要认证密钥', 429)
          }
        }
      }

      const exists = await db
        .prepare('SELECT id FROM users WHERE name = ?')
        .bind(name)
        .first<{ id: string }>()
      if (exists) return fail('这个昵称已经有人用了', 409)

      const salt = randomHex(16)
      const passwordHash = await hashPassword(password, salt)
      const uid = await allocateUid(db, spec)
      const role = isAdminSignup ? 'admin' : 'visitor'
      const user: User = {
        id: randomHex(8),
        uid,
        name,
        avatar: null,
        titles: [],
        shownTitles: [],
        role,
        verified: verified === 1,
        perms: isAdminSignup ? adminPerms : [],
      }

      await db
        .prepare(
          'INSERT INTO users (id, uid, name, password_hash, salt, role, perms, verified, created_at, signup_ip, member_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          user.id,
          uid,
          name,
          passwordHash,
          salt,
          role,
          isAdminSignup ? JSON.stringify(adminPerms) : null,
          verified,
          nowIso(),
          clientIp(request),
          spec.kind === 'crew' && spec.memberId ? spec.memberId : null,
        )
        .run()

      if (keyRow) {
        await db
          .prepare('UPDATE activation_keys SET used_by = ?, used_at = ? WHERE code = ?')
          .bind(user.id, nowIso(), keyRow.code)
          .run()
      }

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
      const device = typeof body.device === 'string' ? body.device.slice(0, 40) : ''
      const deviceId = typeof body.deviceId === 'string' ? body.deviceId.slice(0, 40) : ''
      const replace = body.replace === true

      // 这台设备之前被批准过，直接放行
      const known = deviceId
        ? await db
            .prepare('SELECT 1 AS x FROM auth_devices WHERE user_id = ? AND device_id = ?')
            .bind(row.id, deviceId)
            .first<{ x: number }>()
        : null

      // 已经有「别的设备」在线，且没有要求顶掉
      // 同一台设备重复登录（比如换了浏览器）不拦截，直接替换
      const active = await db
        .prepare(
          "SELECT COUNT(*) AS n FROM sessions WHERE user_id = ? AND expires_at > ? AND IFNULL(device, '') <> ?",
        )
        .bind(row.id, nowIso(), device)
        .first<{ n: number }>()

      if (Number(active?.n ?? 0) > 0 && !replace && !known) {
        // 复用同一个设备上一次的申请，避免重复点登录堆积
        const existing = await db
          .prepare(
            "SELECT id FROM login_requests WHERE user_id = ? AND status = 'pending' AND device = ? ORDER BY created_at DESC LIMIT 1",
          )
          .bind(row.id, device)
          .first<{ id: string }>()

        let requestId = existing?.id
        if (!requestId) {
          requestId = randomHex(8)
          await db
            .prepare(
              'INSERT INTO login_requests (id, user_id, device, device_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            )
            .bind(requestId, row.id, device, deviceId, 'pending', nowIso())
            .run()
        }

        return json(
          {
            ok: false,
            error: '这个账号正在另一台设备上使用',
            code: 'need_authorize',
            requestId,
            user: toUser(row),
          },
          409,
        )
      }

      const token = await createSession(db, row.id, device, deviceId)
      return ok({ token, user: toUser(row) })
    }

    /* ---------- 授权登录 ---------- */

    const who = await currentUser(db, request)


    if (path === '/auth/request-status' && method === 'GET') {
      const id = url.searchParams.get('id') ?? ''
      const req = await db
        .prepare('SELECT * FROM login_requests WHERE id = ?')
        .bind(id)
        .first<{ id: string; status: string; token: string | null; created_at: string }>()
      if (!req) return fail('申请不在了', 404)

      // 超过 5 分钟自动作废
      if (req.status === 'pending' && Date.now() - new Date(req.created_at).getTime() > 300_000) {
        await db
          .prepare("UPDATE login_requests SET status = 'expired' WHERE id = ?")
          .bind(id)
          .run()
        return ok({ status: 'expired' })
      }
      return ok({ status: req.status, token: req.token ?? null })
    }

    if (path === '/auth/requests' && method === 'GET') {
      if (!who) return fail('未登录', 401)
      const rows = await db
        .prepare(
          "SELECT id, device, created_at FROM login_requests WHERE user_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 10",
        )
        .bind(who.id)
        .all<{ id: string; device: string | null; created_at: string }>()
      return ok({
        requests: rows.map((r) => ({
          id: r.id,
          device: r.device ?? '',
          createdAt: r.created_at,
        })),
      })
    }

    const decideRequest = /^\/auth\/requests\/([a-z0-9]+)$/.exec(path)
    if (decideRequest && method === 'POST') {
      if (!who) return fail('未登录', 401)
      const body = await readJson(request)
      if (!body) return fail('请求格式不对')
      const action = String(body.action ?? '')
      const req = await db
        .prepare('SELECT * FROM login_requests WHERE id = ? AND user_id = ?')
        .bind(decideRequest[1], who.id)
        .first<{
        id: string
        user_id: string
        device: string | null
        device_id: string | null
        status: string
      }>()
      if (!req) return fail('找不到这条申请', 404)
      if (req.status !== 'pending') return fail('这条申请已经处理过了', 409)

      if (action === 'deny') {
        await db
          .prepare("UPDATE login_requests SET status = 'denied' WHERE id = ?")
          .bind(req.id)
          .run()
        return ok()
      }
      if (action !== 'approve') return fail('参数不对')

      // 批准：记住这台设备，以后同一设备登录不再需要授权
      if (req.device_id) {
        await db
          .prepare(
            'INSERT INTO auth_devices (user_id, device_id, name, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, device_id) DO UPDATE SET name = excluded.name',
          )
          .bind(who.id, req.device_id, req.device ?? '', nowIso())
          .run()
      }

      const token = randomHex(32)
      const tokenHash = await sha256Hex(token)
      const expires = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString()
      await db
        .prepare(
          'INSERT INTO sessions (token_hash, user_id, device, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(tokenHash, who.id, req.device ?? '', nowIso(), expires)
        .run()
      await db
        .prepare("UPDATE login_requests SET status = 'approved', token = ? WHERE id = ?")
        .bind(token, req.id)
        .run()
      return ok()
    }

    /* ---------- 已登录设备 ---------- */

    if (path === '/auth/sessions' && method === 'GET') {
      const who = await currentUser(db, request)
      if (!who) return fail('未登录', 401)

      const rows = await db
        .prepare(
          'SELECT device, device_id, created_at, expires_at FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY created_at DESC',
        )
        .bind(who.id, nowIso())
        .all<{
          device: string | null
          device_id: string | null
          created_at: string
          expires_at: string
        }>()

      // 同一个设备可能有多条会话，按设备合并，只留最新一条
      const seen = new Map<string, { key: string; name: string; createdAt: string }>()
      for (const r of rows) {
        const key = r.device_id || r.device || 'unknown'
        if (seen.has(key)) continue
        seen.set(key, {
          key,
          name: r.device || '未知设备',
          createdAt: r.created_at,
        })
      }

      const header = request.headers.get('authorization') ?? ''
      const raw = header.replace(/^Bearer\s+/i, '').trim()
      const mine = raw
        ? await db
            .prepare('SELECT device_id, device FROM sessions WHERE token_hash = ?')
            .bind(await sha256Hex(raw))
            .first<{ device_id: string | null; device: string | null }>()
        : null
      const myKey = mine?.device_id || mine?.device || ''

      return ok({
        sessions: Array.from(seen.values()).map((s) => ({
          ...s,
          current: s.key === myKey,
        })),
      })
    }

    const dropDevice = /^\/auth\/devices\/(.+)$/.exec(path)
    if (dropDevice && method === 'DELETE') {
      const who = await currentUser(db, request)
      if (!who) return fail('未登录', 401)
      const key = decodeURIComponent(dropDevice[1])
      if (!key) return fail('参数不对')

      // 不能把手里的这台设备踢掉
      const header = request.headers.get('authorization') ?? ''
      const raw = header.replace(/^Bearer\s+/i, '').trim()
      const mine = raw
        ? await db
            .prepare('SELECT device_id, device FROM sessions WHERE token_hash = ?')
            .bind(await sha256Hex(raw))
            .first<{ device_id: string | null; device: string | null }>()
        : null
      const myKey = mine?.device_id || mine?.device || ''
      if (key === myKey) return fail('不能删除当前设备', 400)

      await db
        .prepare('DELETE FROM sessions WHERE user_id = ? AND (device_id = ? OR device = ?)')
        .bind(who.id, key, key)
        .run()
      await db
        .prepare('DELETE FROM auth_devices WHERE user_id = ? AND (device_id = ? OR name = ?)')
        .bind(who.id, key, key)
        .run()
      return ok()
    }

    if (path === '/auth/session' && method === 'DELETE') {
      if (!who) return fail('未登录', 401)
      const header = request.headers.get('authorization') ?? ''
      const token = header.replace(/^Bearer\s+/i, '').trim()
      if (token) {
        await db
          .prepare('DELETE FROM sessions WHERE token_hash = ?')
          .bind(await sha256Hex(token))
          .run()
      }
      return ok()
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
        .prepare("SELECT id FROM users WHERE role IN ('admin', 'superadmin') LIMIT 1")
        .first<{ id: string }>()
      if (admin) return fail('已经存在管理员了，直接用那个账号登录', 409)

      const salt = randomHex(16)
      const passwordHash = await hashPassword(password, salt)
      const uid = await allocateUid(db, { kind: 'crew', role: 1, season: 9 })
      const user: User = {
        id: randomHex(8),
        uid,
        name,
        avatar: null,
        titles: [],
        shownTitles: [],
        role: 'superadmin',
        verified: true,
        perms: ALL_PERMS,
      }
      await db
        .prepare(
          'INSERT INTO users (id, uid, name, password_hash, salt, role, verified, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(user.id, uid, name, passwordHash, salt, 'superadmin', 1, nowIso())
        .run()

      // 顺手生成第一批密钥，省得注册完还要再点一次
      const seed = await issueKeys(
        db,
        'crew',
        JSON.stringify({ kind: 'crew', role: 1, season: 9 }),
        6,
        365,
        '初始认证密钥',
        user.id,
      )
      const token = await createSession(db, user.id)
      return ok({ token, user, keys: seed })
    }

    /* ---------- 需要登录 ---------- */

    const me = await currentUser(db, request)

    if (path === '/auth/me' && method === 'GET') {
      if (!me) return fail('未登录', 401)
      return ok({ user: me })
    }

    if ((path === '/auth/profile' || path === '/auth/rename') && method === 'POST') {
      if (!me) return fail('未登录', 401)
      const body = await readJson(request)
      if (!body) return fail('请求格式不对')

      let nextName = me.name
      if (body.name !== undefined) {
        const name = cleanName(body.name)
        if (!name) return fail('昵称需要 2–12 个字符')
        const taken = await db
          .prepare('SELECT id FROM users WHERE name = ? AND id <> ?')
          .bind(name, me.id)
          .first<{ id: string }>()
        if (taken) return fail('这个昵称已经有人用了', 409)
        nextName = name
      }

      if (Array.isArray(body.shownTitles)) {
        const owned = me.titles ?? []
        const picked = (body.shownTitles as unknown[])
          .filter((t): t is string => typeof t === 'string')
          .filter((t) => owned.includes(t))
          .slice(0, MAX_SHOWN)
        if (picked.length === 0) return fail('至少要选一个称号')
        await db
          .prepare('UPDATE users SET shown_titles = ? WHERE id = ?')
          .bind(JSON.stringify(picked), me.id)
          .run()
      }

      let nextAvatar = me.avatar
      if (body.avatar !== undefined) {
        if (body.avatar === null || body.avatar === '') {
          nextAvatar = null
        } else if (typeof body.avatar === 'string' && body.avatar.length <= 200_000) {
          const value = body.avatar.trim()
          const isUrl = /^(https?:\/\/|\/)/.test(value)
          const isUpload = /^data:image\/(png|jpeg|jpg|webp);base64,/.test(value)
          if (!isUrl && !isUpload) {
            return fail('头像要填图片地址，或者直接上传一张图')
          }
          nextAvatar = value
        } else {
          return fail('头像地址太长')
        }
      }

      await db
        .prepare('UPDATE users SET name = ?, avatar = ? WHERE id = ?')
        .bind(nextName, nextAvatar, me.id)
        .run()
      return ok({ user: { ...me, name: nextName, avatar: nextAvatar } })
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

    /* ---------- 论坛 ---------- */

    const POST_MAX = 500
    const MAX_IMAGES = 3
    const MAX_IMAGE_CHARS = 220_000

    // 帖子列表
    if (path === '/posts' && method === 'GET') {
      const limit = Math.min(30, Math.max(1, Number(url.searchParams.get('limit')) || 20))
      const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0)
      const onlyUser = url.searchParams.get('userId') ?? ''

      const rows = await db
        .prepare(
          `SELECT p.id, p.body, p.created_at, p.views, p.pinned, p.user_id,
                  u.name AS author, u.avatar, u.uid, u.role, u.title, u.titles, u.shown_titles,
                  (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS likes,
                  (SELECT COUNT(*) FROM comments c WHERE c.target_type = 'post'
                     AND c.target_id = p.id AND c.status = 'published') AS comments
           FROM posts p JOIN users u ON u.id = p.user_id
           WHERE p.status = 'published' AND (? = '' OR p.user_id = ?)
           ORDER BY p.pinned DESC, p.created_at DESC
           LIMIT ? OFFSET ?`,
        )
        .bind(onlyUser, onlyUser, limit, offset)
        .all<Record<string, unknown>>()

      const ids = rows.map((r) => String(r.id))
      const images = ids.length
        ? await db
            .prepare(
              `SELECT id, post_id FROM post_images WHERE post_id IN (${ids.map(() => '?').join(',')})`,
            )
            .bind(...ids)
            .all<{ id: string; post_id: string }>()
        : []
      const imageMap = new Map<string, string[]>()
      for (const img of images) {
        const list = imageMap.get(img.post_id) ?? []
        list.push(img.id)
        imageMap.set(img.post_id, list)
      }

      const liked = me
        ? await db
            .prepare('SELECT post_id FROM post_likes WHERE user_id = ?')
            .bind(me.id)
            .all<{ post_id: string }>()
        : []
      const likedSet = new Set(liked.map((l) => l.post_id))

      const followed = me
        ? await db
            .prepare('SELECT followee_id FROM follows WHERE follower_id = ?')
            .bind(me.id)
            .all<{ followee_id: string }>()
        : []
      const followedSet = new Set(followed.map((f) => f.followee_id))

      return ok({
        posts: rows.map((r) => ({
          id: r.id,
          body: r.body,
          createdAt: r.created_at,
          views: Number(r.views ?? 0),
          author: r.author,
          avatar: (r.avatar as string | null) ?? null,
          uid: formatUid(r.uid as number | null),
          authorId: r.user_id,
          title: (r.title as string | null) ?? null,
          badge: shortBadge(r.role as string, r.uid as number | null),
          badgeKind: badgeKind(r.role as string, r.uid as number | null),
          label:
            parseShown(
              r.shown_titles as string | null,
              r.titles as string | null,
              r.title as string | null,
            ).join(' · ') || describeUid(r.uid as number | null).label,
          likes: Number(r.likes ?? 0),
          comments: Number(r.comments ?? 0),
          pinned: r.pinned === 1,
          liked: likedSet.has(String(r.id)),
          following: followedSet.has(String(r.user_id)),
          mine: me?.id === r.user_id,
          images: imageMap.get(String(r.id)) ?? [],
        })),
      })
    }

    // 发帖
    if (path === '/posts' && method === 'POST') {
      if (!me) return fail('登录后才能发帖', 401)
      if (!me.verified) return fail('需要认证后才能发帖', 403)
      if (tooFast(`post:${me.id}`, 5, 86_400_000)) {
        return fail('今天发的有点多了，明天再来', 429)
      }
      const body = await readJson(request)
      if (!body) return fail('请求格式不对')
      const text = typeof body.body === 'string' ? body.body.trim() : ''
      if (!text) return fail('写点什么吧')
      if (text.length > POST_MAX) return fail(`最多 ${POST_MAX} 个字`)

      const images = Array.isArray(body.images) ? (body.images as unknown[]) : []
      const clean = images
        .filter((x): x is string => typeof x === 'string')
        .filter((x) => /^data:image\/(png|jpeg|jpg|webp);base64,/.test(x))
        .slice(0, MAX_IMAGES)
      if (clean.some((x) => x.length > MAX_IMAGE_CHARS)) {
        return fail('图片有点大，换一张小一点的')
      }

      const id = randomHex(8)
      await db
        .prepare('INSERT INTO posts (id, user_id, body, created_at) VALUES (?, ?, ?, ?)')
        .bind(id, me.id, text, nowIso())
        .run()
      for (const data of clean) {
        await db
          .prepare('INSERT INTO post_images (id, post_id, data, created_at) VALUES (?, ?, ?, ?)')
          .bind(randomHex(8), id, data, nowIso())
          .run()
      }
      return ok({ id })
    }

    // 单帖详情（顺便加浏览量）
    const postOne = /^\/posts\/([a-z0-9]+)$/.exec(path)
    if (postOne && method === 'GET') {
      const row = await db
        .prepare(
          `SELECT p.id, p.body, p.created_at, p.views, p.pinned, p.user_id,
                  u.name AS author, u.avatar, u.uid, u.title, u.titles, u.shown_titles
           FROM posts p JOIN users u ON u.id = p.user_id
           WHERE p.id = ? AND p.status = 'published'`,
        )
        .bind(postOne[1])
        .first<Record<string, unknown>>()
      if (!row) return fail('帖子不在了', 404)

      if (!me || me.id !== row.user_id) {
        await db.prepare('UPDATE posts SET views = views + 1 WHERE id = ?').bind(row.id).run()
      }

      const images = await db
        .prepare('SELECT id FROM post_images WHERE post_id = ?')
        .bind(row.id)
        .all<{ id: string }>()
      const likes = await db
        .prepare('SELECT COUNT(*) AS n FROM post_likes WHERE post_id = ?')
        .bind(row.id)
        .first<{ n: number }>()
      const liked = me
        ? await db
            .prepare('SELECT 1 AS x FROM post_likes WHERE post_id = ? AND user_id = ?')
            .bind(row.id, me.id)
            .first<{ x: number }>()
        : null
      const following = me
        ? await db
            .prepare('SELECT 1 AS x FROM follows WHERE follower_id = ? AND followee_id = ?')
            .bind(me.id, row.user_id)
            .first<{ x: number }>()
        : null

      return ok({
        post: {
          id: row.id,
          body: row.body,
          createdAt: row.created_at,
          views: Number(row.views ?? 0) + (me && me.id === row.user_id ? 0 : 0),
          author: row.author,
          avatar: (row.avatar as string | null) ?? null,
          uid: formatUid(row.uid as number | null),
          authorId: row.user_id,
          badge: shortBadge(row.role as string, row.uid as number | null),
          badgeKind: badgeKind(row.role as string, row.uid as number | null),
          label:
            parseShown(
              row.shown_titles as string | null,
              row.titles as string | null,
              row.title as string | null,
            ).join(' · ') || describeUid(row.uid as number | null).label,
          likes: Number(likes?.n ?? 0),
          liked: Boolean(liked),
          following: Boolean(following),
          mine: me?.id === row.user_id,
          images: images.map((i) => i.id),
        },
      })
    }

    // 删帖
    if (postOne && method === 'DELETE') {
      if (!me) return fail('未登录', 401)
      const row = await db
        .prepare('SELECT user_id FROM posts WHERE id = ?')
        .bind(postOne[1])
        .first<{ user_id: string }>()
      if (!row) return fail('帖子不在了', 404)
      const admin = me.role === 'admin' || me.role === 'superadmin'
      if (row.user_id !== me.id && !admin) return fail('只能删自己的帖子', 403)
      await db.prepare('DELETE FROM posts WHERE id = ?').bind(postOne[1]).run()
      await db.prepare('DELETE FROM post_images WHERE post_id = ?').bind(postOne[1]).run()
      await db.prepare('DELETE FROM post_likes WHERE post_id = ?').bind(postOne[1]).run()
      await db
        .prepare("DELETE FROM comments WHERE target_type = 'post' AND target_id = ?")
        .bind(postOne[1])
        .run()
      return ok()
    }

    const pinPost = /^\/posts\/([a-z0-9]+)\/pin$/.exec(path)
    if (pinPost && method === 'POST') {
      if (!me) return fail('未登录', 401)
      if (me.role !== 'admin' && me.role !== 'superadmin') return fail('只有管理员能置顶', 403)
      const body = await readJson(request)
      if (!body) return fail('请求格式不对')
      await db
        .prepare('UPDATE posts SET pinned = ? WHERE id = ?')
        .bind(body.pinned ? 1 : 0, pinPost[1])
        .run()
      return ok()
    }

    // 点赞
    const likePost = /^\/posts\/([a-z0-9]+)\/like$/.exec(path)
    if (likePost && method === 'POST') {
      if (!me) return fail('登录后才能点赞', 401)
      if (tooFast(`plike:${me.id}`, 20, 20_000)) return fail('请勿频繁点击', 429)
      const exists = await db
        .prepare('SELECT 1 AS x FROM posts WHERE id = ?')
        .bind(likePost[1])
        .first<{ x: number }>()
      if (!exists) return fail('帖子不在了', 404)

      const liked = await db
        .prepare('SELECT 1 AS x FROM post_likes WHERE post_id = ? AND user_id = ?')
        .bind(likePost[1], me.id)
        .first<{ x: number }>()
      if (liked) {
        await db
          .prepare('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?')
          .bind(likePost[1], me.id)
          .run()
      } else {
        await db
          .prepare('INSERT INTO post_likes (post_id, user_id, created_at) VALUES (?, ?, ?)')
          .bind(likePost[1], me.id, nowIso())
          .run()
      }
      const count = await db
        .prepare('SELECT COUNT(*) AS n FROM post_likes WHERE post_id = ?')
        .bind(likePost[1])
        .first<{ n: number }>()
      return ok({ liked: !liked, likes: Number(count?.n ?? 0) })
    }

    // 图片
    const mediaOne = /^\/media\/([a-z0-9]+)$/.exec(path)
    if (mediaOne && method === 'GET') {
      const row = await db
        .prepare('SELECT data FROM post_images WHERE id = ?')
        .bind(mediaOne[1])
        .first<{ data: string }>()
      if (!row) return fail('图片不在了', 404)
      const match = /^data:(image\/[a-z]+);base64,(.+)$/.exec(row.data)
      if (!match) return fail('图片格式不对', 500)
      const binary = Uint8Array.from(atob(match[2]), (ch) => ch.charCodeAt(0))
      return new Response(binary, {
        headers: {
          'content-type': match[1],
          'cache-control': 'public, max-age=604800, immutable',
        },
      })
    }

    // 关注
    const followOne = /^\/follows\/([a-z0-9]+)$/.exec(path)
    if (followOne && method === 'POST') {
      if (!me) return fail('登录后才能关注', 401)
      const targetId = followOne[1]
      if (targetId === me.id) return fail('不能关注自己', 400)
      const target = await db
        .prepare('SELECT id FROM users WHERE id = ?')
        .bind(targetId)
        .first<{ id: string }>()
      if (!target) return fail('找不到这个人', 404)

      const body = await readJson(request)
      const action = String(body?.action ?? '')
      if (action === 'unfollow') {
        await db
          .prepare('DELETE FROM follows WHERE follower_id = ? AND followee_id = ?')
          .bind(me.id, targetId)
          .run()
        return ok({ following: false })
      }

      await db
        .prepare(
          'INSERT INTO follows (follower_id, followee_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
        )
        .bind(me.id, targetId, nowIso())
        .run()
      await db
        .prepare(
          `INSERT INTO notifications (id, user_id, type, actor_name, body, created_at)
           VALUES (?, ?, 'follow', ?, ?, ?)`,
        )
        .bind(randomHex(8), targetId, me.name, '关注了你', nowIso())
        .run()
      return ok({ following: true })
    }

    /* ---------- 评论 ---------- */

    if (path === '/comments' && method === 'GET') {
      const targetType = url.searchParams.get('targetType') ?? ''
      const targetId = url.searchParams.get('targetId') ?? ''
      if (!TARGET_TYPES.has(targetType) || !targetId) return fail('参数不对')

      const rows = await db
        .prepare(
          `SELECT c.id, c.body, c.created_at, c.user_id, c.parent_id, c.pinned,
                  c.reply_to_name, u.name AS author, u.avatar, u.uid
           FROM comments c JOIN users u ON u.id = c.user_id
           WHERE c.target_type = ? AND c.target_id = ? AND c.status = 'published'
           ORDER BY c.created_at ASC`,
        )
        .bind(targetType, targetId)
        .all<{
          id: string
          body: string
          created_at: string
          user_id: string
          parent_id: string | null
          pinned: number
          reply_to_name: string | null
          author: string
          avatar: string | null
          uid: number | null
        }>()

      const likes = await db
        .prepare(
          `SELECT r.target_id, COUNT(*) AS n
           FROM reactions r JOIN comments c ON c.id = r.target_id
           WHERE r.target_type = 'comment' AND c.target_type = ? AND c.target_id = ?
           GROUP BY r.target_id`,
        )
        .bind(targetType, targetId)
        .all<{ target_id: string; n: number }>()
      const likeMap = new Map(likes.map((l) => [l.target_id, Number(l.n)]))

      const mineLikes = me
        ? await db
            .prepare(
              `SELECT r.target_id FROM reactions r JOIN comments c ON c.id = r.target_id
               WHERE r.target_type = 'comment' AND r.user_id = ?
                 AND c.target_type = ? AND c.target_id = ?`,
            )
            .bind(me.id, targetType, targetId)
            .all<{ target_id: string }>()
        : []
      const likedSet = new Set(mineLikes.map((r) => r.target_id))

      const shape = (r: (typeof rows)[number]) => ({
        id: r.id,
        body: r.body,
        createdAt: r.created_at,
        author: r.author,
        avatar: r.avatar ?? null,
        uid: formatUid(r.uid),
        mine: me?.id === r.user_id,
        pinned: r.pinned === 1,
        likes: likeMap.get(r.id) ?? 0,
        liked: likedSet.has(r.id),
        parentId: r.parent_id ?? null,
        replyToName: r.reply_to_name ?? null,
      })

      // 楼中楼：顶层评论带 replies
      const tops = rows.filter((r) => !r.parent_id)
      const repliesByParent = new Map<string, ReturnType<typeof shape>[]>()
      for (const r of rows) {
        if (!r.parent_id) continue
        const list = repliesByParent.get(r.parent_id) ?? []
        list.push(shape(r))
        repliesByParent.set(r.parent_id, list)
      }

      const comments = tops
        .map((r) => ({ ...shape(r), replies: repliesByParent.get(r.id) ?? [] }))
        .sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
          return b.createdAt.localeCompare(a.createdAt)
        })

      const moderation = await getSetting(db, 'comment_moderation', 'on')
      return ok({ comments, me: me ?? null, moderation })
    }

    if (path === '/comments' && method === 'POST') {
      if (me && tooFast(`comment:${me.id}`, 5, 60_000)) {
        return fail('请勿频繁点击', 429)
      }
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
      const parentId = typeof body.parentId === 'string' ? body.parentId.trim() : ''
      let rootId: string | null = null
      let replyTo: { user_id: string; name: string } | null = null

      if (parentId) {
        const parent = await db
          .prepare(
            `SELECT c.id, c.parent_id, c.user_id, c.target_type, c.target_id, u.name
             FROM comments c JOIN users u ON u.id = c.user_id
             WHERE c.id = ?`,
          )
          .bind(parentId)
          .first<{
            id: string
            parent_id: string | null
            user_id: string
            target_type: string
            target_id: string
            name: string
          }>()
        if (!parent) return fail('要回复的评论不在了', 404)
        if (parent.target_type !== targetType || parent.target_id !== targetId) {
          return fail('参数不对')
        }
        rootId = parent.parent_id ?? parent.id
        replyTo = { user_id: parent.user_id, name: parent.name }
      }

      const id = randomHex(8)
      await db
        .prepare(
          'INSERT INTO comments (id, target_type, target_id, user_id, body, status, parent_id, reply_to_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(id, targetType, targetId, me.id, text, status, rootId, replyTo?.name ?? null, nowIso())
        .run()

      // 回复通知：通知被回复的人（不通知自己）
      if (replyTo && replyTo.user_id !== me.id) {
        await db
          .prepare(
            `INSERT INTO notifications (id, user_id, type, comment_id, target_type, target_id, actor_name, body, created_at)
             VALUES (?, ?, 'reply', ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            randomHex(8),
            replyTo.user_id,
            id,
            targetType,
            targetId,
            me.name,
            text.slice(0, 60),
            nowIso(),
          )
          .run()
      }

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
      if (row.user_id !== me.id && me.role !== 'admin' && me.role !== 'superadmin') {
        return fail('只能删自己的评论', 403)
      }
      await db.prepare('DELETE FROM comments WHERE parent_id = ?').bind(id).run()
      await db.prepare('DELETE FROM comments WHERE id = ?').bind(id).run()
      await db.prepare('DELETE FROM notifications WHERE comment_id = ?').bind(id).run()
      await db
        .prepare("DELETE FROM reactions WHERE target_type = 'comment' AND target_id = ?")
        .bind(id)
        .run()
      return ok()
    }

    const pinComment = /^\/comments\/([a-z0-9]+)\/pin$/.exec(path)
    if (pinComment && method === 'POST') {
      if (!me) return fail('未登录', 401)
      if (me.role !== 'admin' && me.role !== 'superadmin') {
        return fail('只有管理员能置顶', 403)
      }
      const body = await readJson(request)
      if (!body) return fail('请求格式不对')
      const pinned = body.pinned ? 1 : 0
      await db.prepare('UPDATE comments SET pinned = ? WHERE id = ?').bind(pinned, pinComment[1]).run()
      return ok()
    }

    const likeComment = /^\/comments\/([a-z0-9]+)\/like$/.exec(path)
    if (likeComment && method === 'POST') {
      if (!me) return fail('登录后才能点赞', 401)
      if (tooFast(`clike:${me.id}`, 20, 20_000)) return fail('请勿频繁点击', 429)
      const id = likeComment[1]
      const exists = await db
        .prepare('SELECT 1 AS x FROM comments WHERE id = ?')
        .bind(id)
        .first<{ x: number }>()
      if (!exists) return fail('找不到这条评论', 404)

      const liked = await db
        .prepare(
          "SELECT 1 AS x FROM reactions WHERE user_id = ? AND target_type = 'comment' AND target_id = ?",
        )
        .bind(me.id, id)
        .first<{ x: number }>()

      if (liked) {
        await db
          .prepare(
            "DELETE FROM reactions WHERE user_id = ? AND target_type = 'comment' AND target_id = ?",
          )
          .bind(me.id, id)
          .run()
      } else {
        await db
          .prepare(
            "INSERT INTO reactions (user_id, target_type, target_id, created_at) VALUES (?, 'comment', ?, ?)",
          )
          .bind(me.id, id, nowIso())
          .run()
      }

      const count = await db
        .prepare("SELECT COUNT(*) AS n FROM reactions WHERE target_type = 'comment' AND target_id = ?")
        .bind(id)
        .first<{ n: number }>()
      return ok({ liked: !liked, likes: Number(count?.n ?? 0) })
    }

    /* ---------- 回复通知 ---------- */

    if (path === '/notifications' && method === 'GET') {
      if (!me) return fail('未登录', 401)
      const rows = await db
        .prepare(
          `SELECT id, type, comment_id, target_type, target_id, actor_name, body, created_at, read_at
           FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
        )
        .bind(me.id)
        .all<{
          id: string
          type: string
          comment_id: string | null
          target_type: string | null
          target_id: string | null
          actor_name: string | null
          body: string | null
          created_at: string
          read_at: string | null
        }>()
      return ok({
        notifications: rows.map((r) => ({
          id: r.id,
          type: r.type,
          commentId: r.comment_id,
          targetType: r.target_type,
          targetId: r.target_id,
          actorName: r.actor_name ?? '',
          body: r.body ?? '',
          createdAt: r.created_at,
          read: Boolean(r.read_at),
        })),
        unread: rows.filter((r) => !r.read_at).length,
      })
    }

    if (path === '/notifications/read' && method === 'POST') {
      if (!me) return fail('未登录', 401)
      await db
        .prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL')
        .bind(nowIso(), me.id)
        .run()
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
      if (tooFast(`like:${me.id}`, 12, 20_000)) {
        return fail('请勿频繁点击', 429)
      }
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

    const isAdmin = me?.role === 'admin' || me?.role === 'superadmin'

    if (path.startsWith('/admin/') && !isAdmin) {
      return me ? fail('没有权限', 403) : fail('未登录', 401)
    }

    const need = (perm: AdminPerm) => {
      if (can(me, perm)) return null
      return fail('没有这个权限', 403)
    }

    if (path === '/admin/publish' && method === 'POST') {
      const denied = need('content')
      if (denied) return denied
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
      const denied = need('keys')
      if (denied) return denied
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
          spec: r.spec ?? null,
          specLabel: specLabelOf(r.spec),
          note: r.note,
          createdAt: r.created_at,
          usedAt: r.used_at,
          usedBy: r.used_by_name ?? null,
          expiresAt: r.expires_at,
        })),
      })
    }

    if (path === '/admin/keys' && method === 'POST') {
      const denied = need('keys')
      if (denied) return denied
      const body = await readJson(request)
      if (!body) return fail('请求格式不对')
      let kind = 'member'
      let specJson = ''
      if (body.kind === 'admin') {
        if (me!.role !== 'superadmin') return fail('没有权限发放管理员密钥', 403)
        const perms = Array.isArray(body.perms)
          ? (body.perms as unknown[]).filter((p): p is AdminPerm =>
              ALL_PERMS.includes(p as AdminPerm),
            )
          : []
        if (perms.length === 0) return fail('至少要给一项权限')
        kind = 'admin'
        specJson = JSON.stringify({ kind: 'admin', perms })
      } else {
        const spec =
          normaliseSpec({
            kind: body.kind,
            role: body.role,
            season: body.season,
            grade: body.grade,
            klass: body.klass,
            memberId: body.memberId,
            memberName: body.memberName,
          }) ?? { kind: 'member', grade: 0, klass: 0 }
        kind = spec.kind
        specJson = JSON.stringify(spec)
      }
      const count = Math.min(50, Math.max(1, Number(body.count) || 1))
      const days = Math.min(365, Math.max(1, Number(body.expiresInDays) || 30))
      const note = typeof body.note === 'string' ? body.note.slice(0, 40) : ''
      const keys = await issueKeys(db, kind, specJson, count, days, note, me!.id)
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
      const denied = need('comments')
      if (denied) return denied
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
      const denied = need('comments')
      if (denied) return denied
      const body = await readJson(request)
      if (!body) return fail('请求格式不对')
      const status = String(body.status ?? '')
      if (status === 'delete') {
        await db.prepare('DELETE FROM comments WHERE id = ?').bind(moderate[1]).run()
        return ok()
      }
      if (!['published', 'hidden', 'pending'].includes(status)) return fail('参数不对')
      await db
        .prepare('UPDATE comments SET status = ? WHERE id = ?')
        .bind(status, moderate[1])
        .run()
      return ok()
    }

    if (path === '/admin/users' && method === 'GET') {
      const denied = need('users')
      if (denied) return denied
      const rows = await db
        .prepare(
          `SELECT u.id, u.uid, u.name, u.avatar, u.title, u.titles, u.shown_titles, u.role, u.verified, u.created_at,
                  k.code AS key_code
           FROM users u
           LEFT JOIN activation_keys k ON k.used_by = u.id
           ORDER BY u.uid ASC`,
        )
        .all<Record<string, unknown>>()
      return ok({
        users: rows.map((r) => ({
          id: r.id,
          uid: formatUid(r.uid as number | null),
          name: r.name,
          avatar: (r.avatar as string | null) ?? null,
          role: r.role,
          verified: r.verified === 1,
          label: (r.title as string | null) || describeUid(r.uid as number | null).label,
          title: (r.title as string | null) ?? null,
          titles: parseTitles(r.titles as string | null, r.title as string | null),
          shownTitles: parseShown(
            r.shown_titles as string | null,
            r.titles as string | null,
            r.title as string | null,
          ),
          memberId: (r.member_id as string | null) ?? null,
          keyCode: (r.key_code as string | null) ?? null,
          createdAt: r.created_at,
        })),
      })
    }

    const patchUser = /^\/admin\/users\/([a-z0-9]+)$/.exec(path)
    if (patchUser && method === 'POST') {
      const body = await readJson(request)
      if (!body) return fail('请求格式不对')
      const target = await db
        .prepare('SELECT * FROM users WHERE id = ?')
        .bind(patchUser[1])
        .first<UserRow>()
      if (!target) return fail('找不到这个账号', 404)

      if (typeof body.name === 'string') {
        const name = cleanName(body.name)
        if (!name) return fail('昵称需要 2–12 个字符')
        const taken = await db
          .prepare('SELECT id FROM users WHERE name = ? AND id <> ?')
          .bind(name, target.id)
          .first<{ id: string }>()
        if (taken) return fail('这个昵称已经有人用了', 409)
        await db.prepare('UPDATE users SET name = ? WHERE id = ?').bind(name, target.id).run()
      }

      if (typeof body.password === 'string' && body.password.length > 0) {
        const password = cleanPassword(body.password)
        if (!password) return fail('新密码至少 6 位')
        const salt = randomHex(16)
        const hash = await hashPassword(password, salt)
        await db
          .prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?')
          .bind(hash, salt, target.id)
          .run()
      }

      if (typeof body.verified === 'boolean') {
        await db
          .prepare('UPDATE users SET verified = ? WHERE id = ?')
          .bind(body.verified ? 1 : 0, target.id)
          .run()
      }

      if (Array.isArray(body.titles)) {
        const list = (body.titles as unknown[])
          .map((t) => (typeof t === 'string' ? t.trim() : ''))
          .filter((t) => t.length > 0 && t.length <= 20)
          .slice(0, MAX_TITLES)
        const current = parseTitles(target.titles, target.title)
        // 展示列表里被删掉的称号要跟着清理
        const shownRaw = target.shown_titles
        let shown: string[] = []
        try {
          shown = shownRaw ? (JSON.parse(shownRaw) as string[]) : []
        } catch {
          shown = []
        }
        const stillShown = shown.filter((t) => list.includes(t))
        await db
          .prepare('UPDATE users SET titles = ?, shown_titles = ?, title = NULL WHERE id = ?')
          .bind(
            JSON.stringify(list),
            JSON.stringify(stillShown.length ? stillShown : list.slice(0, 1)),
            target.id,
          )
          .run()
        void current
      }

      if (body.memberId !== undefined) {
        if (me!.role !== 'superadmin' && !can(me, 'users')) {
          return fail('没有权限绑定成员', 403)
        }
        const next =
          body.memberId === null || body.memberId === ''
            ? null
            : String(body.memberId).slice(0, 64)
        if (next) {
          // 一个成员只允许绑一个账号
          await db
            .prepare('UPDATE users SET member_id = NULL WHERE member_id = ? AND id <> ?')
            .bind(next, target.id)
            .run()
        }
        await db
          .prepare('UPDATE users SET member_id = ? WHERE id = ?')
          .bind(next, target.id)
          .run()
      }

      if (Array.isArray(body.perms)) {
        if (me!.role !== 'superadmin') return fail('只有总管理员能改权限', 403)
        const perms = (body.perms as unknown[]).filter((p): p is AdminPerm =>
          ALL_PERMS.includes(p as AdminPerm),
        )
        await db
          .prepare('UPDATE users SET perms = ? WHERE id = ?')
          .bind(JSON.stringify(perms), target.id)
          .run()
      }
      return ok()
    }

    const deleteUser = /^\/admin\/users\/([a-z0-9]+)$/.exec(path)
    if (deleteUser && method === 'DELETE') {
      const denied = need('users')
      if (denied) return denied

      const target = await db
        .prepare('SELECT * FROM users WHERE id = ?')
        .bind(deleteUser[1])
        .first<UserRow>()
      if (!target) return fail('找不到这个账号', 404)
      if (target.id === me!.id) return fail('不能删除自己的账号', 400)
      if (target.role === 'superadmin') return fail('不能删除总管理员', 403)
      if (target.role === 'admin' && me!.role !== 'superadmin') {
        return fail('只有总管理员能删除管理员', 403)
      }

      // 不能把最后一个总管理员删掉（这里 target 已排除 superadmin，双保险）
      const supers = await db
        .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'superadmin'")
        .first<{ n: number }>()
      if (Number(supers?.n ?? 0) === 0) return fail('系统里至少要有一个总管理员', 400)

      // 连带清理：会话、评论、点赞；激活密钥释放出来
      await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(target.id).run()
      await db.prepare('DELETE FROM comments WHERE user_id = ?').bind(target.id).run()
      await db.prepare('DELETE FROM reactions WHERE user_id = ?').bind(target.id).run()
      await db
        .prepare('UPDATE activation_keys SET used_by = NULL, used_at = NULL WHERE used_by = ?')
        .bind(target.id)
        .run()
      await db.prepare('DELETE FROM users WHERE id = ?').bind(target.id).run()

      return ok({ deleted: target.id })
    }

    const changeUid = /^\/admin\/users\/([a-z0-9]+)\/uid$/.exec(path)
    if (changeUid && method === 'POST') {
      if (me!.role !== 'superadmin') return fail('只有总管理员能改编号', 403)
      const body = await readJson(request)
      if (!body) return fail('请求格式不对')
      const raw = Number(body.uid)
      if (!Number.isInteger(raw) || raw < 1 || raw > 99999) {
        return fail('编号要是 1–99999 的整数')
      }
      const taken = await db
        .prepare('SELECT id FROM users WHERE uid = ? AND id <> ?')
        .bind(raw, changeUid[1])
        .first<{ id: string }>()
      if (taken) return fail('这个编号已经被占用了', 409)
      const target = await db
        .prepare('SELECT id FROM users WHERE id = ?')
        .bind(changeUid[1])
        .first<{ id: string }>()
      if (!target) return fail('找不到这个账号', 404)
      await db.prepare('UPDATE users SET uid = ? WHERE id = ?').bind(raw, target.id).run()
      return ok({ uid: formatUid(raw) })
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
  kind: string,
  specJson: string,
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
        'INSERT INTO activation_keys (code, kind, spec, note, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(code, kind, specJson, note, createdBy, nowIso(), expires)
      .run()
    codes.push(code)
  }
  return codes
}


/** 把密钥里存的规格 JSON 转成一句说明 */
function specLabelOf(raw: unknown): string {
  if (typeof raw !== 'string' || !raw) return '认证密钥'
  try {
    return describeSpec(normaliseSpec(JSON.parse(raw)))
  } catch {
    return '认证密钥'
  }
}
