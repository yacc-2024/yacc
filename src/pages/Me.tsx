import { Link } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { NavBar, Avatar, ListRow } from '../components/ui'
import { Icon } from '../components/Icon'
import { api } from '../lib/api'
import { usePolling } from '../hooks/usePolling'
import { useCallback, useEffect, useState } from 'react'
import { formatUid, displayTitles } from '../lib/uid'
import { Badge, badgeKindOf } from '../components/Badge'

export function Me() {
  const [unread, setUnread] = useState(0)
  const { mode, account: me } = useApp()

  const refreshUnread = useCallback(async () => {
    if (mode !== 'online' || !me) return
    try {
      const res = await api.notifications()
      setUnread(res.unread)
    } catch {
      /* 忽略 */
    }
  }, [mode, me])

  useEffect(() => {
    void refreshUnread()
  }, [refreshUnread])

  usePolling(() => refreshUnread(), 30_000, mode === 'online' && !!me)
  const { content, account } = useApp()
  const c = content!

  return (
    <>
      <NavBar title="我的" large />

      {!account ? (
        <div className="page__body">
          <div className="card" style={{ marginTop: 8, textAlign: 'center', padding: '32px 20px' }}>
            <p style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1.5 }}>
              {c.site.name}
            </p>
            <p className="t-caption" style={{ marginTop: 8 }}>
              用认证密钥加入，收藏喜欢的作品。
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
              <Link to="/login" className="btn btn--primary" style={{ flex: 1 }}>
                登录
              </Link>
              <Link to="/login?mode=register" className="btn btn--ghost" style={{ flex: 1 }}>
                注册
              </Link>
            </div>
          </div>
          <p className="t-tag faint" style={{ textAlign: 'center', marginTop: 24 }}>
            用密钥注册后即可评论
          </p>
        </div>
      ) : (
        <div className="page__body">
          <div className="row gap-3" style={{ marginTop: 8, marginBottom: 20 }}>
            <Link
              to="/me/settings/profile"
              className="me-head"
              aria-label="编辑个人资料"
            >
              <Avatar name={account.name} src={account.avatar} size={56} />
              <span className="grow">
                <span className="t-title3" style={{ display: 'block' }}>
                  {account.name}
                </span>
                <span className="t-caption faint t-num" style={{ display: 'block', marginTop: 2 }}>
                  ID {formatUid(account.uid)}
                </span>
                <span className="title-row">
                  <Badge kind={badgeKindOf(account.role, account.uid, account.verified)} />
                  {displayTitles(
                    account.uid,
                    account.role,
                    account.verified,
                    account.titles,
                    account.shownTitles,
                  )
                    .filter(
                      (t) =>
                        t !== '管理员' &&
                        t !== '剧组成员' &&
                        t !== '认证成员' &&
                        t !== '普通访客' &&
                        t !== '访客',
                    )
                    .map((t) => (
                      <span key={t} className="title-chip title-chip--plain">
                        {t}
                      </span>
                    ))}
                </span>
              </span>
            </Link>
          </div>

          <div className="list">
            <ListRow
              icon="bell"
              title="消息"
              sub={unread > 0 ? `${unread} 条未读` : '有人回复你时会出现在这里'}
              to="/me/notifications"
            />
            <ListRow icon="bookmark" title="我的收藏" to="/me/favorites" />
            <ListRow icon="clock" title="观看历史" to="/me/history" />
            <ListRow icon="gear" title="账号设置" to="/me/settings" />
            <ListRow icon="info" title="版本与更新日志" to="/me/version" />
          </div>

          {account.role === 'admin' || account.role === 'superadmin' ? (
            <Link
              to="/admin"
              className="card--ink"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginTop: 20,
                padding: 18,
                borderRadius: 16,
                background: 'var(--card-ink)',
                color: 'var(--bg)',
              }}
            >
              <Icon name="edit" size={20} />
              <span className="grow t-title3">管理中心</span>
              <Icon name="chevron-right" size={18} />
            </Link>
          ) : null}

          <p className="t-tag faint" style={{ marginTop: 32, textAlign: 'center' }}>
            {c.site.copyright} · {c.site.school}
          </p>
        </div>
      )}
    </>
  )
}
