import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { NavBar, EmptyState, Sheet } from '../components/ui'
import { Comments } from '../components/Comments'
import { Icon } from '../components/Icon'
import { ForumCard } from '../components/ForumCard'
import { PullToRefresh, Spinner } from '../components/PullToRefresh'
import { api, type ForumPost } from '../lib/api'
import { usePolling } from '../hooks/usePolling'

let forumCache: ForumPost[] | null = null

export function Forum() {
  const { mode, account, toast } = useApp()
  const [posts, setPosts] = useState<ForumPost[]>(forumCache ?? [])
  const [loading, setLoading] = useState(!forumCache)
  const [commentFor, setCommentFor] = useState<ForumPost | null>(null)

  const load = useCallback(async () => {
    if (mode !== 'online') {
      setLoading(false)
      return
    }
    try {
      const res = await api.posts()
      forumCache = res.posts
      setPosts(res.posts)
    } catch {
      /* 忽略 */
    } finally {
      setLoading(false)
    }
  }, [mode])

  useEffect(() => {
    void load()
  }, [load])

  usePolling(() => load(), 15_000, mode === 'online')

  const like = async (p: ForumPost) => {
    if (!account) {
      toast('登录后才能点赞', 'error')
      return
    }
    setPosts((prev) =>
      prev.map((x) =>
        x.id === p.id ? { ...x, liked: !x.liked, likes: x.likes + (x.liked ? -1 : 1) } : x,
      ),
    )
    try {
      await api.likePost(p.id)
    } catch {
      void load()
    }
  }

  const follow = async (p: ForumPost) => {
    if (!account) {
      toast('登录后才能关注', 'error')
      return
    }
    try {
      const res = await api.follow(p.authorId, p.following ? 'unfollow' : 'follow')
      setPosts((prev) =>
        prev.map((x) => (x.authorId === p.authorId ? { ...x, following: res.following } : x)),
      )
      toast(res.following ? `已关注 ${p.author}` : '已取消关注')
    } catch (err) {
      toast(err instanceof Error ? err.message : '操作失败', 'error')
    }
  }

  return (
    <>
      <NavBar
        title="论坛"
        large
        action={
          <Link to="/forum/new" className="nav__action" aria-label="发帖">
            <Icon name="plus" size={22} />
          </Link>
        }
      />
      <div className="page__body">
        <PullToRefresh onRefresh={load}>

        {loading ? (
          <Spinner label="正在加载帖子" />
        ) : posts.length === 0 ? (
          <EmptyState icon="info" title="还没有人发帖" desc="点右上角发第一帖。" />
        ) : (
          posts.map((p) => (
            <ForumCard
              key={p.id}
              post={p}
              onLike={() => void like(p)}
              onFollow={() => void follow(p)}
              onComment={() => setCommentFor(p)}
              onDelete={async () => {
                try {
                  await api.deletePost(p.id)
                  toast('已删除')
                  await load()
                } catch (err) {
                  toast(err instanceof Error ? err.message : '删除失败', 'error')
                }
              }}
              isAdmin={account?.role === 'admin' || account?.role === 'superadmin'}
              onPin={async () => {
                try {
                  await api.pinPost(p.id, !p.pinned)
                  toast(p.pinned ? '已取消置顶' : '已置顶')
                  await load()
                } catch (err) {
                  toast(err instanceof Error ? err.message : '操作失败', 'error')
                }
              }}
            />
          ))
        )}
        </PullToRefresh>
      </div>

      <Sheet
        open={!!commentFor}
        title={commentFor ? `${commentFor.author} 的帖子` : '评论'}
        onClose={() => setCommentFor(null)}
      >
        {commentFor ? (
          <div style={{ maxHeight: '62vh', overflowY: 'auto' }}>
            <p className="post__text" style={{ marginBottom: 12 }}>{commentFor.body}</p>
            <Comments targetType="post" targetId={commentFor.id} />
          </div>
        ) : null}
      </Sheet>
    </>
  )
}
