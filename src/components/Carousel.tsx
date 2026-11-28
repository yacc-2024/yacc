import { useEffect, useRef, useState } from 'react'
import { PosterCard } from './media'

export type CarouselItem = {
  key: string
  to: string
  title: string
  badge?: string | null
  cover?: string | null
}

/** 堆叠式轮播：后面的卡片从后面叠上来 */
export function Carousel({ items }: { items: CarouselItem[] }) {
  const [index, setIndex] = useState(0)
  const [drag, setDrag] = useState(0)
  const startX = useRef<number | null>(null)
  const lastX = useRef<number>(0)
  const lastT = useRef<number>(0)
  const velocity = useRef<number>(0)
  const count = items.length

  useEffect(() => {
    if (count < 2) return
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % count)
    }, 4200)
    return () => window.clearInterval(timer)
  }, [count])

  const onStart = (e: React.PointerEvent) => {
    startX.current = e.clientX
    lastX.current = e.clientX
    lastT.current = performance.now()
    velocity.current = 0
  }
  const onMove = (e: React.PointerEvent) => {
    if (startX.current === null) return
    const now = performance.now()
    const dt = Math.max(1, now - lastT.current)
    velocity.current = (e.clientX - lastX.current) / dt
    lastX.current = e.clientX
    lastT.current = now
    setDrag(e.clientX - startX.current)
  }
  const onEnd = () => {
    const distance = drag
    const speed = velocity.current
    const shouldSwitch = Math.abs(distance) > 60 || Math.abs(speed) > 0.45
    if (shouldSwitch) {
      const forward = distance < 0 || (distance === 0 && speed < 0)
      setIndex((i) => (i + (forward ? 1 : count - 1)) % count)
    }
    startX.current = null
    velocity.current = 0
    setDrag(0)
  }

  return (
    <div className="deck">
      <div
        className="deck__stage"
        onPointerDown={onStart}
        onPointerMove={onMove}
        onPointerUp={onEnd}
        onPointerCancel={onEnd}
      >
        {items.map((f, i) => {
          // 按真实相对位置排布，左右滑动对称
          let rel = i - index
          if (rel > count / 2) rel -= count
          if (rel < -count / 2) rel += count
          const depth = Math.abs(rel)
          if (depth > 2) return null
          return (
            <div
              key={f.key}
              className="deck__card"
              style={{
                zIndex: count - depth,
                transform: `translateX(${rel * 10 + drag * (rel === 0 ? 1 : 0.25)}px) translateY(${
                  depth * 9
                }px) scale(${1 - depth * 0.05}) rotate(${rel * 0.8}deg)`,
                opacity: 1,
                transition:
                  startX.current === null
                    ? 'transform 420ms cubic-bezier(.22,1,.36,1)'
                    : 'none',
              }}
              onClick={() => {
                if (Math.abs(drag) < 6) setIndex(i)
              }}
            >
              <PosterCard
                to={f.to}
                title={f.title}
                badge={f.badge ?? ''}
                cover={f.cover ?? ''}
              />
            </div>
          )
        })}
      </div>
      {count > 1 ? (
        <div className="deck__dots">
          {items.map((f, i) => (
            <button
              key={f.key}
              type="button"
              className="carousel__dot"
              aria-selected={i === index}
              aria-label={`第 ${i + 1} 个推荐`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
