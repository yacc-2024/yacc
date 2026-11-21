/** 五位账号编号的展示与解读（与 server/uid.ts 规则一致） */

const CREW_ROLES: Record<number, string> = {
  1: '导演',
  2: '编剧',
  3: '剪辑',
  4: '摄影',
  5: '演员',
}

export function formatUid(uid: number | null | undefined): string {
  if (uid === null || uid === undefined) return '—'
  return String(uid).padStart(5, '0')
}

export function uidTitle(
  uid: number | null | undefined,
  role: string | undefined,
  verified: boolean | undefined,
  customTitle?: string | null,
): string {
  if (customTitle && customTitle.trim()) return customTitle.trim()
  if (role === 'admin' || role === 'superadmin') return '管理员'
  if (!verified) return '访客'
  if (uid === null || uid === undefined) return '认证访客'
  const code = formatUid(uid)
  if (code[0] === '1') {
    const part = CREW_ROLES[Number(code[1])]
    return part ? `剧组成员 · ${part}` : '剧组成员'
  }
  if (code[0] === '2') {
    const grade = Number(code[1])
    const klass = Number(code[2])
    if (!grade && !klass) return '认证成员'
    return `认证成员 · ${grade ? `${grade}年级` : ''}${klass ? ` ${klass}班` : ''}`.trim()
  }
  return '认证访客'
}


/** 主页要展示的称号：优先用自己选的，没有就按编号推导 */
export function displayTitles(
  uid: number | null | undefined,
  role: string | undefined,
  verified: boolean | undefined,
  titles?: string[] | null,
  shownTitles?: string[] | null,
): string[] {
  if (shownTitles && shownTitles.length) return shownTitles.slice(0, 3)
  if (titles && titles.length) return titles.slice(0, 3)
  if (role === 'admin' || role === 'superadmin') return ['管理员']
  if (!verified) return ['访客']
  return [uidTitle(uid, role, verified)]
}
