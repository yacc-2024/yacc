import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { NavBar, SectionHead } from '../components/ui'
import { PosterCard } from '../components/media'
import { Icon } from '../components/Icon'
import { DirtyBanner } from '../components/DirtyBanner'
import { AnnouncementSheet, EventSheet } from '../components/detailSheets'
import {
  formatDateBlock,
  formatShortDate,
  formatDateTime,
  sortAnnouncements,
  sortEvents,
  eventStatus,
} from '../lib/format'
import { featuredItems } from '../lib/selectors'
import type { Announcement, CrewEvent } from '../data/schema'

export function Home() {
  const { content, account } = useApp()
  const c = content!
  const [ann, setAnn] = useState<Announcement | null>(null)
  const [evt, setEvt] = useState<CrewEvent | null>(null)

  const featured = featuredItems(c)
  const announcements = sortAnnouncements(c.announcements).slice(0, 3)
  const events = sortEvents(c.events).slice(0, 2)

  return (
    <>
      <NavBar
        title={c.site.name}
        large
        action={
          <Link to="/news" className="nav__action" aria-label="公告">
            <Icon name="bell" size={22} />
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

        {announcements.length > 0 ? (
          <section className="section">
            <SectionHead title="公告" moreTo="/news" />
            <div className="list">
              {announcements.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="list__row list__row--plain"
                  onClick={() => setAnn(a)}
                >
                  {/* 始终占位，保证有置顶和没置顶的标题左边缘对齐 */}
                  <span
                    aria-label={a.pinned ? '置顶' : undefined}
                    aria-hidden={a.pinned ? undefined : true}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      flex: 'none',
                      background: a.pinned ? 'var(--accent)' : 'transparent',
                    }}
                  />
                  <span className="grow list__title clamp-1" style={{ textAlign: 'left' }}>
                    {a.title}
                  </span>
                  <span className="t-caption faint t-num">{formatShortDate(a.date)}</span>
                </button>
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

      <AnnouncementSheet item={ann} onClose={() => setAnn(null)} />
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
