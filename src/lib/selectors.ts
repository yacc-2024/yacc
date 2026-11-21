import type { Content, Episode, Extra, Member, Season } from '../data/schema'
import { cnNum } from './format'

export function findEpisode(content: Content, id: string): Episode | undefined {
  return content.episodes.find((e) => e.id === id)
}

export function findExtra(content: Content, id: string): Extra | undefined {
  return content.extras.find((x) => x.id === id)
}

export function findSeason(content: Content, id: string): Season | undefined {
  return content.seasons.find((s) => s.id === id)
}

export function findMember(content: Content, id: string): Member | undefined {
  return content.members.find((m) => m.id === id)
}

export function seasonsSorted(content: Content): Season[] {
  return [...content.seasons].sort((a, b) => a.no - b.no)
}

export function episodesOfSeason(content: Content, seasonId: string): Episode[] {
  return content.episodes
    .filter((e) => e.seasonId === seasonId)
    .sort((a, b) => a.no - b.no)
}

export function episodeBadge(content: Content, ep: Episode): string {
  const season = findSeason(content, ep.seasonId)
  const label = `第${cnNum(ep.no)}集`
  return season ? `${season.title} · ${label}` : label
}

export function extraBadge(content: Content, extra: Extra): string {
  if (!extra.relatedEpisodeId) return '花絮'
  const ep = findEpisode(content, extra.relatedEpisodeId)
  if (!ep) return '花絮'
  return `花絮 · ${episodeBadge(content, ep)}`
}

export interface FeaturedItem {
  key: string
  to: string
  title: string
  badge: string
  cover: string | null
}

export function featuredItems(content: Content): FeaturedItem[] {
  return content.home.featured
    .map((ref) => {
      if (ref.type === 'episode') {
        const ep = findEpisode(content, ref.id)
        if (!ep) return null
        return {
          key: `ep-${ep.id}`,
          to: `/watch/${ep.id}`,
          title: ep.title,
          badge: episodeBadge(content, ep),
          cover: ep.cover,
        }
      }
      const extra = findExtra(content, ref.id)
      if (!extra) return null
      return {
        key: `ex-${extra.id}`,
        to: `/watch/${extra.id}`,
        title: extra.title,
        badge: extraBadge(content, extra),
        cover: extra.cover,
      }
    })
    .filter((x): x is FeaturedItem => x !== null)
}

export function nextEpisode(content: Content, ep: Episode): Episode | undefined {
  const list = episodesOfSeason(content, ep.seasonId)
  const idx = list.findIndex((e) => e.id === ep.id)
  return idx >= 0 ? list[idx + 1] : undefined
}

/** 下一个播放目标：优先同季下一集，否则下一季第一集 */
export function nextInSeries(content: Content, ep: Episode): Episode | undefined {
  const same = nextEpisode(content, ep)
  if (same) return same
  const seasons = seasonsSorted(content)
  const cur = findSeason(content, ep.seasonId)
  if (!cur) return undefined
  const idx = seasons.findIndex((s) => s.id === cur.id)
  for (let i = idx + 1; i < seasons.length; i += 1) {
    const eps = episodesOfSeason(content, seasons[i].id)
    if (eps.length > 0) return eps[0]
  }
  return undefined
}

export function membersBySeason(content: Content, season: number): Member[] {
  return content.members.filter((m) => m.seasons.includes(season))
}

export function rolesOf(content: Content): string[] {
  const set = new Set<string>(content.roles)
  content.members.forEach((m) => m.roles.forEach((r) => set.add(r)))
  return Array.from(set)
}

/** 兼容旧数据：以内容里出现过的最大集号推算下一个集号 */
export function nextEpisodeNo(content: Content, seasonId: string): number {
  const list = episodesOfSeason(content, seasonId)
  return list.reduce((max, e) => Math.max(max, e.no), 0) + 1
}


/**
 * 最新一条更新日志。
 * 先按日期倒序；日期相同再按版本号倒序（1.0.10 > 1.0.9）。
 */
export function latestChangelog(
  list: Content['changelog'],
): Content['changelog'][number] | null {
  if (!list || list.length === 0) return null
  const compareVersion = (a: string, b: string) => {
    const pa = a.split('.').map((n) => Number(n) || 0)
    const pb = b.split('.').map((n) => Number(n) || 0)
    for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
      const d = (pa[i] ?? 0) - (pb[i] ?? 0)
      if (d !== 0) return d
    }
    return 0
  }
  return [...list].sort((a, b) => {
    const byDate = (b.date ?? '').localeCompare(a.date ?? '')
    if (byDate !== 0) return byDate
    return compareVersion(b.version, a.version)
  })[0]
}

/** 按时间倒序排好，最新的在最上面 */
export function sortedChangelog(list: Content['changelog']): Content['changelog'] {
  return [...list].sort((a, b) => {
    const byDate = (b.date ?? '').localeCompare(a.date ?? '')
    if (byDate !== 0) return byDate
    return b.version.localeCompare(a.version, undefined, { numeric: true })
  })
}
