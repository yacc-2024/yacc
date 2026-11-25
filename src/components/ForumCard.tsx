import { Link } from 'react-router-dom'
import { Avatar } from './ui'
import { Icon } from './Icon'
import { relativeTime } from '../lib/format'
import { TitleBadges } from './Badge'
import type { ForumPost } from '../lib/api'

/** 论坛帖子卡片：主页和列表页共用 */
export function ForumCard({
  post,
  onLike,
  onFollow,
  onComment,
  onPin,
  onDelete,
  isAdmin,
}: {
  post: ForumPost
  onLike?: () => void
  onFollow?: () => void
  onComment?: () => void
  onPin?: () => void
  onDelete?: () => void
  isAdmin?: boolean
}) {
  return (
    <article className="post">
      <header className="post__head">
        <Link to={`/u/${post.uid}`} className="post__who">
          <Avatar name={post.author} src={post.avatar} size={32} frame={post.avatarFrame} />
          <span>
            <span className="post__name-row">
              <span className="post__name">{post.author}</span>
              <TitleBadges
                role={post.badgeKind === 'admin' ? 'admin' : 'visitor'}
                uid={
                  post.badgeKind === 'crew' ? 10000 : post.badgeKind === 'member' ? 20000 : null
                }
                badgeStyle={post.badgeStyle ?? null}
                titleStyles={post.titleStyles ?? {}}
                titles={(post.titles ?? [post.badge]).filter(Boolean) as string[]}
                shownTitles={((post.shownTitles ?? [post.badge]).filter(Boolean) as string[]).slice(0, 1)}
              />
            </span>
          </span>
        </Link>
        {onFollow ? (
          <button
            type="button"
            className={`follow-btn${post.following ? ' follow-btn--on' : ''}`}
            onClick={onFollow}
          >
            {post.following ? '已关注' : '关注'}
          </button>
        ) : null}
      </header>

      <p className="post__date">{relativeTime(post.createdAt)}</p>

      <Link to={`/forum/${post.id}`} className="post__body">
        <p className="post__text">{post.body}</p>
        {post.images.length > 0 ? (
          <div className={`post__images post__images--${post.images.length}`}>
            {post.images.map((id) => (
              <img key={id} src={`/api/media/${id}`} alt="" loading="lazy" />
            ))}
          </div>
        ) : null}
      </Link>

      {post.pinned ? <span className="pin-badge" style={{ marginTop: 10 }}>置顶</span> : null}

      <footer className="post__actions">
        <button
          type="button"
          className={`act${post.liked ? ' act--on' : ''}`}
          onClick={onLike}
          aria-label={post.liked ? '取消点赞' : '点赞'}
        >
          <Icon name="heart" size={15} filled={post.liked} />
          {post.likes > 0 ? post.likes : '点赞'}
        </button>
        <button type="button" className="act" onClick={onComment}>
          <Icon name="message" size={15} />
          {post.comments ? `${post.comments} 条评论` : '评论'}
        </button>
        {isAdmin ? (
          <>
            <button type="button" className="act" onClick={onPin}>
              {post.pinned ? '取消置顶' : '置顶'}
            </button>
            <button type="button" className="act" onClick={onDelete}>
              删除
            </button>
          </>
        ) : (
          <span className="act">
            <Icon name="share" size={15} />
            分享
          </span>
        )}
      </footer>
    </article>
  )
}
