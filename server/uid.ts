import type { DB } from './db'

/**
 * 五位数账号编号：
 *
 *   0xxxx  普通访客        后四位 = 生成顺序
 *   1abcc  剧组成员        a=身份(1导演 2编剧 3剪辑 4摄影 5演员) b=季(1/2/9=两季都参与) cc=顺序
 *   2abcc  认证成员        a=年级 b=班级 cc=顺序
 *
 * 数据库里存整数，展示时补足 5 位（如 1234 → 01234）。
 */

export type IdSpec =
  | { kind: 'guest' }
  | { kind: 'crew'; role: 1 | 2 | 3 | 4 | 5; season: 1 | 2 | 9 }
  | { kind: 'member'; grade: number; klass: number }

export const CREW_ROLES: Record<number, string> = {
  1: '导演',
  2: '编剧',
  3: '剪辑',
  4: '摄影',
  5: '演员',
}

export const SEASON_DIGIT: Record<number, string> = {
  1: '第一季',
  2: '第二季',
  9: '两季都参与',
}

export function formatUid(uid: number | null | undefined): string {
  if (uid === null || uid === undefined) return '—'
  return String(uid).padStart(5, '0')
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function normaliseSpec(raw: unknown): IdSpec | null {
  if (typeof raw !== 'object' || raw === null) return null
  const obj = raw as Record<string, unknown>
  if (obj.kind === 'guest') return { kind: 'guest' }
  if (obj.kind === 'crew') {
    const role = clamp(Number(obj.role), 1, 5) as 1 | 2 | 3 | 4 | 5
    const seasonRaw = Number(obj.season)
    const season = (seasonRaw === 2 ? 2 : seasonRaw === 9 ? 9 : 1) as 1 | 2 | 9
    return { kind: 'crew', role, season }
  }
  if (obj.kind === 'member') {
    return {
      kind: 'member',
      grade: clamp(Number(obj.grade), 0, 9),
      klass: clamp(Number(obj.klass), 0, 9),
    }
  }
  if (obj.kind === 'visitor') return { kind: 'member', grade: 0, klass: 0 }
  return null
}

/** 该编号段的起始值（10 位段） */
function prefixOf(spec: IdSpec): number {
  if (spec.kind === 'guest') return 0
  if (spec.kind === 'crew') return 10000 + spec.role * 1000 + spec.season * 100
  return 20000 + spec.grade * 1000 + spec.klass * 100
}

/** 分配一个编号：同段内按顺序 +1，满 99 则顺延到下一段之外（仍保证唯一） */
export async function allocateUid(db: DB, spec: IdSpec): Promise<number> {
  const prefix = prefixOf(spec)
  if (spec.kind === 'guest') {
    const row = await db
      .prepare('SELECT COALESCE(MAX(uid), 0) AS m FROM users WHERE uid < 10000')
      .first<{ m: number }>()
    return Number(row?.m ?? 0) + 1
  }
  const row = await db
    .prepare('SELECT COALESCE(MAX(uid), ?) AS m FROM users WHERE uid >= ? AND uid < ?')
    .bind(prefix, prefix, prefix + 100)
    .first<{ m: number }>()
  const max = Number(row?.m ?? prefix)
  return max < prefix ? prefix + 1 : max + 1
}

export interface UidSummary {
  /** 五位数编号 */
  code: string
  /** 一句话说明，如「剧组成员 · 编剧 · 第二季」 */
  label: string
}

export function describeUid(uid: number | null | undefined): UidSummary {
  const code = formatUid(uid)
  if (uid === null || uid === undefined) return { code, label: '未分配' }
  const digits = code.split('')
  const head = digits[0]
  if (head === '0') return { code, label: '普通访客' }
  if (head === '1') {
    const role = CREW_ROLES[Number(digits[1])]
    const season = SEASON_DIGIT[Number(digits[2])]
    return { code, label: ['剧组成员', role, season].filter(Boolean).join(' · ') }
  }
  if (head === '2') {
    const grade = Number(digits[1])
    const klass = Number(digits[2])
    if (grade === 0 && klass === 0) return { code, label: '认证成员' }
    return {
      code,
      label: `认证成员 · ${grade ? `${grade} 年级` : ''}${klass ? ` ${klass} 班` : ''}`.trim(),
    }
  }
  return { code, label: '' }
}


/** 给「密钥」用：把规格描述成人话 */
export function describeSpec(spec: IdSpec | null | undefined): string {
  if (!spec) return '认证密钥'
  if (spec.kind === 'guest') return '普通访客'
  if (spec.kind === 'crew') {
    return ['剧组成员', CREW_ROLES[spec.role], SEASON_DIGIT[spec.season]]
      .filter(Boolean)
      .join(' · ')
  }
  return `认证成员 · ${spec.grade} 年级${spec.klass ? ` ${spec.klass} 班` : ''}`
}
