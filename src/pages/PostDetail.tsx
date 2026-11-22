import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { NavBar, EmptyState, Avatar, useConfirm } from '../components/ui'
import { Icon } from '../components/Icon'
import { Comments } from '../components/Comments'
import { api, type ForumPost } from '../lib/api'
import { relativeTime } from '../lib/format'

export function PostDetail() {
  const { id } = useParams()
  const { mode, account, toast } = useApp()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [post, setPost] = useState<ForumPost | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (mode !== 'online' || !id) return
    try {
      const res = await api.post(id)
      setPost(res.post)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    }
  }, [mode, id])

  useEffect(() => {
    void load()
  }, [load])

  if (!id) return null

  const like = async () => {
    if (!post || !account) {
      toast('登录后才能点赞', 'error')
      return
    }
    setPost({ ...post, liked: !post.liked, likes: post.likes + (post.liked ? -1 : 1) })
    try {
      await api.likePost(post.id)
    } catch {
      void load()
    }
  }

  const follow = async () => {
    if (!post) return
    if (!account) {
      toast('登录后才能关注', 'error')
      return
    }
    try {
      const res = await api.follow(post.authorId, post.following ? 'unfollow' : 'follow')
      setPost({ ...post, following: res.following })
      toast(res.following ? `已关注 ${post.author}` : '已取消关注')
    } catch (err) {
      toast(err instanceof Error ? err.message : '操作失败', 'error')
    }
  }

  const remove = async () => {
    if (!post) return
    const ok = await confirm({
      title: '删除这条帖子？',
      message: '评论和点赞会一起删除，不可恢复。',
      confirmText: '删除',
      danger: true,
    })
    if (!ok) return
    try {
      await api.deletePost(post.id)
      toast('已删除')
      navigate('/forum', { replace: true })
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败', 'error')
    }
  }

  return (
    <>
      <NavBar title="帖子" back />
      <div className="page__body">
        {error ? (
          <EmptyState icon="info" title="找不到这条帖子" desc={error} />
        ) : !post ? (
          <p className="t-caption faint" style={{ marginTop: 16 }}>
            加载中…
          </p>
        ) : (
          <>
            <article className="post post--detail">
              <header className="post__head">
                <Link to={`/u/${post.uid}`} className="post__who">
                  <Avatar name={post.author} src={post.avatar} size={32} />
                  <span>
                    <span className="post__name-row">
                      <span className="post__name">{post.author}</span>
                      {post.badge ? <span className="svip">{post.badge}</span> : null}
                    </span>
                  </span>
                </Link>
                {post.mine ? (
                  <button type="button" className="act" onClick={() => void remove()}>
                    删除
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`follow-btn${post.following ? ' follow-btn--on' : ''}`}
                    onClick={() => void follow()}
                  >
                    {post.following ? '已关注' : '关注'}
                  </button>
                )}
              </header>

              <p className="post__date">
                {relativeTime(post.createdAt)}
                {post.mine ? ` · ${post.views} 次浏览` : ''}
              </p>

              <p className="post__text" style={{ marginTop: 10 }}>
                {post.body}
              </p>

              {post.images.length > 0 ? (
                <div className={`post__images post__images--${post.images.length}`}>
                  {post.images.map((img) => (
                    <img key={img} src={`/api/media/${img}`} alt="" />
                  ))}
                </div>
              ) : null}

              <footer className="post__actions">
                <button
                  type="button"
                  className={`act${post.liked ? ' act--on' : ''}`}
                  onClick={() => void like()}
                >
                  <Icon name="heart" size={15} filled={post.liked} />
                  {post.likes > 0 ? post.likes : '点赞'}
                </button>
                <span className="act">
                  <Icon name="info" size={15} />
                  评论
                </span>
                <span className="act">
                  <Icon name="share" size={15} />
                  分享
                </span>
              </footer>
            </article>

            <Comments targetType="post" targetId={post.id} />
          </>
        )}
      </div>
    </>
  )
}
