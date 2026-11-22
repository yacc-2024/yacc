/** 身份 / 称号框：论坛、主页、我的页共用 */

export type BadgeKind = 'admin' | 'crew' | 'member' | 'guest'
export type BadgeStyle = 'auto' | 'crew' | 'member' | 'vip' | 'svip' | 'gold'

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

/** 后台可选的称号框 */
export const BADGE_STYLES: Array<{ value: BadgeStyle; label: string }> = [
  { value: 'auto', label: '跟随身份' },
  { value: 'crew', label: '剧组认证' },
  { value: 'member', label: '认证成员' },
  { value: 'vip', label: 'VIP' },
  { value: 'svip', label: 'SVIP' },
  { value: 'gold', label: '金标' },
]

export function Badge({
  kind,
  style,
  label,
}: {
  kind: BadgeKind
  style?: string | null
  label?: string
}) {
  const cls = style && style !== 'auto' ? style : kind
  // 认证类：蓝 V（剧组）/ 黄 V（学校认证）
  if (cls === 'crew' || cls === 'member') {
    return (
      <span className={`badge-v badge-v--${cls === 'crew' ? 'blue' : 'gold'}`}>
        <span className="badge-v__mark">V</span>
        <span>{label ?? badgeLabelOf(kind)}</span>
      </span>
    )
  }
  return (
    <span className={`svip svip--${cls}`}>
      {cls === 'admin' ? <span className="svip__star">★</span> : null}
      {cls === 'member' ? <span className="svip__check">✓</span> : null}
      {label ?? badgeLabelOf(kind)}
    </span>
  )
}
