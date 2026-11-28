import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * 下拉刷新：
 * - 页面在顶部时往下拉，顶部出现小圆环并跟着手指走
 * - 拉够 64px 松手进入加载，转圈后自动收起
 * - iOS/安卓都走 touch 事件，阻止页面自身的回弹
 */
export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<unknown> | void
  children: ReactNode
}) {
  const [pull, setPull] = useState(0)
  const [loading, setLoading] = useState(false)
  const startY = useRef<number | null>(null)
  const pulling = useRef(false)

  useEffect(() => {
    const canScroll = () => {
      const el = document.scrollingElement ?? document.documentElement
      return el.scrollTop > 0
    }

    const onStart = (e: TouchEvent) => {
      if (loading || canScroll()) return
      startY.current = e.touches[0].clientY
      pulling.current = false
    }

    const onMove = (e: TouchEvent) => {
      if (startY.current === null || loading) return
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0) {
        setPull(0)
        return
      }
      if (canScroll()) {
        startY.current = null
        setPull(0)
        return
      }
      // 阻尼 + 阻止页面自带回弹
      if (e.cancelable) e.preventDefault()
      pulling.current = true
      setPull(Math.min(96, dy * 0.5))
    }

    const onEnd = () => {
      if (startY.current === null) return
      const reached = pull >= 64
      startY.current = null
      if (!reached || !pulling.current) {
        setPull(0)
        return
      }
      setLoading(true)
      setPull(56)
      void Promise.resolve(onRefresh())
        .catch(() => {})
        .finally(() => {
          setLoading(false)
          setPull(0)
        })
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [onRefresh, pull, loading])

  return (
    <>
      <div
        className="ptr-indicator"
        style={{
          transform: `translateY(${pull - 44}px)`,
          opacity: pull > 4 ? 1 : 0,
        }}
        aria-hidden={pull < 8}
      >
        <span
          className={`ptr__spinner${loading ? ' ptr__spinner--busy' : ''}`}
          style={loading ? undefined : { transform: `rotate(${pull * 6}deg)` }}
        />
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
