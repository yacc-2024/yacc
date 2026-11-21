import type {
  Account,
  Content,
  FavRef,
  HistoryRef,
  BackupFile,
  ContentPack,
} from '../data/schema'
import { CURRENT_SCHEMA } from '../data/schema'
import { validateContent, validateBackup, checkFileBudget } from '../data/validate'
import { migrate, MigrationError } from '../data/migrate'

/** 固定键序，保证导出文件的 git diff 稳定可读 */
export function canonicalContent(c: Content): Content {
  return {
    schemaVersion: c.schemaVersion,
    updatedAt: c.updatedAt,
    site: {
      name: c.site.name,
      fullName: c.site.fullName,
      school: c.site.school,
      copyright: c.site.copyright,
      inviteCode: c.site.inviteCode,
    },
    home: {
      claim: c.home.claim,
      intro: c.home.intro,
      stats: c.home.stats.map((s) => ({ value: s.value, label: s.label })),
      featured: c.home.featured.map((f) => ({ type: f.type, id: f.id })),
    },
    about: {
      lead: c.about.lead,
      figures: c.about.figures.map((f) => ({ value: f.value, label: f.label })),
      source: { text: c.about.source.text, note: c.about.source.note },
      timeline: c.about.timeline.map((t) => ({
        date: t.date,
        title: t.title,
        desc: t.desc,
      })),
    },
    roles: [...c.roles],
    members: c.members.map((m) => ({
      id: m.id,
      name: m.name,
      roles: [...m.roles],
      seasons: [...m.seasons],
      bio: m.bio,
      avatar: m.avatar,
      joinedAt: m.joinedAt,
      order: m.order,
    })),
    seasons: c.seasons.map((s) => ({
      id: s.id,
      no: s.no,
      title: s.title,
      cover: s.cover,
      synopsis: s.synopsis,
    })),
    episodes: c.episodes.map((e) => ({
      id: e.id,
      seasonId: e.seasonId,
      no: e.no,
      title: e.title,
      durationSec: e.durationSec,
      publishedAt: e.publishedAt,
      platform: e.platform,
      videoId: e.videoId,
      cover: e.cover,
      description: e.description,
    })),
    extras: c.extras.map((x) => ({
      id: x.id,
      title: x.title,
      platform: x.platform,
      videoId: x.videoId,
      relatedEpisodeId: x.relatedEpisodeId,
      cover: x.cover,
      durationSec: x.durationSec,
      publishedAt: x.publishedAt,
    })),
    announcements: c.announcements.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      date: a.date,
      pinned: a.pinned,
    })),
    events: c.events.map((ev) => ({
      id: ev.id,
      title: ev.title,
      startAt: ev.startAt,
      endAt: ev.endAt,
      placePublic: ev.placePublic,
      placePrivate: ev.placePrivate,
      mapQuery: ev.mapQuery,
      note: ev.note,
    })),
    changelog: c.changelog.map((cl) => ({
      version: cl.version,
      date: cl.date,
      items: [...cl.items],
    })),
  }
}

export function buildContentPack(content: Content): ContentPack {
  return {
    kind: 'content',
    schemaVersion: CURRENT_SCHEMA,
    exportedAt: new Date().toISOString(),
    content: canonicalContent(content),
  }
}

export function buildBackup(
  content: Content,
  accounts: Account[],
  favorites: FavRef[],
  history: HistoryRef[],
): BackupFile {
  return {
    kind: 'backup',
    schemaVersion: CURRENT_SCHEMA,
    exportedAt: new Date().toISOString(),
    content: canonicalContent(content),
    accounts: accounts.map((a) => ({ ...a })),
    favorites: favorites.map((f) => ({ ...f })),
    history: history.map((h) => ({ ...h })),
  }
}

export function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

export function timestampSuffix(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(
    now.getHours(),
  )}${p(now.getMinutes())}`
}

export function fileName(prefix: 'content' | 'backup', now = new Date()): string {
  return `yacc-${prefix}-${timestampSuffix(now)}.json`
}

/** 触发浏览器下载；返回是否成功发起 */
export function downloadJson(name: string, text: string): boolean {
  try {
    if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') {
      return false
    }
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    return true
  } catch {
    return false
  }
}

export interface ImportPlan {
  kind: 'content' | 'backup'
  content: Content
  accounts: Account[]
  favorites: FavRef[]
  history: HistoryRef[]
  warnings: string[]
}

export type ImportResult =
  | { ok: true; plan: ImportPlan }
  | { ok: false; errors: string[] }

export function planImport(text: string, sizeBytes = text.length): ImportResult {
  const budget = checkFileBudget(sizeBytes)
  if (budget) return { ok: false, errors: [budget] }

  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, errors: ['文件不是有效的 JSON，可能已损坏'] }
  }
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, errors: ['文件内容不是一个对象'] }
  }
  const obj = raw as Record<string, unknown>

  // 完整备份
  if (obj.kind === 'backup') {
    const result = validateBackup(obj)
    if (!result.ok) return { ok: false, errors: result.errors }
    let content: Record<string, unknown>
    try {
      content = migrate(result.data.content)
    } catch (err) {
      const msg = err instanceof MigrationError ? err.message : '内容迁移失败'
      return { ok: false, errors: [msg] }
    }
    const checked = validateContent(content)
    if (!checked.ok) return { ok: false, errors: checked.errors }
    return {
      ok: true,
      plan: {
        kind: 'backup',
        content: checked.data,
        accounts: result.data.accounts,
        favorites: result.data.favorites,
        history: result.data.history,
        warnings: [],
      },
    }
  }

  // 内容包
  const payload =
    obj.kind === 'content' && obj.content && typeof obj.content === 'object'
      ? obj.content
      : obj

  let migrated: Record<string, unknown>
  try {
    migrated = migrate(payload)
  } catch (err) {
    const msg = err instanceof MigrationError ? err.message : '内容迁移失败'
    return { ok: false, errors: [msg] }
  }
  const checked = validateContent(migrated)
  if (!checked.ok) return { ok: false, errors: checked.errors }

  return {
    ok: true,
    plan: {
      kind: 'content',
      content: checked.data,
      accounts: [],
      favorites: [],
      history: [],
      warnings: ['这是内容包：只恢复展示内容，账号与收藏不会恢复'],
    },
  }
}
