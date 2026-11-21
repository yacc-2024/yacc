import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { NavBar, EmptyState, Sheet } from '../components/ui'
import { Icon } from '../components/Icon'
import { EpisodeRow } from '../components/media'
import { Comments, LikeButton } from '../components/Comments'
import { formatDate, formatDuration } from '../lib/format'
import { embedUrl, watchUrl } from '../lib/video'
import {
  episodeBadge,
  extraBadge,
  findEpisode,
  findExtra,
  nextInSeries,
} from '../lib/selectors'
import { shareOrCopy } from '../lib/share'
import { vibrate } from '../lib/haptics'

export function Watch() {
  const { content, account, favorites, toggleFavorite, pushHistory, online, toast } = useApp()
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const c = content!
  const [pop, setPop] = useState(false)
  const [prompt, setPrompt] = useState(false)
  const [frameFailed, setFrameFailed] = useState(false)
  const timerRef = useRef<number | null>(null)

  const episode = id ? findEpisode(c, id) : undefined
  const extra = !episode && id ? findExtra(c, id) : undefined
  const item = episode ?? extra

  useEffect(() => {
    setFrameFailed(false)
    if (!item) return
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      void pushHistory(episode ? 'episode' : 'extra', item.id)
    }, 3000)
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [item, episode, pushHistory])

  const favType = episode ? 'episode' : 'extra'
  const isFav = useMemo(
    () => favorites.some((f) => f.type === favType && f.id === item?.id),
    [favorites, favType, item?.id],
  )

  if (!item) {
    return (
      <>
        <NavBar title="播放" back />
        <EmptyState
          icon="film"
          title="找不到这条内容"
          desc="链接可能过期了，或者已经被删除。"
          action={
            <Link to="/works" className="btn btn--ghost" style={{ marginTop: 8 }}>
              去看看作品
            </Link>
          }
        />
      </>
    )
  }

  const platform = item.platform
  const ref = { platform, videoId: item.videoId }
  const title = episode ? episode.title : extra!.title
  const badge = episode ? episodeBadge(c, episode) : extraBadge(c, extra!)
  const next = episode ? nextInSeries(c, episode) : undefined
  const description = episode?.description ?? ''
  const relatedEp = extra?.relatedEpisodeId ? findEpisode(c, extra.relatedEpisodeId) : undefined

  const onFav = async () => {
    if (!account) {
      setPrompt(true)
      return
    }
    const added = await toggleFavorite(favType, item.id)
    vibrate(10)
    if (added) {
      setPop(true)
      window.setTimeout(() => setPop(false), 320)
    }
    toast(added ? '已收藏' : '已取消收藏')
  }

  const onShare = async () => {
    const outcome = await shareOrCopy({
      title: `${title} · ${c.site.fullName}`,
      text: c.home.claim,
      url: window.location.href,
    })
    if (outcome === 'copied') toast('链接已复制')
    if (outcome === 'failed') toast('分享失败', 'error')
  }

  const goLogin = () => {
    setPrompt(false)
    navigate('/login', {
      state: { from: location.pathname, favorite: { type: favType, id: item.id } },
    })
  }

  return (
    <>
      <NavBar
        title="播放"
        back
        action={
          <button type="button" className="nav__action" aria-label="分享" onClick={() => void onShare()}>
            <Icon name="share" size={20} />
          </button>
        }
      />

      <div className="watch__media">
        {!online || frameFailed ? (
          <div className="watch__fallback">
            <p className="t-body">视频没能加载出来</p>
            <p className="t-caption" style={{ opacity: 0.7 }}>
              {!online ? '当前没有网络连接' : '可能是网络或浏览器限制'}
            </p>
            <a
              className="btn btn--ghost"
              href={watchUrl(ref)}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'inherit' }}
            >
              在 B 站打开
            </a>
          </div>
        ) : (
          <iframe
            title={title}
            src={embedUrl(ref)}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            onError={() => setFrameFailed(true)}
          />
        )}
      </div>

      <div className="watch__head">
        <h1 className="watch__title">{title}</h1>
        <p className="watch__meta">
          {episode
            ? `${badge} · ${formatDuration(episode.durationSec)} · ${formatDate(episode.publishedAt)}`
            : `${badge} · ${formatDuration(extra!.durationSec)} · ${formatDate(extra!.publishedAt)}`}
        </p>

        <div className="watch__actions">
          <button
            type="button"
            className={`iconbtn${pop ? ' iconbtn--pop' : ''}`}
            aria-pressed={isFav}
            onClick={() => void onFav()}
            aria-label={isFav ? '取消收藏' : '收藏'}
          >
            <Icon name="bookmark" size={19} filled={isFav} />
            {isFav ? '已收藏' : '收藏'}
          </button>
          <LikeButton targetType={favType} targetId={item.id} />
          <button type="button" className="iconbtn" onClick={() => void onShare()}>
            <Icon name="share" size={18} />
            分享
          </button>
        </div>

        {description ? <p className="watch__desc">{description}</p> : null}
        {relatedEp ? (
          <p className="t-caption" style={{ marginTop: 12 }}>
            来自 {episodeBadge(c, relatedEp)} ·{' '}
            <Link to={`/watch/${relatedEp.id}`} className="linklike">
              {relatedEp.title}
            </Link>
          </p>
        ) : null}

        {next ? (
          <EpisodeRow
            to={`/watch/${next.id}`}
            no={next.no}
            title={next.title}
            meta={`下一集 · ${formatDuration(next.durationSec)}`}
            cover={next.cover}
          />
        ) : episode ? (
          <p className="t-caption faint" style={{ marginTop: 20 }}>
            已是最新一集
          </p>
        ) : null}

        <a
          className="linklike"
          style={{ marginTop: 16, display: 'inline-flex' }}
          href={watchUrl(ref)}
          target="_blank"
          rel="noreferrer"
        >
          打不开？在 B 站观看
        </a>
      </div>

      <div className="page__body">
        <Comments targetType={favType} targetId={item.id} />
      </div>

      <Sheet
        open={prompt}
        title="登录后可收藏"
        onClose={() => setPrompt(false)}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setPrompt(false)}>
              取消
            </button>
            <button type="button" className="btn btn--primary" onClick={goLogin}>
              去登录
            </button>
          </>
        }
      >
        <p className="t-body muted">收藏只对你自己可见，登录后会自动帮你收好这一集。</p>
      </Sheet>
    </>
  )
}
