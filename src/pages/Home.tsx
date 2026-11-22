import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { NavBar, SectionHead, Avatar } from '../components/ui'
import { PosterCard } from '../components/media'
import { Icon } from '../components/Icon'
import { api, type ForumPost } from '../lib/api'
import { DirtyBanner } from '../components/DirtyBanner'
import { EventSheet } from '../components/detailSheets'
import {
  formatDateBlock,
  formatShortDate,
  formatDateTime,
  sortAnnouncements,
  sortEvents,
  eventStatus,
} from '../lib/format'
import { featuredItems } from '../lib/selectors'
import { hasUnreadNews } from '../lib/news'
import type { CrewEvent } from '../data/schema'

export function Home() {
  const { content, account, mode } = useApp()
  const c = content!
  const [posts, setPosts] = useState<ForumPost[]>([])

  useEffect(() => {
    if (mode !== 'online') return
    let alive = true
    void api
      .posts(2)
      .then((res) => {
        if (alive) setPosts(res.posts)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [mode])
  const [evt, setEvt] = useState<CrewEvent | null>(null)

  const featured = featuredItems(c)
  const sortedNews = sortAnnouncements(c.announcements)
  const headline = sortedNews[0] ?? null
  const unread = hasUnreadNews(sortedNews[0]?.date ?? '')
  const events = sortEvents(c.events).slice(0, 2)

  return (
    <>
      <NavBar
        title={c.site.name}
        large
        brand
        action={
          <Link to="/news" className="nav__action" aria-label={unread ? '公告（有新的）' : '公告'}>
            <Icon name="bell" size={22} />
            {unread ? <span className="dot-badge" aria-hidden="true" /> : null}
          </Link>
        }
      />

      <DirtyBanner />

      <div className="page__body">
        <Link to="/about" className="hero" aria-label="了解 YACC 项目">
          <p className="hero__claim">{c.home.claim}</p>
          <p className="hero__intro">{c.home.intro}</p>
          <span className="hero__cta">
            了解项目
            <Icon name="chevron-right" size={14} />
          </span>
        </Link>

        <Link to="/about" className="figures" aria-label="查看数据与来源">
          {c.about.figures.slice(0, 3).map((f) => (
            <div className="figure" key={f.label}>
              <div className="figure__value">{f.value}</div>
              <div className="figure__label">{f.label}</div>
            </div>
          ))}
        </Link>

        {headline ? (
          <Link to="/news" className="notice" aria-label={`公告：${headline.title}`}>
            <span className="notice__head">
              <span className="notice__icon" aria-hidden="true">
                <Icon name="bell" size={14} />
              </span>
              <span className="notice__tag">{headline.pinned ? '置顶公告' : '最新公告'}</span>
              <span className="grow" />
              <span className="t-tag faint t-num">{formatShortDate(headline.date)}</span>
            </span>
            <span className="notice__title clamp-1">{headline.title}</span>
            <span className="notice__sub clamp-2">{headline.body}</span>
            <span className="notice__more">
              查看全部公告
              <Icon name="chevron-right" size={13} />
            </span>
          </Link>
        ) : null}

        {featured.length > 0 ? (
          <section className="section">
            <SectionHead title="最新推荐" />
            <div className="hscroll">
              {featured.map((f) => (
                <PosterCard
                  key={f.key}
                  to={f.to}
                  title={f.title}
                  badge={f.badge}
                  cover={f.cover}
                />
              ))}
            </div>
          </section>
        ) : null}


        {events.length > 0 ? (
          <section className="section">
            <SectionHead title="活动" moreTo="/events" />
            <div className="list">
              {events.map((ev) => {
                const block = formatDateBlock(ev.startAt.slice(0, 10))
                const past = eventStatus(ev) === 'past'
                return (
                  <button
                    key={ev.id}
                    type="button"
                    className="list__row list__row--plain"
                    style={{ opacity: past ? 0.4 : 1, alignItems: 'flex-start', paddingBlock: 14 }}
                    onClick={() => setEvt(ev)}
                  >
                    <span
                      style={{
                        flex: 'none',
                        width: 44,
                        borderRadius: 10,
                        background: 'var(--bg-group)',
                        textAlign: 'center',
                        padding: '6px 0',
                      }}
                    >
                      <span
                        className="t-tag faint"
                        style={{ display: 'block', lineHeight: 1.1 }}
                      >
                        {block.month}
                      </span>
                      <span
                        style={{
                          display: 'block',
                          fontSize: 17,
                          fontWeight: 700,
                          lineHeight: 1.15,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {block.day}
                      </span>
                    </span>
                    <span className="grow" style={{ textAlign: 'left' }}>
                      <span className="list__title" style={{ display: 'block' }}>
                        {ev.title}
                      </span>
                      <span className="list__sub" style={{ display: 'block' }}>
                        {formatDateTime(ev.startAt)} · {ev.placePublic || '待定'}
                      </span>
                      <span className="list__sub" style={{ display: 'block' }}>
                        {locationHint(ev, !!account)}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        ) : null}

        <section className="section">
          <SectionHead title="YACC 论坛" moreTo="/forum" />
          {posts.length === 0 ? (
            <Link to="/forum" className="forum-teaser">
              <span className="forum-teaser__empty">还没有人发帖，点这里进去看看</span>
            </Link>
          ) : (
            <Link to="/forum" className="forum-teaser">
              {posts.slice(0, 2).map((p) => (
                <span key={p.id} className="forum-teaser__row">
                  <Avatar name={p.author} src={p.avatar} size={32} />
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="forum-teaser__name">{p.author}</span>
                    <span className="forum-teaser__text clamp-1">{p.body}</span>
                  </span>
                  <span className="forum-teaser__meta">
                    <Icon name="heart" size={12} />
                    {p.likes}
                  </span>
                </span>
              ))}
              <span className="forum-teaser__more">
                进入论坛
                <Icon name="chevron-right" size={13} />
              </span>
            </Link>
          )}
        </section>


        <footer
          style={{
            marginTop: 40,
            paddingBottom: 16,
            textAlign: 'center',
            fontSize: 11,
            color: 'var(--text-3)',
          }}
        >
          {c.site.copyright} · {c.site.school}
        </footer>
      </div>

      <EventSheet item={evt} onClose={() => setEvt(null)} />
    </>
  )
}

function locationHint(ev: CrewEvent, loggedIn: boolean): string {
  if (loggedIn) {
    return ev.placePrivate ? `📍 ${ev.placePrivate}` : '📍 地点待定'
  }
  return '📍 拍摄地点（需登录）'
}
