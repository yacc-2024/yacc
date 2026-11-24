import { useEffect, useRef, useState } from 'react'
import { PosterCard } from './media'

export type CarouselItem = {
  key: string
  to: string
  title: string
  badge?: string | null
  cover?: string | null
}

/** 推荐轮播：横向吸附滚动 + 指示点 + 自动播放 */
export function Carousel({ items }: { items: CarouselItem[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el || items.length < 2) return
    const onScroll = () => {
      const w = el.clientWidth
      if (!w) return
      setIndex(Math.round(el.scrollLeft / w))
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [items.length])

  useEffect(() => {
    const el = ref.current
    if (!el || items.length < 2) return
    const timer = window.setInterval(() => {
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % items.length
      el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' })
    }, 4200)
    return () => window.clearInterval(timer)
  }, [items.length])

  return (
    <div className="carousel">
      <div className="carousel__track" ref={ref}>
        {items.map((f) => (
          <div className="carousel__slide" key={f.key}>
            <PosterCard
              to={f.to}
              title={f.title}
              badge={f.badge ?? ''}
              cover={f.cover ?? ''}
            />
          </div>
        ))}
      </div>
      {items.length > 1 ? (
        <div className="carousel__dots">
          {items.map((f, i) => (
            <button
              key={f.key}
              type="button"
              className="carousel__dot"
              aria-selected={i === index}
              aria-label={`第 ${i + 1} 个推荐`}
              onClick={() => {
                const el = ref.current
                if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

