import { Link } from 'react-router-dom'
import { Avatar } from './ui'
import { Icon } from './Icon'
import { relativeTime } from '../lib/format'
import type { ForumPost } from '../lib/api'

/** 论坛帖子卡片：主页和列表页共用 */
export function ForumCard({
  post,
  onLike,
  onFollow,
}: {
  post: ForumPost
  onLike?: () => void
  onFollow?: () => void
}) {
  return (
    <article className="post">
      <header className="post__head">
        <Link to={`/u/${post.uid}`} className="post__who">
          <Avatar name={post.author} src={post.avatar} size={32} />
          <span>
            <span className="post__name">{post.author}</span>
            {post.label ? <span className="post__title">{post.label}</span> : null}
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
        <Link to={`/forum/${post.id}`} className="act">
          <Icon name="info" size={15} />
          {post.comments ? `${post.comments} 条评论` : '评论'}
        </Link>
        <span className="act">
          <Icon name="share" size={15} />
          分享
        </span>
      </footer>
    </article>
  )
}
