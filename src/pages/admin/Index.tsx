import { Link } from 'react-router-dom'
import { useApp } from '../../state/AppContext'
import { NavBar, ListRow } from '../../components/ui'
import { DirtyBanner } from '../../components/DirtyBanner'

export function AdminIndex() {
  const { content, mode } = useApp()
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
          <ListRow
            icon="home"
            title="主页管理"
            sub={`推荐 ${c.home.featured.length} · 公告 ${c.announcements.length} · 活动 ${c.events.length}`}
            to="/admin/home"
          />
          <ListRow
            icon="info"
            title="关于页管理"
            sub={`历程 ${c.about.timeline.length} 条`}
            to="/admin/about"
          />
          <ListRow
            icon="users"
            title="成员管理"
            sub={`${c.members.length} 人`}
            to="/admin/members"
          />
          <ListRow
            icon="film"
            title="作品管理"
            sub={`${c.seasons.length} 季 · ${c.episodes.length} 集 · ${c.extras.length} 条花絮`}
            to="/admin/works"
          />
          <ListRow
            icon="download"
            title="数据管理"
            sub={mode === 'online' ? '发布到线上、备份、导入' : '导出、导入、发布'}
            to="/admin/data"
          />
          {mode === 'online' ? (
            <>
              <ListRow
                icon="lock"
                title="密钥管理"
                sub="发学校认证密钥给访客"
                to="/admin/keys"
              />
              <ListRow
                icon="info"
                title="评论审核"
                sub="通过或隐藏别人的评论"
                to="/admin/comments"
              />
            </>
          ) : null}
        </div>

        <p className="t-caption faint" style={{ marginTop: 20, lineHeight: 1.6 }}>
          改动先存在这台设备上。要让别人也看到，需要到「数据管理」导出内容包，再替换网站文件。
        </p>
      </div>
    </>
  )
}
