import { Link } from 'react-router-dom'
import { useApp } from '../../state/AppContext'
import { NavBar, ListRow } from '../../components/ui'
import { DirtyBanner } from '../../components/DirtyBanner'
import { expandPerms } from '../../lib/perms'

export function AdminIndex() {
  const { content, mode, account } = useApp()
  const all = account?.role === 'superadmin'
  const owned = expandPerms(account?.perms ?? [])
  const can = (p: string) => all || owned.has(p)
  const c = content!

  return (
    <>
      <NavBar
        title="管理中心"
        back
        action={
          <Link to="/" className="linklike">
            看网站
          </Link>
        }
      />
      <DirtyBanner />
      <div className="page__body">
        <div className="list" style={{ marginTop: 8 }}>
          <p className="form-section">内容</p>

          {can('content:home') ? (
          <ListRow
            icon="home"
            title="主页管理"
            sub={`推荐 ${c.home.featured.length} · 公告 ${c.announcements.length} · 活动 ${c.events.length}`}
            to="/admin/home"
          />
          ) : null}
          {can('content:about') ? (
          <ListRow
            icon="info"
            title="关于页管理"
            sub={`历程 ${c.about.timeline.length} 条`}
            to="/admin/about"
          />
          ) : null}
          {can('content:members') ? (
          <ListRow
            icon="users"
            title="成员管理"
            sub={`${c.members.length} 人`}
            to="/admin/members"
          />
          ) : null}
          {can('content:works') ? (
          <ListRow
            icon="film"
            title="作品管理"
            sub={`${c.seasons.length} 季 · ${c.episodes.length} 集 · ${c.extras.length} 条花絮`}
            to="/admin/works"
          />
          ) : null}
          {can('content:changelog') ? (
          <ListRow
            icon="info"
            title="更新日志"
            sub={`${c.changelog.length} 个版本`}
            to="/admin/changelog"
          />
          ) : null}
          <p className="form-section">社区与商城</p>

          {can('content:publish') ? (
            <ListRow
              icon="clock"
              title="积分任务"
              sub="每个行为给多少分"
              to="/admin/tasks"
            />
          ) : null}
          {can('content:publish') ? (
            <ListRow
              icon="check"
              title="商品管理"
              sub="积分商城的商品与上下架"
              to="/admin/products"
            />
          ) : null}

          <p className="form-section">发布与数据</p>

          {can('content:publish') ? (
            <ListRow
              icon="download"
              title="数据管理"
              sub={mode === 'online' ? '发布到线上、备份、导入' : '导出、导入、发布'}
              to="/admin/data"
            />
          ) : null}
          <p className="form-section">账号与审核</p>

          {mode === 'online' && (can('users:view') || can('keys:issue')) ? (
            <ListRow
              icon="users"
              title="账号与密钥"
              sub="管理账号、发放密钥"
              to="/admin/accounts"
            />
          ) : null}
          {mode === 'online' && can('comments:review') ? (
            <ListRow
              icon="info"
              title="评论审核"
              sub="通过或隐藏别人的评论"
              to="/admin/comments"
            />
          ) : null}
        </div>

        <p className="t-caption faint" style={{ marginTop: 20, lineHeight: 1.6 }}>
          {mode === 'online'
            ? '改动先存为本地草稿，确认后在「数据管理」点「发布到线上」才会对外生效。'
            : '改动先存在这台设备上，需要导出内容包并替换网站文件才会生效。'}
        </p>
      </div>
    </>
  )
}
