import type { Content, BackupFile, Platform } from './schema'
import { CURRENT_SCHEMA } from './schema'

export type ValidationResult =
  | { ok: true; data: Content }
  | { ok: false; errors: string[] }

export type BackupResult =
  | { ok: true; data: BackupFile }
  | { ok: false; errors: string[] }

const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_MEMBERS = 200
const MAX_EPISODES = 500
const MAX_EXTRAS = 200

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const ISO_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/
const BV_RE = /^BV[0-9A-Za-z]{10}$/
const YT_RE = /^[A-Za-z0-9_-]{11}$/
const INVITE_RE = /^[A-Za-z0-9]{4,16}$/

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function validDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return false
  return d.toISOString().slice(0, 10) === s
}

function validIso(s: string): boolean {
  if (!ISO_RE.test(s)) return false
  return !Number.isNaN(new Date(s).getTime())
}

class Bag {
  errors: string[] = []
  add(path: string, msg: string) {
    this.errors.push(`${path}: ${msg}`)
  }
  str(
    obj: Record<string, unknown>,
    key: string,
    path: string,
    opts: { min?: number; max?: number; pattern?: RegExp } = {},
  ): string {
    const v = obj[key]
    const p = `${path}.${key}`
    if (typeof v !== 'string') {
      this.add(p, '应为字符串')
      return ''
    }
    if (opts.min !== undefined && v.trim().length < opts.min) {
      this.add(p, `不能少于 ${opts.min} 个字符`)
    }
    if (opts.max !== undefined && v.length > opts.max) {
      this.add(p, `不能超过 ${opts.max} 个字符`)
    }
    if (opts.pattern && v.length > 0 && !opts.pattern.test(v)) {
      this.add(p, '格式不正确')
    }
    return v
  }
  num(obj: Record<string, unknown>, key: string, path: string): number {
    const v = obj[key]
    const p = `${path}.${key}`
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      this.add(p, '应为数字')
      return 0
    }
    return v
  }
  bool(obj: Record<string, unknown>, key: string, path: string): boolean {
    const v = obj[key]
    if (typeof v !== 'boolean') {
      this.add(`${path}.${key}`, '应为布尔值')
      return false
    }
    return v
  }
  /** string | null */
  nullableStr(
    obj: Record<string, unknown>,
    key: string,
    path: string,
  ): string | null {
    const v = obj[key]
    if (v === null || v === undefined) return null
    if (typeof v !== 'string') {
      this.add(`${path}.${key}`, '应为字符串或 null')
      return null
    }
    return v
  }
  arr(obj: Record<string, unknown>, key: string, path: string): unknown[] {
    const v = obj[key]
    if (!Array.isArray(v)) {
      this.add(`${path}.${key}`, '应为数组')
      return []
    }
    return v
  }
  obj(
    obj: Record<string, unknown>,
    key: string,
    path: string,
  ): Record<string, unknown> {
    const v = obj[key]
    if (!isRecord(v)) {
      this.add(`${path}.${key}`, '应为对象')
      return {}
    }
    return v
  }
  platform(obj: Record<string, unknown>, path: string): Platform {
    const v = obj.platform
    if (v !== 'bilibili' && v !== 'youtube') {
      this.add(`${path}.platform`, '应为 bilibili 或 youtube')
      return 'bilibili'
    }
    const id = obj.videoId
    const re = v === 'bilibili' ? BV_RE : YT_RE
    if (typeof id !== 'string' || !re.test(id)) {
      this.add(
        `${path}.videoId`,
        v === 'bilibili' ? '应为 BV 号（BV + 10 位）' : '应为 11 位 YouTube ID',
      )
    }
    return v
  }
}

export function validateContent(input: unknown): ValidationResult {
  if (!isRecord(input)) {
    return { ok: false, errors: ['root: 内容应为对象'] }
  }
  const b = new Bag()
  const root = input

  const sv = root.schemaVersion
  if (typeof sv !== 'number' || !Number.isInteger(sv) || sv < 1) {
    b.add('schemaVersion', '应为正整数')
  } else if (sv > CURRENT_SCHEMA) {
    b.add('schemaVersion', `版本 ${sv} 高于当前支持的 ${CURRENT_SCHEMA}`)
  }

  const updatedAt = root.updatedAt
  if (typeof updatedAt !== 'string' || !validIso(updatedAt)) {
    b.add('updatedAt', '应为带时区的 ISO 时间')
  }

  // ---- site ----
  const site = b.obj(root, 'site', 'root')
  b.str(site, 'name', 'site', { min: 1, max: 40 })
  b.str(site, 'fullName', 'site', { min: 1, max: 60 })
  b.str(site, 'school', 'site', { max: 80 })
  b.str(site, 'copyright', 'site', { max: 120 })
  b.str(site, 'inviteCode', 'site', {
    min: 4,
    max: 16,
    pattern: INVITE_RE,
  })

  // ---- home ----
  const home = b.obj(root, 'home', 'root')
  b.str(home, 'claim', 'home', { min: 1, max: 60 })
  b.str(home, 'intro', 'home', { max: 200 })
  b.arr(home, 'stats', 'home').forEach((s, i) => {
    if (!isRecord(s)) return b.add(`home.stats[${i}]`, '应为对象')
    b.str(s, 'value', `home.stats[${i}]`, { min: 1, max: 12 })
    b.str(s, 'label', `home.stats[${i}]`, { min: 1, max: 12 })
  })
  b.arr(home, 'featured', 'home').forEach((f, i) => {
    const p = `home.featured[${i}]`
    if (!isRecord(f)) return b.add(p, '应为对象')
    if (f.type !== 'episode' && f.type !== 'extra') {
      b.add(`${p}.type`, '应为 episode 或 extra')
    }
    b.str(f, 'id', p, { min: 1 })
  })

  // ---- about ----
  const about = b.obj(root, 'about', 'root')
  b.str(about, 'lead', 'about', { max: 800 })
  b.arr(about, 'figures', 'about').forEach((f, i) => {
    if (!isRecord(f)) return b.add(`about.figures[${i}]`, '应为对象')
    b.str(f, 'value', `about.figures[${i}]`, { min: 1, max: 12 })
    b.str(f, 'label', `about.figures[${i}]`, { min: 1, max: 40 })
  })
  const source = b.obj(about, 'source', 'about')
  b.str(source, 'text', 'about.source', { min: 1, max: 200 })
  b.str(source, 'note', 'about.source', { max: 60 })
  b.arr(about, 'timeline', 'about').forEach((t, i) => {
    const p = `about.timeline[${i}]`
    if (!isRecord(t)) return b.add(p, '应为对象')
    b.str(t, 'date', p, { min: 1, max: 20 })
    b.str(t, 'title', p, { min: 1, max: 40 })
    b.str(t, 'desc', p, { max: 200 })
  })

  // ---- roles ----
  b.arr(root, 'roles', 'root').forEach((r, i) => {
    if (typeof r !== 'string' || r.trim().length === 0) {
      b.add(`roles[${i}]`, '应为非空字符串')
    }
  })

  // ---- 集合 ----
  const members = b.arr(root, 'members', 'root')
  const seasons = b.arr(root, 'seasons', 'root')
  const episodes = b.arr(root, 'episodes', 'root')
  const extras = b.arr(root, 'extras', 'root')
  const announcements = b.arr(root, 'announcements', 'root')
  const events = b.arr(root, 'events', 'root')
  const changelog = b.arr(root, 'changelog', 'root')

  if (members.length > MAX_MEMBERS) b.add('members', `不能超过 ${MAX_MEMBERS} 条`)
  if (episodes.length > MAX_EPISODES)
    b.add('episodes', `不能超过 ${MAX_EPISODES} 条`)
  if (extras.length > MAX_EXTRAS) b.add('extras', `不能超过 ${MAX_EXTRAS} 条`)

  const memberIds = new Set<string>()
  members.forEach((m, i) => {
    const p = `members[${i}]`
    if (!isRecord(m)) return b.add(p, '应为对象')
    const id = b.str(m, 'id', p, { min: 1, max: 40 })
    if (id) {
      if (memberIds.has(id)) b.add(`${p}.id`, `ID 重复：${id}`)
      memberIds.add(id)
    }
    b.str(m, 'name', p, { min: 1, max: 20 })
    b.arr(m, 'roles', p).forEach((r, j) => {
      if (typeof r !== 'string' || !r.trim())
        b.add(`${p}.roles[${j}]`, '应为非空字符串')
    })
    b.arr(m, 'seasons', p).forEach((s, j) => {
      if (typeof s !== 'number' || !Number.isInteger(s) || s < 1)
        b.add(`${p}.seasons[${j}]`, '应为正整数季号')
    })
    b.str(m, 'bio', p, { max: 120 })
    b.nullableStr(m, 'avatar', p)
    b.str(m, 'joinedAt', p, { max: 20 })
    b.num(m, 'order', p)
  })

  const seasonIds = new Set<string>()
  seasons.forEach((s, i) => {
    const p = `seasons[${i}]`
    if (!isRecord(s)) return b.add(p, '应为对象')
    const id = b.str(s, 'id', p, { min: 1, max: 40 })
    if (id) {
      if (seasonIds.has(id)) b.add(`${p}.id`, `ID 重复：${id}`)
      seasonIds.add(id)
    }
    b.num(s, 'no', p)
    b.str(s, 'title', p, { min: 1, max: 40 })
    b.nullableStr(s, 'cover', p)
    b.str(s, 'synopsis', p, { max: 500 })
  })

  const episodeIds = new Set<string>()
  episodes.forEach((e, i) => {
    const p = `episodes[${i}]`
    if (!isRecord(e)) return b.add(p, '应为对象')
    const id = b.str(e, 'id', p, { min: 1, max: 40 })
    if (id) {
      if (episodeIds.has(id)) b.add(`${p}.id`, `ID 重复：${id}`)
      episodeIds.add(id)
    }
    const seasonId = b.str(e, 'seasonId', p, { min: 1 })
    if (seasonId && !seasonIds.has(seasonId)) {
      b.add(`${p}.seasonId`, `引用了不存在的季：${seasonId}`)
    }
    b.num(e, 'no', p)
    b.str(e, 'title', p, { min: 1, max: 60 })
    const dur = b.num(e, 'durationSec', p)
    if (dur < 0) b.add(`${p}.durationSec`, '不能为负数')
    const pub = b.str(e, 'publishedAt', p, { min: 1 })
    if (pub && !validDate(pub)) b.add(`${p}.publishedAt`, '应为 YYYY-MM-DD')
    b.platform(e, p)
    b.nullableStr(e, 'cover', p)
    b.str(e, 'description', p, { max: 2000 })
  })

  const extraIds = new Set<string>()
  extras.forEach((x, i) => {
    const p = `extras[${i}]`
    if (!isRecord(x)) return b.add(p, '应为对象')
    const id = b.str(x, 'id', p, { min: 1, max: 40 })
    if (id) {
      if (extraIds.has(id)) b.add(`${p}.id`, `ID 重复：${id}`)
      extraIds.add(id)
    }
    b.str(x, 'title', p, { min: 1, max: 60 })
    b.platform(x, p)
    const rel = b.nullableStr(x, 'relatedEpisodeId', p)
    if (rel && !episodeIds.has(rel)) {
      b.add(`${p}.relatedEpisodeId`, `引用了不存在的集：${rel}`)
    }
    b.nullableStr(x, 'cover', p)
    b.num(x, 'durationSec', p)
    const pub = b.str(x, 'publishedAt', p, { min: 1 })
    if (pub && !validDate(pub)) b.add(`${p}.publishedAt`, '应为 YYYY-MM-DD')
  })

  const annIds = new Set<string>()
  announcements.forEach((a, i) => {
    const p = `announcements[${i}]`
    if (!isRecord(a)) return b.add(p, '应为对象')
    const id = b.str(a, 'id', p, { min: 1, max: 40 })
    if (id) {
      if (annIds.has(id)) b.add(`${p}.id`, `ID 重复：${id}`)
      annIds.add(id)
    }
    b.str(a, 'title', p, { min: 1, max: 60 })
    b.str(a, 'body', p, { max: 2000 })
    const d = b.str(a, 'date', p, { min: 1 })
    if (d && !validDate(d)) b.add(`${p}.date`, '应为 YYYY-MM-DD')
    b.bool(a, 'pinned', p)
  })

  const eventIds = new Set<string>()
  events.forEach((ev, i) => {
    const p = `events[${i}]`
    if (!isRecord(ev)) return b.add(p, '应为对象')
    const id = b.str(ev, 'id', p, { min: 1, max: 40 })
    if (id) {
      if (eventIds.has(id)) b.add(`${p}.id`, `ID 重复：${id}`)
      eventIds.add(id)
    }
    b.str(ev, 'title', p, { min: 1, max: 60 })
    const start = b.str(ev, 'startAt', p, { min: 1 })
    const end = b.str(ev, 'endAt', p, { min: 1 })
    if (start && !validIso(start))
      b.add(`${p}.startAt`, '应为带时区的 ISO 时间')
    if (end && !validIso(end)) b.add(`${p}.endAt`, '应为带时区的 ISO 时间')
    if (start && end && validIso(start) && validIso(end)) {
      if (new Date(end).getTime() < new Date(start).getTime()) {
        b.add(`${p}.endAt`, '结束时间不能早于开始时间')
      }
    }
    b.str(ev, 'placePublic', p, { max: 80 })
    b.str(ev, 'placePrivate', p, { max: 120 })
    b.str(ev, 'mapQuery', p, { max: 120 })
    b.str(ev, 'note', p, { max: 300 })
  })

  changelog.forEach((c, i) => {
    const p = `changelog[${i}]`
    if (!isRecord(c)) return b.add(p, '应为对象')
    b.str(c, 'version', p, { min: 1, max: 20 })
    const d = b.str(c, 'date', p, { min: 1 })
    if (d && !validDate(d)) b.add(`${p}.date`, '应为 YYYY-MM-DD')
    b.arr(c, 'items', p).forEach((it, j) => {
      if (typeof it !== 'string')
        b.add(`${p}.items[${j}]`, '应为字符串')
    })
  })

  // ---- 引用完整性：featured ----
  b.arr(home, 'featured', 'home').forEach((f, i) => {
    if (!isRecord(f)) return
    const ref = f.id
    if (typeof ref !== 'string') return
    if (f.type === 'episode' && !episodeIds.has(ref)) {
      b.add(`home.featured[${i}].id`, `引用了不存在的集：${ref}`)
    }
    if (f.type === 'extra' && !extraIds.has(ref)) {
      b.add(`home.featured[${i}].id`, `引用了不存在的花絮：${ref}`)
    }
  })

  if (b.errors.length > 0) return { ok: false, errors: b.errors }
  return { ok: true, data: input as unknown as Content }
}

export function validateBackup(input: unknown): BackupResult {
  if (!isRecord(input)) {
    return { ok: false, errors: ['root: 备份应为对象'] }
  }
  const errors: string[] = []
  if (input.kind !== 'backup') {
    errors.push('kind: 这不是完整备份文件（kind 应为 backup）')
  }
  const contentResult = validateContent(input.content)
  if (!contentResult.ok) errors.push(...contentResult.errors)

  const accounts = input.accounts
  if (!Array.isArray(accounts)) {
    errors.push('accounts: 应为数组')
  } else {
    const seen = new Set<string>()
    accounts.forEach((a, i) => {
      const p = `accounts[${i}]`
      if (!isRecord(a)) return errors.push(`${p}: 应为对象`)
      if (typeof a.id !== 'string' || !a.id) errors.push(`${p}.id: 应为非空字符串`)
      else if (seen.has(a.id)) errors.push(`${p}.id: ID 重复：${a.id}`)
      else seen.add(a.id)
      if (typeof a.name !== 'string' || !a.name)
        errors.push(`${p}.name: 应为非空字符串`)
      if (typeof a.passwordHash !== 'string' || !a.passwordHash)
        errors.push(`${p}.passwordHash: 缺失`)
      if (typeof a.salt !== 'string' || !a.salt)
        errors.push(`${p}.salt: 缺失`)
      if (a.role !== 'admin' && a.role !== 'member')
        errors.push(`${p}.role: 应为 admin 或 member`)
    })
  }

  const favorites = input.favorites
  if (!Array.isArray(favorites)) {
    errors.push('favorites: 应为数组')
  } else {
    favorites.forEach((f, i) => {
      if (!isRecord(f)) return errors.push(`favorites[${i}]: 应为对象`)
      if (typeof f.id !== 'string') errors.push(`favorites[${i}].id: 缺失`)
      if (typeof f.type !== 'string') errors.push(`favorites[${i}].type: 缺失`)
      if (typeof f.at !== 'string') errors.push(`favorites[${i}].at: 缺失`)
    })
  }

  const history = input.history
  if (!Array.isArray(history)) {
    errors.push('history: 应为数组')
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, data: input as unknown as BackupFile }
}

/** 导入前的体积与结构检查（不解析内容） */
export function checkFileBudget(sizeBytes: number): string | null {
  if (sizeBytes > MAX_FILE_BYTES) {
    return `文件过大（${(sizeBytes / 1024 / 1024).toFixed(1)}MB），上限 5MB`
  }
  return null
}

export const LIMITS = {
  MAX_FILE_BYTES,
  MAX_MEMBERS,
  MAX_EPISODES,
  MAX_EXTRAS,
  DATE_RE,
  ISO_RE,
  BV_RE,
  YT_RE,
  INVITE_RE,
}
