/** 内容模型 · 规范见 PRD 4.1 */

export type Platform = 'bilibili' | 'youtube'

export interface Site {
  name: string
  fullName: string
  school: string
  copyright: string
  inviteCode: string
}

export interface StatItem {
  value: string
  label: string
}

export interface FeaturedRef {
  type: 'episode' | 'extra'
  id: string
}

export interface Home {
  claim: string
  intro: string
  stats: StatItem[]
  featured: FeaturedRef[]
}

export interface FigureItem {
  value: string
  label: string
}

export interface SourceRef {
  text: string
  note: string
}

export interface TimelineItem {
  date: string
  title: string
  desc: string
}

export interface About {
  lead: string
  figures: FigureItem[]
  source: SourceRef
  timeline: TimelineItem[]
}

export interface Member {
  id: string
  name: string
  roles: string[]
  seasons: number[]
  bio: string
  avatar: string | null
  joinedAt: string
  order: number
}

export interface Season {
  id: string
  no: number
  title: string
  cover: string | null
  synopsis: string
}

export interface Episode {
  id: string
  seasonId: string
  no: number
  title: string
  durationSec: number
  publishedAt: string
  platform: Platform
  videoId: string
  cover: string | null
  description: string
}

export interface Extra {
  id: string
  title: string
  platform: Platform
  videoId: string
  relatedEpisodeId: string | null
  cover: string | null
  durationSec: number
  publishedAt: string
}

export interface Announcement {
  id: string
  title: string
  body: string
  date: string
  pinned: boolean
}

export interface CrewEvent {
  id: string
  title: string
  startAt: string
  endAt: string
  placePublic: string
  placePrivate: string
  mapQuery: string
  note: string
}

export interface ChangelogEntry {
  version: string
  date: string
  items: string[]
}

export interface Content {
  schemaVersion: number
  updatedAt: string
  site: Site
  home: Home
  about: About
  roles: string[]
  members: Member[]
  seasons: Season[]
  episodes: Episode[]
  extras: Extra[]
  announcements: Announcement[]
  events: CrewEvent[]
  changelog: ChangelogEntry[]
}

export interface Account {
  id: string
  name: string
  passwordHash: string
  salt: string
  role: 'admin' | 'member'
  memberId: string | null
  createdAt: string
}

export interface Session {
  accountId: string
  expiresAt: string
}

export interface FavRef {
  type: 'episode' | 'extra' | 'season'
  id: string
  at: string
}

export interface HistoryRef {
  type: 'episode' | 'extra'
  id: string
  at: string
}

export interface Draft {
  content: Content
  updatedAt: string
  baseUpdatedAt: string
}

export const CURRENT_SCHEMA = 1

export const FAV_KEY = 'yacc:favorites'
export const HISTORY_KEY = 'yacc:history'
export const ACCOUNTS_KEY = 'yacc:accounts'
export const SESSION_KEY = 'yacc:session'
export const DRAFT_KEY = 'yacc:draft'
export const ROLLBACK_KEY = 'yacc:rollback'

export interface BackupFile {
  kind: 'backup'
  schemaVersion: number
  exportedAt: string
  content: Content
  accounts: Account[]
  favorites: FavRef[]
  history: HistoryRef[]
}

export interface ContentPack {
  kind: 'content'
  schemaVersion: number
  exportedAt: string
  content: Content
}
