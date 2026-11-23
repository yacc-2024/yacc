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
  | 'plain'

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

/** 后台可选的铭牌（用外观描述命名） */
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
  { value: 'plain', label: '普通铭牌' },
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
          <svg
            viewBox="0 0 12 12"
            width="10"
            height="10"
            style={{ transform: 'skewX(-14deg)', transformOrigin: 'center' }}
          >
            <path
              d="M3 3 L6 9 L9 3"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="butt"
              strokeLinejoin="miter"
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

/** 身份徽章 + 自定义称号铭牌，统一由这里渲染，避免各页面不一致 */
export function TitleBadges({
  role,
  uid,
  verified,
  badgeStyle,
  titleStyles,
  titles,
  shownTitles,
}: {
  role: string | undefined
  uid: number | null | undefined
  verified?: boolean
  badgeStyle?: string | null
  titleStyles?: Record<string, string> | null
  titles?: string[] | null
  shownTitles?: string[] | null
}) {
  const kind = badgeKindOf(role, uid, verified)
  const identityWords = new Set(['管理员', '剧组成员', '认证成员', '访问者', '普通访客', '访客'])
  const shown = (shownTitles ?? []).filter((t) => !identityWords.has(t))
  const extra = shown.length > 0 ? shown : (titles ?? []).filter((t) => !identityWords.has(t)).slice(0, 1)

  // 访客默认没有任何徽章；只有管理员明确给了他铭牌才显示
  const showIdentity = kind !== 'guest' || Boolean(badgeStyle)

  return (
    <>
      {showIdentity ? <Badge kind={kind} style={badgeStyle} /> : null}
      {extra.map((t) => (
        <Badge
          key={t}
          kind={kind}
          style={titleStyles?.[t] ?? badgeStyle}
          label={t}
        />
      ))}
    </>
  )
}
