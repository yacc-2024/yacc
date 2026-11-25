import { NavLink } from 'react-router-dom'
import { Icon, type IconName } from './Icon'
import { Avatar } from './ui'
import { useApp } from '../state/AppContext'

const ITEMS: Array<{ to: string; label: string; icon: IconName }> = [
  { to: '/', label: '主页', icon: 'home' },
  { to: '/members', label: '成员', icon: 'users' },
  { to: '/forum', label: '论坛', icon: 'message' },
  { to: '/works', label: '作品', icon: 'film' },
  { to: '/me', label: '我的', icon: 'person' },
]

/** 桌面端左侧导航 */
export function SideNav() {
  const { account } = useApp()
  const isAdmin = account?.role === 'admin' || account?.role === 'superadmin'

  return (
    <aside className="sidenav">
      <p className="sidenav__brand">yacc</p>

      <nav className="sidenav__list" aria-label="主导航">
        {ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className="sidenav__item"
          >
            <Icon name={item.icon} size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="grow" />

      {isAdmin ? (
        <NavLink to="/admin" className="sidenav__item sidenav__item--muted">
          <Icon name="gear" size={20} />
          <span>管理中心</span>
        </NavLink>
      ) : null}

      <NavLink to={account ? '/me' : '/login'} className="sidenav__account">
        {account ? (
          <>
            <Avatar name={account.name} src={account.avatar} size={32} frame={account.avatarFrame} />
            <span className="grow">
              <span className="sidenav__name">{account.name}</span>
              <span className="sidenav__role">
                {isAdmin ? '管理员' : account.verified ? '认证访客' : '访客'}
              </span>
            </span>
          </>
        ) : (
          <>
            <Avatar name="?" size={32} />
            <span className="grow sidenav__name">登录</span>
          </>
        )}
      </NavLink>
    </aside>
  )
}
