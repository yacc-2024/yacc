import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { NavBar, Avatar, EmptyState } from '../components/ui'
import { ForumCard } from '../components/ForumCard'
import type { ForumPost } from '../lib/api'
import { EpisodeRow } from '../components/media'
import { api, ApiError } from '../lib/api'
import { formatDate, formatDuration } from '../lib/format'
import { episodesOfSeason, findMember, findSeason } from '../lib/selectors'

interface PublicUser {
  uid: string
  rawUid: number | null
  name: string
  avatar: string | null
  role: string
  verified: boolean
  memberSince: string
  memberId: string | null
  userId: string
  followers: number
  followingCount: number
  likes: number
  isFollowing: boolean
  isMe: boolean
  label: string
  commentCount: number
}

export function UserProfile() {
  const { uid } = useParams()
  const { mode, content } = useApp()
  const [user, setUser] = useState<PublicUser | null>(null)
  const [posts, setPosts] = useState<ForumPost[]>([])
  const [busy, setBusy] = useState(false)
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

  useEffect(() => {
    if (mode !== 'online' || !user) return
    let alive = true
    void api
      .posts(10, 0, user.userId)
      .then((res) => {
        if (alive) setPosts(res.posts)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [mode, user])

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

            {(() => {
              const member = content && user.memberId ? findMember(content, user.memberId) : undefined
              if (!content || !member) return null
              const works = member.seasons.flatMap((no) => {
                const season = content.seasons.find((s) => s.no === no)
                return season ? episodesOfSeason(content, season.id) : []
              })
              if (works.length === 0) return null
              return (
                <section style={{ marginTop: 28 }}>
                  <h2 className="t-title2" style={{ marginBottom: 10 }}>
                    参演作品
                  </h2>
                  {works.map((ep) => {
                    const season = findSeason(content, ep.seasonId)
                    return (
                      <EpisodeRow
                        key={ep.id}
                        to={`/watch/${ep.id}`}
                        no={ep.no}
                        title={ep.title}
                        meta={`${season?.title ?? ''} · ${formatDuration(ep.durationSec)} · ${formatDate(ep.publishedAt)}`}
                        cover={ep.cover}
                      />
                    )
                  })}
                </section>
              )
            })()}

            <div className="row" style={{ justifyContent: 'center', gap: 28, marginTop: 20 }}>
              <span style={{ textAlign: 'center' }}>
                <span className="t-title3 t-num" style={{ display: 'block' }}>{user.followingCount}</span>
                <span className="t-tag faint">关注</span>
              </span>
              <span style={{ textAlign: 'center' }}>
                <span className="t-title3 t-num" style={{ display: 'block' }}>{user.followers}</span>
                <span className="t-tag faint">粉丝</span>
              </span>
              <span style={{ textAlign: 'center' }}>
                <span className="t-title3 t-num" style={{ display: 'block' }}>{user.likes}</span>
                <span className="t-tag faint">获赞</span>
              </span>
            </div>

            {!user.isMe ? (
              <button
                type="button"
                className={`follow-btn${user.isFollowing ? ' follow-btn--on' : ''}`}
                style={{ display: 'block', margin: '16px auto 0', minHeight: 38, padding: '0 26px' }}
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    const res = await api.follow(user.userId, user.isFollowing ? 'unfollow' : 'follow')
                    setUser({
                      ...user,
                      isFollowing: res.following,
                      followers: user.followers + (res.following ? 1 : -1),
                    })
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                {user.isFollowing ? '已关注' : '关注'}
              </button>
            ) : null}

            {posts.length > 0 ? (
              <section style={{ marginTop: 24 }}>
                <h2 className="section__title" style={{ marginBottom: 6 }}>他的帖子</h2>
                {posts.map((p) => (
                  <ForumCard key={p.id} post={p} />
                ))}
              </section>
            ) : null}

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
