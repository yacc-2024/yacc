import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { NavBar, EmptyState } from '../components/ui'
import { api } from '../lib/api'
import { formatDateTime } from '../lib/format'
import { usePolling } from '../hooks/usePolling'
import { Spinner } from '../components/PullToRefresh'

interface Item {
  id: string
  type: string
  commentId: string | null
  targetType: string | null
  targetId: string | null
  actorName: string
  body: string
  category?: string
  createdAt: string
  read: boolean
}

export function Notifications() {
  const { mode, account } = useApp()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'social' | 'system'>('all')

  const refresh = useCallback(async () => {
    if (mode !== 'online' || !account) {
      setLoading(false)
      return
    }
    try {
      const res = await api.notifications()
      setItems(res.notifications)
      if (res.unread > 0) void api.readNotifications().catch(() => {})
    } catch {
      /* 忽略 */
    } finally {
      setLoading(false)
    }
  }, [mode, account])

  useEffect(() => {
    void refresh()
  }, [refresh])

  usePolling(() => refresh(), 20_000, mode === 'online' && !!account)

  const filtered = items.filter((n) =>
    tab === 'all' ? true : tab === 'system' ? n.category === 'system' : n.category !== 'system',
  )

  return (
    <>
      <NavBar title="消息" back />
      <div className="page__body">
        <div className="seg" style={{ marginTop: 8 }}>
          {(
            [
              ['all', '全部'],
              ['social', '社交'],
              ['system', '系统'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className="seg__item"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <Spinner label="正在加载消息" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="bell"
            title="还没有消息"
            desc={
              tab === 'system'
                ? '获得称号等通知会出现在这里。'
                : '有人关注、点赞或回复你时，会出现在这里。'
            }
          />
        ) : (
          <div className="list" style={{ marginTop: 8 }}>
            {filtered.map((n) => (
              <Link
                key={n.id}
                to={
                  n.targetType && n.targetId
                    ? `/watch/${n.targetId}`
                    : '/'
                }
                className="list__row"
                style={{ alignItems: 'flex-start' }}
              >
                <span className="grow">
                  <span className="list__title" style={{ display: 'block' }}>
                    {n.actorName}
                    {n.type === 'follow'
                      ? ' 关注了你'
                      : n.type === 'like'
                        ? ' 赞了你'
                        : n.type === 'title'
                          ? ' 给了你新称号'
                          : ' 回复了你'}
                    {!n.read ? <span className="dot" style={{ marginLeft: 6 }} /> : null}
                  </span>
                  <span className="list__sub clamp-2" style={{ display: 'block' }}>
                    {n.body}
                  </span>
                  <span className="t-tag faint t-num" style={{ display: 'block', marginTop: 2 }}>
                    {formatDateTime(n.createdAt)}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
