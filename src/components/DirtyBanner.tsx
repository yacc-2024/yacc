import { Link } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { Icon } from './Icon'

export function DirtyBanner() {
  const { dirty, account, conflict, restoreMyDraft, externalChange, reloadExternal } =
    useApp()
  const isAdmin = account?.role === 'admin' || account?.role === 'superadmin'
  if (!account || !isAdmin) return null

  if (externalChange) {
    return (
      <div className="banner banner--sticky" role="status">
        <Icon name="info" size={16} />
        <span className="grow">另一个标签页改了内容</span>
        <button type="button" className="linklike" onClick={() => void reloadExternal()}>
          重新载入
        </button>
      </div>
    )
  }

  if (conflict) {
    return (
      <div className="banner banner--sticky" role="status">
        <Icon name="info" size={16} />
        <span className="grow">网站内容已更新，你的本地草稿可能覆盖它。</span>
        <button type="button" className="linklike" onClick={() => void restoreMyDraft()}>
          用我的草稿
        </button>
      </div>
    )
  }

  if (!dirty) return null

  return (
    <Link to="/admin/data" className="banner banner--sticky" role="status">
      <Icon name="info" size={16} />
      <span className="grow">有未发布的修改 · 去发布</span>
      <Icon name="chevron-right" size={14} />
    </Link>
  )
}
