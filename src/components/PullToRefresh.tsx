import { useEffect, useRef, useState, type ReactNode } from 'react'

/** 下拉刷新：手指在页面顶部往下拉，松手触发 onRefresh */
export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<unknown> | void
  children: ReactNode
}) {
  const [pull, setPull] = useState(0)
  const [busy, setBusy] = useState(false)
  const startY = useRef<number | null>(null)
  const active = useRef(false)

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      if (window.scrollY > 0 || busy) return
      startY.current = e.touches[0].clientY
      active.current = true
    }
    const onMove = (e: TouchEvent) => {
      if (!active.current || startY.current === null) return
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0) {
        setPull(0)
        return
      }
      // 阻尼：越拉越沉
      setPull(Math.min(90, dy * 0.45))
    }
    const onEnd = async () => {
      if (!active.current) return
      active.current = false
      const dist = pull
      startY.current = null
      if (dist < 52) {
        setPull(0)
        return
      }
      setBusy(true)
      setPull(52)
      try {
        await onRefresh()
      } finally {
        setBusy(false)
        setPull(0)
      }
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [onRefresh, pull, busy])

  return (
    <>
      <div
        className="ptr"
        style={{ height: pull, opacity: pull > 6 ? 1 : 0 }}
        aria-hidden={pull < 8}
      >
        <span className={`ptr__spinner${busy ? ' ptr__spinner--busy' : ''}`} />
      </div>
      <div
        style={{
          transform: `translateY(${pull}px)`,
          transition: busy || pull === 0 ? 'transform 220ms var(--ease)' : 'none',
        }}
      >
        {children}
      </div>
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
