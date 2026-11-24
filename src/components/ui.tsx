import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Icon, type IconName } from './Icon'

/* ---------------- TabBar ---------------- */

const TABS: Array<{ to: string; label: string; icon: IconName }> = [
  { to: '/', label: '主页', icon: 'home' },
  { to: '/members', label: '成员', icon: 'users' },
  { to: '/forum', label: '论坛', icon: 'message' },
  { to: '/works', label: '作品', icon: 'film' },
  { to: '/me', label: '我的', icon: 'person' },
]

export function TabBar() {
  const navigate = useNavigate()
  const location = useLocation()
  return (
    <nav className="tabbar" aria-label="主导航">
      {TABS.map((t) => {
        const active = t.to === '/' ? location.pathname === '/' : location.pathname.startsWith(t.to)
        const compose = t.to === '/forum' && active
        return (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className="tabbar__item"
            aria-label={compose ? '发帖' : t.label}
            onClick={(e) => {
              if (compose) {
                e.preventDefault()
                navigate('/forum/new')
              }
            }}
          >
            {compose ? (
              <span className="tabbar__compose">
                <Icon name="plus" size={22} />
              </span>
            ) : (
              <Icon name={t.icon} size={24} />
            )}
            <span className="tabbar__label">{compose ? '发帖' : t.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}

/* ---------------- NavBar ---------------- */

/**
 * 返回 0–1 的滚动进度：用于大标题连续收缩（iOS 26 的手感）。
 * 用 rAF 节流，避免滚动时每个像素都重渲染。
 */
export function useScrollProgress(range = 64): number {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    let raf = 0
    const compute = () => {
      const y = typeof window === 'undefined' ? 0 : window.scrollY
      const next = Math.min(1, Math.max(0, y / Math.max(1, range)))
      setProgress((prev) => (Math.abs(prev - next) < 0.01 ? prev : next))
    }
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(compute)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    compute()
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [range])
  return progress
}

interface NavBarProps {
  title: string
  back?: boolean
  large?: boolean
  sub?: string
  action?: ReactNode
  /** 桌面端左侧已经有品牌字标时，不再重复显示大标题 */
  brand?: boolean
}

export function NavBar({ title, back, large, sub, action, brand }: NavBarProps) {
  const navigate = useNavigate()
  // 大标题：滚动 0–64px 之间连续收缩；二级页直接按已收缩处理
  const progress = useScrollProgress(large ? 48 : 1)
  const p = large ? progress : 1
  const glass = !large || p > 0.02
  const stuck = large ? p > 0.98 : true

  return (
    <header
      className={`nav${glass ? ' nav--glass' : ''}${stuck ? ' nav--stuck' : ''}${
        brand ? ' nav--brand' : ''
      }`}
      style={{ '--p': p } as React.CSSProperties}
    >
      <div className="nav__inner">
        {back ? (
          <button
            type="button"
            className="nav__back"
            aria-label="返回"
            onClick={() => navigate(-1)}
          >
            <Icon name="chevron-left" size={26} />
          </button>
        ) : null}
        {!large ? (
          <h1 className="nav__inline">{title}</h1>
        ) : (
          <span className="nav__small">{title}</span>
        )}
        <div className="grow" />
        {action ? <div className="nav__action">{action}</div> : null}
      </div>
      {large ? (
        <div className="nav__large">
          <h1 className="t-title1">{title}</h1>
          {sub ? <p className="nav__sub">{sub}</p> : null}
        </div>
      ) : null}
    </header>
  )
}

/* ---------------- Section head ---------------- */

export function SectionHead({
  title,
  moreTo,
  moreLabel = '全部',
}: {
  title: string
  moreTo?: string
  moreLabel?: string
}) {
  return (
    <div className="section__head">
      <h2 className="section__title">{title}</h2>
      {moreTo ? (
        <NavLink to={moreTo} className="section__more">
          {moreLabel}
          <Icon name="chevron-right" size={14} />
        </NavLink>
      ) : null}
    </div>
  )
}

/* ---------------- Segmented ---------------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (v: T) => void
  label: string
}) {
  const id = useId()
  return (
    <div className="seg" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          id={`${id}-${o.value}`}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          className="seg__item"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------------- Chip ---------------- */

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className="chip"
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/* ---------------- Avatar ---------------- */

const WARM_TINTS = ['#e3d5c3', '#d8dfd8', '#dfe3ea', '#e8dcd6', '#dcd9e3']

export function avatarTint(name: string): string {
  let sum = 0
  for (let i = 0; i < name.length; i += 1) sum += name.charCodeAt(i)
  return WARM_TINTS[sum % WARM_TINTS.length]
}

export function Avatar({
  name,
  src,
  size = 32,
}: {
  name: string
  src?: string | null
  size?: 88 | 56 | 32
}) {
  const initial = (name || '?').trim().slice(0, 1).toUpperCase()
  return (
    <span className={`avatar avatar--${size}`} style={{ background: src ? undefined : avatarTint(name) }}>
      {src ? <img src={src} alt={name} loading="lazy" /> : <span aria-hidden="true">{initial}</span>}
    </span>
  )
}

/* ---------------- Empty ---------------- */

export function EmptyState({
  icon = 'film',
  title,
  desc,
  action,
}: {
  icon?: IconName
  title: string
  desc?: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <span className="empty__art">
        <Icon name={icon} size={30} />
      </span>
      <p className="empty__title">{title}</p>
      {desc ? <p className="empty__desc">{desc}</p> : null}
      {action}
    </div>
  )
}

/* ---------------- Skeleton ---------------- */

export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="page__body sk-page" aria-busy="true" aria-live="polite">
      <div className="sk-line" style={{ width: 96 }} />
      <div className="sk sk--hero" />
      <div className="sk-line" style={{ width: '46%', marginTop: 4 }} />
      <div className="sk-card">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="sk-row">
            <div className="sk sk--avatar" />
            <div className="grow">
              <div className="sk-line" style={{ width: `${58 - i * 8}%` }} />
              <div className="sk-line" style={{ width: `${86 - i * 6}%`, marginTop: 8 }} />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">正在加载</span>
    </div>
  )
}

/* ---------------- List row ---------------- */

export function ListRow({
  icon,
  title,
  sub,
  to,
  onClick,
  right,
  danger,
}: {
  icon?: IconName
  title: string
  sub?: string
  to?: string
  onClick?: () => void
  right?: ReactNode
  danger?: boolean
}) {
  const content = (
    <>
      {icon ? (
        <span className="list__icon">
          <Icon name={icon} size={22} />
        </span>
      ) : null}
      <span className="grow">
        <span className={`list__title${danger ? ' list__danger' : ''}`}>{title}</span>
        {sub ? <span className="list__sub" style={{ display: 'block' }}>{sub}</span> : null}
      </span>
      {right}
      {to || onClick ? (
        <span className="list__chev">
          <Icon name="chevron-right" size={18} />
        </span>
      ) : null}
    </>
  )
  if (to) {
    return (
      <NavLink to={to} className="list__row">
        {content}
      </NavLink>
    )
  }
  return (
    <button type="button" className="list__row" onClick={onClick}>
      {content}
    </button>
  )
}

/* ---------------- Sheet ---------------- */

export function Sheet({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean
  title?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const lastFocus = useRef<Element | null>(null)
  // onClose 每次渲染都是新函数，放进 ref，避免 effect 反复执行抢走输入焦点
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    lastFocus.current = document.activeElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
      if (e.key === 'Tab' && ref.current) {
        const nodes = ref.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (nodes.length === 0) return
        const first = nodes[0]
        const last = nodes[nodes.length - 1]
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const timer = window.setTimeout(() => {
      const root = ref.current
      if (!root) return
      if (root.contains(document.activeElement)) return
      const focusable = root.querySelector<HTMLElement>(
        'input:not([type="hidden"]), textarea, select',
      )
      focusable?.focus()
    }, 60)
    return () => {
      window.clearTimeout(timer)
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
      if (lastFocus.current instanceof HTMLElement) lastFocus.current.focus()
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="sheet-mask"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
      >
        <div className="sheet__handle" />
        {title ? (
          <div className="sheet__head">
            <h2 className="sheet__title">{title}</h2>
            {/* 底部已有「取消」时不再给右上角叉号，避免两个关闭按钮 */}
            {footer ? null : (
              <button
                type="button"
                className="nav__action"
                aria-label="关闭"
                onClick={onClose}
              >
                <Icon name="close" size={20} />
              </button>
            )}
          </div>
        ) : null}
        <div className="sheet__body">{children}</div>
        {footer ? <div className="sheet__footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}

/* ---------------- 轻量确认框 ---------------- */

interface ConfirmOptions {
  title: string
  message?: string
  confirmText?: string
  danger?: boolean
}

const ConfirmContext = createContext<(opts: ConfirmOptions) => Promise<boolean>>(
  async () => false,
)

export function useConfirm() {
  return useContext(ConfirmContext)
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<
    (ConfirmOptions & { resolve: (v: boolean) => void }) | null
  >(null)

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...opts, resolve })
    })
  }, [])

  const close = (value: boolean) => {
    state?.resolve(value)
    setState(null)
  }

  const value = useMemo(() => confirm, [confirm])

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Sheet
        open={!!state}
        title={state?.title}
        onClose={() => close(false)}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => close(false)}>
              取消
            </button>
            <button
              type="button"
              className={`btn ${state?.danger ? 'btn--danger' : 'btn--primary'}`}
              onClick={() => close(true)}
            >
              {state?.confirmText ?? '确定'}
            </button>
          </>
        }
      >
        {state?.message ? <p className="t-body muted">{state.message}</p> : null}
      </Sheet>
    </ConfirmContext.Provider>
  )
}
