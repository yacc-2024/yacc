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
  }
  const onMove = (e: React.PointerEvent) => {
    if (startX.current === null) return
    setDrag(e.clientX - startX.current)
  }
  const onEnd = () => {
    if (Math.abs(drag) > 60) {
      setIndex((i) => (i + (drag < 0 ? 1 : count - 1)) % count)
    }
    startX.current = null
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
          const offset = (i - index + count) % count
          const depth = offset > 2 ? 3 : offset
          return (
            <div
              key={f.key}
              className="deck__card"
              style={{
                zIndex: count - depth,
                transform: `translateY(${depth * 10}px) scale(${1 - depth * 0.05}) rotate(${
                  depth * -1.2
                }deg) translateX(${drag * (depth === 0 ? 1 : 0.2)}px)`,
                opacity: depth > 2 ? 0 : 1,
                transition:
                  startX.current === null
                    ? 'transform 420ms cubic-bezier(.22,1,.36,1), opacity 300ms ease'
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
