/** 身份徽章：论坛、主页、我的页共用同一套配色 */

export type BadgeKind = 'admin' | 'crew' | 'member' | 'guest'

export function badgeKindOf(
  role: string | undefined,
  uid: number | null | undefined,
  verified?: boolean,
): BadgeKind {
  if (role === 'admin' || role === 'superadmin') return 'admin'
  const code = String(uid ?? '').padStart(5, '0')
  if (code[0] === '1') return 'crew'
  if (code[0] === '2') return 'member'
  if (verified) return 'member'
  return 'guest'
}

export function badgeLabelOf(kind: BadgeKind): string {
  if (kind === 'admin') return '管理员'
  if (kind === 'crew') return '剧组成员'
  if (kind === 'member') return '认证成员'
  return '普通访客'
}

export function Badge({ kind, label }: { kind: BadgeKind; label?: string }) {
  return (
    <span className={`svip svip--${kind}`}>
      {kind === 'admin' ? <span className="svip__star">★</span> : null}
      {kind === 'crew' || kind === 'member' ? <span className="svip__check">✓</span> : null}
      {label ?? badgeLabelOf(kind)}
    </span>
  )
}
