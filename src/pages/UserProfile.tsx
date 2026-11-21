import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { NavBar, Avatar, EmptyState } from '../components/ui'
import { api, ApiError } from '../lib/api'
import { formatDate } from '../lib/format'

interface PublicUser {
  uid: string
  rawUid: number | null
  name: string
  avatar: string | null
  role: string
  verified: boolean
  memberSince: string
  label: string
  commentCount: number
}

export function UserProfile() {
  const { uid } = useParams()
  const { mode } = useApp()
  const [user, setUser] = useState<PublicUser | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    if (mode !== 'online' || !uid) return
    void api
      .userProfile(uid)
      .then((res) => {
        if (alive) setUser(res.user)
      })
      .catch((err) => {
        if (alive) setError(err instanceof ApiError ? err.message : '加载失败')
      })
    return () => {
      alive = false
    }
  }, [mode, uid])

  if (mode !== 'online') {
    return (
      <>
        <NavBar title="用户主页" back />
        <EmptyState icon="person" title="离线模式没有用户主页" desc="连上服务器后再看。" />
      </>
    )
  }

  if (error) {
    return (
      <>
        <NavBar title="用户主页" back />
        <EmptyState icon="person" title="找不到这个人" desc={error} />
      </>
    )
  }

  return (
    <>
      <NavBar title="用户主页" back />
      <div className="page__body">
        {user ? (
          <>
            <div style={{ textAlign: 'center', paddingTop: 16 }}>
              <Avatar name={user.name} src={user.avatar} size={88} />
              <h2 className="t-title2" style={{ marginTop: 14 }}>
                {user.name}
              </h2>
              <p className="t-caption faint t-num" style={{ marginTop: 4 }}>
                ID {user.uid}
              </p>
              {user.label ? (
                <p className="t-caption" style={{ marginTop: 6, color: 'var(--accent)' }}>
                  {user.label}
                </p>
              ) : null}
            </div>

            <div className="card" style={{ marginTop: 24 }}>
              <div className="between">
                <span className="t-caption faint">加入时间</span>
                <span className="t-caption">{formatDate(user.memberSince.slice(0, 10))}</span>
              </div>
              <div className="between" style={{ marginTop: 10 }}>
                <span className="t-caption faint">公开评论</span>
                <span className="t-caption">{user.commentCount} 条</span>
              </div>
              <div className="between" style={{ marginTop: 10 }}>
                <span className="t-caption faint">身份</span>
                <span className="t-caption">
                  {user.role === 'admin' ? '管理员' : user.verified ? '认证访客' : '普通访客'}
                </span>
              </div>
            </div>

            <p className="t-tag faint" style={{ marginTop: 20, textAlign: 'center' }}>
              这是公开主页，只展示昵称、头像和评论数。
            </p>
          </>
        ) : (
          <p className="t-caption faint" style={{ marginTop: 24 }}>
            加载中…
          </p>
        )}
      </div>
    </>
  )
}
