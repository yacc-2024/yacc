import { useEffect, useState } from 'react'
import { useApp } from '../state/AppContext'
import { NavBar, EmptyState } from '../components/ui'
import { AnnouncementSheet, EventSheet } from '../components/detailSheets'
import {
  formatDate,
  formatDateTime,
  sortAnnouncements,
  sortEvents,
  eventStatus,
  formatDateBlock,
} from '../lib/format'
import { Icon } from '../components/Icon'
import { markNewsSeen } from '../lib/news'
import type { Announcement, CrewEvent } from '../data/schema'

export function NewsList() {
  const { content } = useApp()
  const c = content!
  const [current, setCurrent] = useState<Announcement | null>(null)
  const list = sortAnnouncements(c.announcements)

  useEffect(() => {
    markNewsSeen(list[0]?.date ?? '')
  }, [list])

  return (
    <>
      <NavBar title="公告" back />
      <div className="page__body">
        {list.length === 0 ? (
          <EmptyState icon="bell" title="还没有公告" desc="管理员发布后会出现在这里。" />
        ) : (
          <div className="list" style={{ marginTop: 8 }}>
            {list.map((a) => (
              <button
                key={a.id}
                type="button"
                className="list__row list__row--plain"
                style={{ alignItems: 'flex-start', paddingBlock: 14 }}
                onClick={() => setCurrent(a)}
              >
                <span className="grow" style={{ textAlign: 'left' }}>
                  <span className="list__title" style={{ display: 'block' }}>
                    {a.pinned ? (
                      <span className="t-tag" style={{ color: 'var(--accent)', marginRight: 6 }}>
                        置顶
                      </span>
                    ) : null}
                    {a.title}
                  </span>
                  <span className="list__sub clamp-1" style={{ display: 'block' }}>
                    {a.body}
                  </span>
                </span>
                <span className="t-caption faint t-num">{formatDate(a.date)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <AnnouncementSheet item={current} onClose={() => setCurrent(null)} />
    </>
  )
}

export function EventsList() {
  const { content, account } = useApp()
  const c = content!
  const [current, setCurrent] = useState<CrewEvent | null>(null)
  const list = sortEvents(c.events)

  return (
    <>
      <NavBar title="活动" back />
      <div className="page__body">
        {list.length === 0 ? (
          <EmptyState icon="map" title="还没有活动" desc="拍摄安排会放在这里。" />
        ) : (
          <div className="list" style={{ marginTop: 8 }}>
            {list.map((ev) => {
              const status = eventStatus(ev)
              const past = status === 'past'
              const block = formatDateBlock(ev.startAt.slice(0, 10))
              return (
                <button
                  key={ev.id}
                  type="button"
                  className="list__row list__row--plain"
                  style={{
                    opacity: past ? 0.4 : 1,
                    alignItems: 'flex-start',
                    paddingBlock: 14,
                  }}
                  onClick={() => setCurrent(ev)}
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
                    <span className="t-tag faint" style={{ display: 'block', lineHeight: 1.1 }}>
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
                      {status === 'ongoing' ? (
                        <span
                          className="t-tag"
                          style={{ color: 'var(--accent)', marginLeft: 6 }}
                        >
                          进行中
                        </span>
                      ) : null}
                    </span>
                    <span className="list__sub" style={{ display: 'block' }}>
                      {formatDateTime(ev.startAt)} · {ev.placePublic || '待定'}
                    </span>
                    <span className="list__sub" style={{ display: 'block' }}>
                      {account && ev.placePrivate
                        ? `📍 ${ev.placePrivate}`
                        : account
                          ? '📍 地点待定'
                          : '📍 拍摄地点（需登录）'}
                    </span>
                  </span>
                  <span className="list__chev">
                    <Icon name="chevron-right" size={18} />
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
      <EventSheet item={current} onClose={() => setCurrent(null)} />
    </>
  )
}
