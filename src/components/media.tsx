import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from './Icon'
import { cnNum } from '../lib/format'

/** 图片加载失败时退回暖色占位，不留破图标 */
export function SafeImage({
  src,
  alt,
  iconSize = 26,
}: {
  src: string
  alt: string
  iconSize?: number
}) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <span
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--text-3)',
        }}
        aria-label={alt}
        role="img"
      >
        <Icon name="film" size={iconSize} />
      </span>
    )
  }
  return (
    <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
  )
}

export function Cover({
  src,
  alt,
  ratio = '16/9',
  size,
}: {
  src?: string | null
  alt: string
  ratio?: string
  size?: number
}) {
  return (
    <div
      className={size ? '' : 'media-16x9'}
      style={
        size
          ? { width: size, height: size, borderRadius: 12, overflow: 'hidden', background: 'var(--warm)' }
          : { aspectRatio: ratio }
      }
    >
      {src ? (
        <span style={{ display: 'block', width: '100%', height: '100%' }}>
          <SafeImage src={src} alt={alt} />
        </span>
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--text-3)',
          }}
          aria-hidden="true"
        >
          <Icon name="film" size={size ? 22 : 26} />
        </div>
      )}
    </div>
  )
}

export function PosterCard({
  to,
  title,
  badge,
  cover,
}: {
  to: string
  title: string
  badge: string
  cover?: string | null
}) {
  return (
    <Link to={to} className="poster" aria-label={`${title} ${badge}`}>
      <div className="poster__media">
        {cover ? (
          <SafeImage src={cover} alt={title} />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--text-3)',
            }}
            aria-hidden="true"
          >
            <Icon name="film" size={26} />
          </div>
        )}
        <span className="poster__badge">{badge}</span>
      </div>
      <p className="poster__title clamp-1">{title}</p>
    </Link>
  )
}

export function EpisodeRow({
  to,
  no,
  title,
  meta,
  cover,
}: {
  to: string
  no?: number
  title: string
  meta: string
  cover?: string | null
}) {
  return (
    <Link to={to} className="ep">
      <span className="ep__media">
        {cover ? <SafeImage src={cover} alt={title} iconSize={22} /> : <Icon name="film" size={22} />}
      </span>
      <span className="grow">
        <span className="ep__title">
          {typeof no === 'number' && no > 0 && !/^第.+集$/.test(title) ? (
            <span className="ep__no">第{cnNum(no)}集</span>
          ) : null}
          {title}
        </span>
        <span className="ep__meta" style={{ display: 'block' }}>
          {meta}
        </span>
      </span>
      <span className="list__chev">
        <Icon name="chevron-right" size={18} />
      </span>
    </Link>
  )
}
