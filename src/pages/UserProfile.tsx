import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { NavBar, Avatar, EmptyState, Sheet, useConfirm } from '../components/ui'
import { TitleBadges } from '../components/Badge'
import { Spinner } from '../components/PullToRefresh'
import { EpisodeRow } from '../components/media'
import { Icon } from '../components/Icon'
import { api, ApiError } from '../lib/api'
import { formatDate, formatDuration } from '../lib/format'
import { episodesOfSeason, findMember, findSeason } from '../lib/selectors'

/** 等级分档：1–9 灰蓝、10–19 蓝、20–29 紫、30–39 橙、40+ 红 */
function tierOf(level: number): number {
  if (level >= 40) return 5
  if (level >= 30) return 4
  if (level >= 20) return 3
  if (level >= 10) return 2
  return 1
}

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
  followsMe: boolean
  signature: string | null
  level: number
  points: number
  popularity: number
  titles: string[]
  shownTitles: string[]
  titleStyles: Record<string, string>
  hideBadge: boolean
  isSponsor: boolean
  sponsorUntil: string | null
  avatarFrame: string | null
  profileStyle: string | null
  visitors: Array<{ uid: string; name: string; avatar: string | null; at: string }>
  isMe: boolean
  badgeStyle: string | null
  label: string
  commentCount: number
}

export function UserProfile() {
  const { uid } = useParams()
  const { mode, content } = useApp()
  const [user, setUser] = useState<PublicUser | null>(null)
  const [showAllWorks, setShowAllWorks] = useState(false)
  const [showContent, setShowContent] = useState(false)
  const [tab, setTab] = useState<'profile' | 'posts'>('profile')
  const [busy, setBusy] = useState(false)
  const confirm = useConfirm()
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
        <NavBar
        title="用户主页"
        back
        action={
          user?.isMe ? (
            <Link to="/me/settings/profile" className="nav__action" aria-label="编辑资料">
              <Icon name="edit" size={20} />
            </Link>
          ) : null
        }
      />
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
      <div className={`page__body profile-skin profile-skin--${user?.profileStyle ?? 'normal'}`}>
        {user ? (
          <>
            <div className="dy-main">
              <Avatar name={user.name} src={user.avatar} size={88} frame={user.avatarFrame} />
              <div className="dy-side">
                  <div className="dy-stats dy-stats--top">
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
                      <span className="dy-stat">
                        <span className="dy-stat__num">{user.popularity}</span>
                        <span className="dy-stat__label">人气</span>
                      </span>
                  </div>
                {!user.isMe ? (
                  <button
                    type="button"
                    className={`follow-btn${user.isFollowing ? ' follow-btn--on' : ''}`}
                    style={{ display: 'block', width: '100%', marginTop: 10, minHeight: 36 }}
                    disabled={busy}
                    onClick={async () => {
                      if (user.isFollowing) {
                        const yes = await confirm({
                          title: '取消关注？',
                          message: `取消关注后，TA 的新动态不会再优先出现。`,
                          confirmText: '取消关注',
                          danger: true,
                        })
                        if (!yes) return
                      }
                      setBusy(true)
                      try {
                        const res = await api.follow(
                          user.userId,
                          user.isFollowing ? 'unfollow' : 'follow',
                        )
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
                    {user.isFollowing && user.followsMe
                      ? '互相关注'
                      : user.isFollowing
                        ? '已关注'
                        : '关注'}
                  </button>
                ) : null}
              </div>
            </div>

            {user.isSponsor && user.profileStyle !== 'sponsor' ? (
              <div className="sponsor-card">
                <span className="sponsor-card__badge">赞助者</span>
                <p className="sponsor-card__text">
                  感谢 {user.name} 对 YACC 创作组的支持
                </p>
                {user.sponsorUntil ? (
                  <p className="sponsor-card__until">
                    赞助有效期至 {formatDate(user.sponsorUntil)}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="dy-info">
              <p className={`dy-name${user.isSponsor ? ' sponsor-name' : ''}`}>
                {user.name}
                <span className="dy-uid-inline t-num">ID {user.uid}</span>
              </p>
              <span className="title-row" style={{ marginTop: 8 }}>
                <span className={`lv lv--${tierOf(user.level)}`}>Lv.{user.level}</span>
                <TitleBadges
                  role={user.role}
                  uid={user.rawUid}
                  verified={user.verified}
                  badgeStyle={user.badgeStyle}
                  titleStyles={user.titleStyles}
                  titles={user.titles}
                  shownTitles={user.shownTitles}
                />
              </span>
              <div className="dy-block">
                <span className="dy-block__label">个性签名</span>
                <p className="dy-sign">
                  {user.signature?.trim() || '这家伙很懒，什么也没留下...'}
                </p>
              </div>
              {bio ? (
                <div className="dy-block">
                  <span className="dy-block__label">个人简介</span>
                  <p className="dy-bio">{bio}</p>
                </div>
              ) : null}
            </div>

            <div className="seg" style={{ marginTop: 20, marginBottom: 4 }}>
              <button
                type="button"
                className="seg__item"
                aria-selected={tab === 'profile'}
                onClick={() => setTab('profile')}
              >
                资料
              </button>
              <button
                type="button"
                className="seg__item"
                aria-selected={tab === 'posts'}
                onClick={() => setTab('posts')}
              >
                帖子
              </button>
            </div>

            {tab === 'posts' ? <UserPosts userId={user.userId} /> : null}

            {tab === 'profile' && works.length > 0 ? (
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

            {tab === 'profile' ? (
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
            ) : null}

            {tab === 'profile' && user.isMe && user.visitors.length > 0 ? (
              <section style={{ marginTop: 22 }}>
                <h2 className="section__title" style={{ marginBottom: 8 }}>
                  最近访客
                </h2>
                <div className="visitors">
                  {user.visitors.map((v) => (
                    <Link key={v.uid} to={`/u/${v.uid}`} className="visitor">
                      {v.avatar ? (
                        <img src={v.avatar} alt="" className="visitor__avatar" />
                      ) : (
                        <span className="visitor__avatar visitor__avatar--empty">
                          {v.name.slice(0, 1)}
                        </span>
                      )}
                      <span className="visitor__name">{v.name}</span>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

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


function UserPosts({ userId }: { userId: string }) {
  const [posts, setPosts] = useState<Array<{
    id: string
    body: string
    createdAt: string
    likes: number
    commentCount: number
    imageId: string | null
  }> | null>(null)

  useEffect(() => {
    let alive = true
    void api
      .userContent(userId)
      .then((res) => {
        if (alive) setPosts(res.posts)
      })
      .catch(() => {
        if (alive) setPosts([])
      })
    return () => {
      alive = false
    }
  }, [userId])

  if (posts === null) {
    return <Spinner label="正在加载帖子" />
  }

  if (posts.length === 0) {
    return (
      <div className="empty-block">
        <Icon name="message" size={34} />
        <p className="t-caption faint">还没有相关的帖子</p>
      </div>
    )
  }

  return (
    <div className="list" style={{ marginTop: 12 }}>
      {posts.map((p) => (
        <Link key={p.id} to={`/forum/${p.id}`} className="list__row profile-post">
          {p.imageId ? (
            <img className="profile-post__thumb" src={`/api/media/${p.imageId}`} alt="" loading="lazy" />
          ) : null}
          <span className="grow" style={{ minWidth: 0 }}>
            <span className="profile-post__body">{p.body.slice(0, 60)}</span>
            <span className="list__sub">
              {formatDate(p.createdAt)} · 赞 {p.likes} · 评论 {p.commentCount}
            </span>
          </span>
          <Icon name="chevron-right" size={16} />
        </Link>
      ))}
    </div>
  )
}
