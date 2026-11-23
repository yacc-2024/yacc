/** 身份 / 称号框：论坛、主页、我的页共用 */

export type BadgeKind = 'admin' | 'crew' | 'member' | 'guest'
export type BadgeStyle =
  | 'auto'
  | 'crew'
  | 'member'
  | 'vip'
  | 'svip'
  | 'gold'
  | 'emerald'
  | 'silver'
  | 'neon'
  | 'rosy'

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

/** 后台可选的称号框（用外观描述命名） */
export const BADGE_STYLES: Array<{ value: BadgeStyle; label: string }> = [
  { value: 'auto', label: '跟随身份' },
  { value: 'crew', label: '蓝底认证' },
  { value: 'member', label: '金底认证' },
  { value: 'vip', label: '紫粉渐变' },
  { value: 'svip', label: '黑金六边' },
  { value: 'gold', label: '金色丝带' },
  { value: 'emerald', label: '翡翠渐变' },
  { value: 'silver', label: '银灰渐变' },
  { value: 'neon', label: '霓虹渐变' },
  { value: 'rosy', label: '玫瑰渐变' },
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
        <span className="badge-v__mark" aria-hidden="true">
          <svg viewBox="0 0 12 12" width="8" height="8" style={{ transform: 'skewX(-9deg)' }}>
            <path
              d="M2.8 3.6 L6 8 L9.2 3.6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
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
