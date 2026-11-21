import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { NavBar, EmptyState } from '../components/ui'
import { api } from '../lib/api'
import { formatDateTime } from '../lib/format'
import { usePolling } from '../hooks/usePolling'

interface Item {
  id: string
  type: string
  commentId: string | null
  targetType: string | null
  targetId: string | null
  actorName: string
  body: string
  createdAt: string
  read: boolean
}

export function Notifications() {
  const { mode, account } = useApp()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

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

  return (
    <>
      <NavBar title="消息" back />
      <div className="page__body">
        {loading ? (
          <p className="t-caption faint" style={{ marginTop: 16 }}>
            加载中…
          </p>
        ) : items.length === 0 ? (
          <EmptyState icon="bell" title="还没有消息" desc="有人回复你的评论时，会出现在这里。" />
        ) : (
          <div className="list" style={{ marginTop: 8 }}>
            {items.map((n) => (
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
                    {n.actorName} 回复了你
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
