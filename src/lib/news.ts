const SEEN_KEY = 'yacc:news-seen'

function readSeen(): string {
  try {
    return localStorage.getItem(SEEN_KEY) ?? ''
  } catch {
    return ''
  }
}

/** 记下「已经看到哪一天」的公告 */
export function markNewsSeen(latestDate: string): void {
  try {
    if (!latestDate) return
    if (readSeen() >= latestDate) return
    localStorage.setItem(SEEN_KEY, latestDate)
  } catch {
    /* 忽略 */
  }
}

/** 有没有比上次查看更新的公告 */
export function hasUnreadNews(latestDate: string): boolean {
  if (!latestDate) return false
  return latestDate > readSeen()
}
