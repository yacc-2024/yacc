import type { CrewEvent } from '../data/schema'

const pad2 = (n: number) => String(n).padStart(2, '0')

/** 754 -> "12:34"；3671 -> "01:01:11" */
export function formatDuration(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec || 0))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${pad2(h)}:${pad2(m)}:${pad2(s)}`
  return `${pad2(m)}:${pad2(s)}`
}

/** "2026-11-18" -> "2026.11.18" */
export function formatDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!m) return isoDate
  return `${m[1]}.${m[2]}.${m[3]}`
}

/** "2026-11-18" -> "11/18" */
export function formatShortDate(isoDate: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!m) return isoDate
  return `${m[1]}/${m[2]}`
}

/** "2026-11-18" -> { month: "11月", day: "18" } */
export function formatDateBlock(isoDate: string): { month: string; day: string } {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!m) return { month: '', day: '' }
  return { month: `${Number(m[1])}月`, day: m[2] }
}

/** ISO -> "11月22日 14:00" */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const month = d.getMonth() + 1
  const day = d.getDate()
  return `${month}月${day}日 ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** ISO -> "14:00" */
export function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export type EventStatus = 'upcoming' | 'ongoing' | 'past'

export function eventStatus(ev: CrewEvent, now = new Date()): EventStatus {
  const start = new Date(ev.startAt).getTime()
  const end = new Date(ev.endAt).getTime()
  const t = now.getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) return 'past'
  if (t < start) return 'upcoming'
  if (t <= end) return 'ongoing'
  return 'past'
}

export function sortEvents<T extends CrewEvent>(events: T[], now = new Date()): T[] {
  const weight: Record<EventStatus, number> = { ongoing: 0, upcoming: 1, past: 2 }
  return [...events].sort((a, b) => {
    const wa = weight[eventStatus(a, now)]
    const wb = weight[eventStatus(b, now)]
    if (wa !== wb) return wa - wb
    const ta = new Date(a.startAt).getTime()
    const tb = new Date(b.startAt).getTime()
    return wa === 2 ? tb - ta : ta - tb
  })
}

export function sortAnnouncements<
  T extends { pinned: boolean; date: string },
>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return b.date.localeCompare(a.date)
  })
}

export function sortMembers<T extends { order: number; name: string }>(
  list: T[],
): T[] {
  return [...list].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
}

/** 今天/明天/周三 这样的一行提示 */
export function relativeDay(iso: string, now = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const startOf = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOf(d) - startOf(now)) / 86400_000)
  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '明天'
  if (diffDays === 2) return '后天'
  if (diffDays === -1) return '昨天'
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  if (diffDays > 0 && diffDays < 7) return names[d.getDay()]
  return formatShortDate(iso.slice(0, 10))
}

export function pluralCount(n: number, unit: string): string {
  return `${n} ${unit}`
}

/** "12:34" 或 "1:02:03" -> 秒 */
export function parseDuration(input: string): number | null {
  const t = input.trim()
  if (!t) return 0
  if (!/^\d{1,3}(:\d{1,2}){0,2}$/.test(t)) return null
  const parts = t.split(':').map((p) => Number(p))
  if (parts.some((p) => Number.isNaN(p))) return null
  if (parts.length === 1) return parts[0] * 60
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0] * 3600 + parts[1] * 60 + parts[2]
}

/** 秒 -> 编辑用 "12:34" */
export function durationToInput(sec: number): string {
  const total = Math.max(0, Math.round(sec || 0))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}


const CN_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']

/** 1 → 一，12 → 十二，20 → 二十 */
export function cnNum(n: number): string {
  const value = Math.round(n)
  if (!Number.isFinite(value) || value < 0) return String(n)
  if (value < 10) return CN_DIGITS[value]
  if (value < 20) return `十${value % 10 === 0 ? '' : CN_DIGITS[value % 10]}`
  if (value < 100) {
    const tens = Math.floor(value / 10)
    const ones = value % 10
    return `${CN_DIGITS[tens]}十${ones === 0 ? '' : CN_DIGITS[ones]}`
  }
  return String(value)
}


/** 刚刚 / 5 分钟前 / 3 小时前 / 昨天 / 11月20日 */
export function relativeTime(iso: string): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const diff = Date.now() - t
  const min = Math.floor(diff / 60_000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour} 小时前`
  const day = Math.floor(hour / 24)
  if (day === 1) return '昨天'
  if (day < 7) return `${day} 天前`
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}
