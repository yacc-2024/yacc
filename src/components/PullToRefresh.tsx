import { useEffect, useRef, useState, type ReactNode } from 'react'

/* ---------------- 页面刷新总线 ---------------- */

const listeners = new Set<() => unknown>()

/** 让当前页面在“下拉刷新”时重新拉数据 */
export function usePageRefresh(fn: () => unknown): void {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    const listener = () => ref.current()
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])
}

/** 触发所有已注册页面的刷新 */
export async function runPageRefreshes(): Promise<void> {
  await Promise.all(Array.from(listeners).map((fn) => Promise.resolve(fn())))
}

const THRESHOLD = 72

/**
 * 全局下拉刷新：
 * - 页面滚到最顶端时，手指往下拉会出现白色加载条
 * - 拉过阈值松手：转圈并刷新数据
 * - 每个页面都能用（挂在应用外层）
 */
export function RefreshGate({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<unknown> | unknown
  children: ReactNode
}) {
  const [distance, setDistance] = useState(0)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const startY = useRef<number | null>(null)
  const active = useRef(false)
  const distRef = useRef(0)

  useEffect(() => {
    /** 找到离触点最近的滚动容器，返回它的滚动位置 */
    const scrollTopOf = (target: EventTarget | null): number => {
      let el = target instanceof HTMLElement ? target : null
      while (el && el !== document.body && el !== document.documentElement) {
        const style = getComputedStyle(el)
        const scrollable = /(auto|scroll)/.test(`${style.overflowY}`)
        if (scrollable && el.scrollHeight - el.clientHeight > 2) {
          return el.scrollTop
        }
        el = el.parentElement
      }
      const root = document.scrollingElement ?? document.documentElement
      return root.scrollTop
    }

    let startTarget: EventTarget | null = null
    let startedAtTop = false

    const onStart = (e: TouchEvent) => {
      if (loading) return
      if (e.touches.length !== 1) return
      startTarget = e.target
      startedAtTop = scrollTopOf(startTarget) <= 0
      if (!startedAtTop) return
      startY.current = e.touches[0].clientY
      active.current = false
    }

    const onMove = (e: TouchEvent) => {
      if (startY.current === null || loading) return
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0) {
        distRef.current = 0
        setDistance(0)
        return
      }
      // 页面在下拉过程中被滚走就放弃
      if (!startedAtTop || scrollTopOf(startTarget) > 0) {
        startY.current = null
        distRef.current = 0
        setDistance(0)
        return
      }
      // 阻止浏览器自带的回弹，让手势完全由我们接管
      if (e.cancelable) e.preventDefault()
      active.current = true
      const eased = Math.min(120, dy * 0.55)
      distRef.current = eased
      setDistance(eased)
    }

    const finish = () => {
      if (startY.current === null) return
      const reached = distRef.current >= THRESHOLD && active.current
      startY.current = null
      active.current = false
      distRef.current = 0
      if (!reached) {
        setDistance(0)
        return
      }
      setDistance(THRESHOLD)
      setLoading(true)
      void Promise.resolve(onRefresh())
        .catch(() => {})
        .finally(() => {
          setLoading(false)
          setDone(true)
          window.setTimeout(() => {
            setDone(false)
            setDistance(0)
          }, 900)
        })
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', finish)
    window.addEventListener('touchcancel', finish)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', finish)
      window.removeEventListener('touchcancel', finish)
    }
  }, [onRefresh, loading])

  const progress = Math.min(1, distance / THRESHOLD)
  const visible = distance > 2 || loading || done

  return (
    <>
      <div
        className={`refresh${loading ? ' refresh--loading' : ''}${done ? ' refresh--done' : ''}`}
        style={{
          transform: `translate3d(-50%, ${done ? 24 : distance - 56}px, 0)`,
          opacity: visible ? 1 : 0,
        }}
        aria-hidden={!visible}
        role="status"
        aria-live="polite"
      >
        {done ? (
          <svg className="refresh__check" viewBox="0 0 24 24" width="18" height="18">
            <path
              d="M5 12.5 10 17.5 19 7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <span
            className="refresh__ring"
            style={loading ? undefined : { transform: `rotate(${progress * 270}deg)` }}
          />
        )}
        <span className="refresh__label">{done ? '刷新成功' : ''}</span>
      </div>
      {children}
    </>
  )
}

/** 通用加载转圈 */
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="spinner-block">
      <span className="ptr__spinner ptr__spinner--busy" />
      {label ? <span className="t-caption faint">{label}</span> : null}
    </div>
  )
}
