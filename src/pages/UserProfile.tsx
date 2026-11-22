import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { NavBar, Avatar, EmptyState, Sheet } from '../components/ui'
import { Badge, badgeKindOf } from '../components/Badge'
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
  postCount: number
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
  const [showAllWorks, setShowAllWorks] = useState(false)
  const [showContent, setShowContent] = useState(false)
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

  const member =
    content && user?.memberId ? findMember(content, user.memberId) : undefined
  const memberBio = member?.bio
  const works =
    content && member
      ? member.seasons.flatMap((no) => {
          const season = content.seasons.find((x) => x.no === no)
          return season ? episodesOfSeason(content, season.id) : []
        })
      : []
  const bio = user?.userId ? memberBio : undefined

  return (
    <>
      <NavBar title="用户主页" back />
      <div className="page__body">
        {user ? (
          <>
            <div className="dy-head">
              <Avatar name={user.name} src={user.avatar} size={88} />
              <div className="dy-stats">
                <span className="dy-stat">
                  <span className="dy-stat__num">{user.likes}</span>
                  <span className="dy-stat__label">获赞</span>
                </span>
                <span className="dy-stat">
                  <span className="dy-stat__num">{user.followingCount}</span>
                  <span className="dy-stat__label">关注</span>
                </span>
                <span className="dy-stat">
                  <span className="dy-stat__num">{user.followers}</span>
                  <span className="dy-stat__label">粉丝</span>
                </span>
              </div>
            </div>

            <div className="dy-info">
              <p className="dy-name">{user.name}</p>
              <p className="dy-uid t-num">ID {user.uid}</p>
              {bio ? <p className="dy-bio">{bio}</p> : null}
              <span className="title-row" style={{ marginTop: 8 }}>
                <Badge kind={badgeKindOf(user.role, user.rawUid, user.verified)} />
              </span>
            </div>

            {!user.isMe ? (
              <button
                type="button"
                className={`follow-btn${user.isFollowing ? ' follow-btn--on' : ''}`}
                style={{ display: 'block', width: '100%', marginTop: 14, minHeight: 40 }}
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


            {works.length > 0 ? (
              <section style={{ marginTop: 22 }}>
                <h2 className="section__title" style={{ marginBottom: 8 }}>参演作品</h2>
                {(showAllWorks ? works : works.slice(0, 3)).map((ep) => {
                  const season = findSeason(content!, ep.seasonId)
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
                {works.length > 3 ? (
                  <button
                    type="button"
                    className="replies__more"
                    onClick={() => setShowAllWorks((v) => !v)}
                  >
                    {showAllWorks ? '收起' : `展开全部 ${works.length} 部`}
                  </button>
                ) : null}
              </section>
            ) : null}

            <div className="card" style={{ marginTop: 20 }}>
              <div className="between">
                <span className="t-caption faint">加入时间</span>
                <span className="t-caption">{formatDate(user.memberSince.slice(0, 10))}</span>
              </div>
              <button
                type="button"
                className="between"
                style={{ width: '100%', marginTop: 12, background: 'none', border: 0, padding: 0 }}
                onClick={() => setShowContent(true)}
              >
                <span className="t-caption faint">发表内容</span>
                <span className="t-caption" style={{ color: 'var(--accent)' }}>
                  {user.postCount + user.commentCount} 条 ›
                </span>
              </button>
              <div className="between" style={{ marginTop: 12 }}>
                <span className="t-caption faint">身份</span>
                <span className="t-caption">
                  {user.role === 'admin' || user.role === 'superadmin'
                    ? '管理员'
                    : user.verified
                      ? '认证访客'
                      : '普通访客'}
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

      <Sheet
        open={showContent}
        title="发表内容"
        onClose={() => setShowContent(false)}
        footer={
          <button type="button" className="btn btn--ghost" onClick={() => setShowContent(false)}>
            关闭
          </button>
        }
      >
        <ContentList userId={user?.userId ?? ''} />
      </Sheet>
    </>
  )
}

function ContentList({ userId }: { userId: string }) {
  const [data, setData] = useState<{
    posts: Array<{ id: string; body: string; createdAt: string }>
    comments: Array<{ id: string; body: string; createdAt: string; targetType: string; targetId: string }>
  } | null>(null)

  useEffect(() => {
    if (!userId) return
    let alive = true
    void api
      .userContent(userId)
      .then((res) => {
        if (alive) setData(res)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [userId])

  if (!data) return <p className="t-caption faint">加载中…</p>
  if (data.posts.length === 0 && data.comments.length === 0) {
    return <p className="t-caption faint">还没有发表过内容。</p>
  }

  return (
    <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
      {data.posts.map((p) => (
        <Link key={p.id} to={`/forum/${p.id}`} className="list__row list__row--plain">
          <span className="grow">
            <span className="list__title" style={{ display: 'block' }}>帖子</span>
            <span className="list__sub clamp-2" style={{ display: 'block' }}>{p.body}</span>
          </span>
        </Link>
      ))}
      {data.comments.map((c) => (
        <Link
          key={c.id}
          to={c.targetType === 'post' ? `/forum/${c.targetId}` : `/watch/${c.targetId}`}
          className="list__row list__row--plain"
        >
          <span className="grow">
            <span className="list__title" style={{ display: 'block' }}>评论</span>
            <span className="list__sub clamp-2" style={{ display: 'block' }}>{c.body}</span>
          </span>
        </Link>
      ))}
    </div>
  )
}
