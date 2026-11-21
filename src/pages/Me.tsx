import { Link } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { NavBar, Avatar, ListRow } from '../components/ui'
import { Icon } from '../components/Icon'

export function Me() {
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
              用邀请码加入剧组，收藏喜欢的作品。
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
            邀请码可以找负责人要
          </p>
        </div>
      ) : (
        <div className="page__body">
          <div className="row gap-3" style={{ marginTop: 8, marginBottom: 20 }}>
            <Avatar name={account.name} size={56} />
            <div className="grow">
              <p className="t-title3">{account.name}</p>
              <p className="t-caption">
                {account.role === 'admin' ? '管理员' : '剧组成员'}
              </p>
            </div>
          </div>

          <div className="list">
            <ListRow icon="bookmark" title="我的收藏" to="/me/favorites" />
            <ListRow icon="clock" title="观看历史" to="/me/history" />
            <ListRow icon="gear" title="账号设置" to="/me/settings" />
            <ListRow icon="info" title="版本与更新日志" to="/me/version" />
          </div>

          {account.role === 'admin' ? (
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
