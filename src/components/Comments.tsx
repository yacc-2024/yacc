import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { api, type CommentItem } from '../lib/api'
import { Icon } from './Icon'
import { Avatar } from './ui'
import { useConfirm } from './ui'
import { relativeTime } from '../lib/format'
import { usePolling } from '../hooks/usePolling'

const MAX = 200

export function LikeButton({
  targetType,
  targetId,
}: {
  targetType: 'episode' | 'extra'
  targetId: string
}) {
  const { mode, account, toast } = useApp()
  const [count, setCount] = useState(0)
  const [mine, setMine] = useState(false)
  const [pop, setPop] = useState(false)
  const lastClick = useRef(0)

  useEffect(() => {
    if (mode !== 'online') return
    let alive = true
    void api
      .reactions(targetType, targetId)
      .then((r) => {
        if (!alive) return
        setCount(r.count)
        setMine(r.mine)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [mode, targetType, targetId, account])

  if (mode !== 'online') return null

  const onToggle = async () => {
    const now = Date.now()
    if (now - lastClick.current < 700) {
      toast('请勿频繁点击', 'error')
      return
    }
    lastClick.current = now
    if (!account) {
      toast('登录后才能点赞', 'error')
      return
    }
    try {
      const r = await api.toggleReaction(targetType, targetId)
      setCount(r.count)
      setMine(r.active)
      if (r.active) {
        setPop(true)
        window.setTimeout(() => setPop(false), 340)
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : '操作失败', 'error')
    }
  }

  return (
    <button
      type="button"
      className={`iconbtn${pop ? ' iconbtn--pop' : ''}`}
      aria-pressed={mine}
      aria-label={mine ? '取消点赞' : '点赞'}
      onClick={() => void onToggle()}
    >
      <Icon name="heart" size={20} filled={mine} />
      {count > 0 ? count : '点赞'}
    </button>
  )
}

export function Comments({
  targetType,
  targetId,
}: {
  targetType: 'episode' | 'extra'
  targetId: string
}) {
  const { mode, account, toast } = useApp()
  const confirm = useConfirm()
  const isAdmin = account?.role === 'admin' || account?.role === 'superadmin'

  const [items, setItems] = useState<CommentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [moderation, setModeration] = useState<'on' | 'off'>('on')
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    if (mode !== 'online') {
      setLoading(false)
      return
    }
    try {
      const res = await api.comments(targetType, targetId)
      setItems(res.comments)
      const settings = await api.settings().catch(() => null)
      if (settings) setModeration(settings.moderation === 'off' ? 'off' : 'on')
    } catch {
      /* 静默：评论加载失败不该影响看片 */
    } finally {
      setLoading(false)
    }
  }, [mode, targetType, targetId])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  // 别人新发的评论会自动出现（页面在前台时每 12 秒拉一次）
  usePolling(() => load(), 12_000, mode === 'online')

  if (mode !== 'online') return null

  const markBusy = (id: string, on: boolean) =>
    setBusy((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  const send = async (parentId?: string) => {
    const text = body.trim()
    if (!text) return
    if (sending) {
      toast('请勿频繁点击', 'error')
      return
    }
    if (text.length > MAX) {
      toast(`最多 ${MAX} 个字`, 'error')
      return
    }
    setSending(true)
    try {
      const res = parentId
        ? await api.replyComment({ targetType, targetId, body: text, parentId })
        : await api.postComment(targetType, targetId, text)
      setBody('')
      setReplyTo(null)
      if (res.status === 'pending') {
        toast('已提交，审核通过后显示')
      } else {
        toast(parentId ? '回复已发布' : '评论已发布')
        await load()
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : '发送失败', 'error')
    } finally {
      setSending(false)
    }
  }

  const like = async (c: CommentItem) => {
    if (!account) {
      toast('登录后才能点赞', 'error')
      return
    }
    if (busy.has(c.id)) return
    markBusy(c.id, true)
    // 先动界面，失败再回滚
    const patch = (list: CommentItem[]) =>
      list.map((x) =>
        x.id === c.id ? { ...x, liked: !x.liked, likes: x.likes + (x.liked ? -1 : 1) } : x,
      )
    setItems((prev) => patch(prev).map((x) => ({ ...x, replies: x.replies ? patch(x.replies) : x.replies })))
    try {
      await api.likeComment(c.id)
    } catch (err) {
      setItems((prev) => patch(prev).map((x) => ({ ...x, replies: x.replies ? patch(x.replies) : x.replies })))
      toast(err instanceof Error ? err.message : '点赞失败', 'error')
    } finally {
      markBusy(c.id, false)
    }
  }

  const pin = async (c: CommentItem) => {
    markBusy(c.id, true)
    try {
      await api.pinComment(c.id, !c.pinned)
      toast(c.pinned ? '已取消置顶' : '已置顶')
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : '操作失败', 'error')
    } finally {
      markBusy(c.id, false)
    }
  }

  const remove = async (id: string) => {
    const ok = await confirm({
      title: '删除这条评论？',
      message: '楼内回复也会一起删除，不可恢复。',
      confirmText: '删除',
      danger: true,
    })
    if (!ok) return
    try {
      await api.deleteComment(id)
      toast('已删除')
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败', 'error')
    }
  }

  const total = items.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0)

  const renderReply = (c: CommentItem) => (
    <div key={c.id} className="reply">
      <div className="reply__head">
        <Link to={`/u/${c.uid}`} className="comment__who reply__who">
          <Avatar name={c.author} src={c.avatar} size={32} />
          <span className="comment__author">{c.author}</span>
        </Link>
        {c.replyToName ? <span className="reply__to">回复 @{c.replyToName}</span> : null}
        <span className="grow" />
        <span className="comment__time">{relativeTime(c.createdAt)}</span>
      </div>
      <p className="reply__body">{c.body}</p>
      <div className="comment__actions">
        <button
          type="button"
          className={`act${c.liked ? ' act--on' : ''}`}
          aria-label={c.liked ? '取消点赞' : '点赞'}
          onClick={() => void like(c)}
        >
          <Icon name="heart" size={13} filled={c.liked} />
          {c.likes > 0 ? c.likes : ''}
        </button>
        <button type="button" className="act" onClick={() => setReplyTo({ id: c.id, name: c.author })}>
          回复
        </button>
        {c.mine || isAdmin ? (
          <button type="button" className="act faint" onClick={() => void remove(c.id)}>
            删除
          </button>
        ) : null}
      </div>
      {replyTo?.id === c.id ? (
        <div className="reply__composer">
          <input
            className="composer__input"
            maxLength={MAX}
            value={body}
            placeholder={`回复 @${c.author}`}
            aria-label="写回复"
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void send(c.id)
            }}
          />
          <button
            type="button"
            className="btn btn--primary"
            style={{ minHeight: 36, padding: '0 16px' }}
            disabled={sending || !body.trim()}
            onClick={() => void send(c.id)}
          >
            发送
          </button>
        </div>
      ) : null}
    </div>
  )

  return (
    <section className="comments">
      <div className="section__head" style={{ marginBottom: 10 }}>
        <h2 className="section__title">评论</h2>
        <span className="count">{total} 条</span>
      </div>

      {!account ? (
        <p className="t-caption faint">登录并通过认证后才能评论。</p>
      ) : !account.verified ? (
        <p className="t-caption faint">你的账号还没有通过认证，暂时只能浏览。</p>
      ) : (
        <div className="composer">
          <Avatar name={account.name} src={account.avatar} size={32} />
          <div className="grow">
            <textarea
              className="composer__input"
              maxLength={MAX}
              value={body}
              placeholder="说点什么…"
              aria-label="写评论"
              onChange={(e) => setBody(e.target.value)}
              rows={2}
            />
            <div className="between" style={{ marginTop: 8 }}>
              <span className="t-tag faint">
                {body.length}/{MAX}
                {moderation === 'on' ? ' · 发布后需审核' : ''}
              </span>
              <button
                type="button"
                className="btn btn--primary"
                style={{ minHeight: 38, padding: '0 20px' }}
                disabled={sending || !body.trim()}
                onClick={() => void send()}
              >
                {sending ? '发送中…' : '发布'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        {loading ? (
          <p className="t-caption faint">加载中…</p>
        ) : items.length === 0 ? (
          <p className="t-caption faint">还没有人评论。</p>
        ) : (
          items.map((c) => {
            const replies = c.replies ?? []
            const isOpen = expanded.has(c.id)
            const shown = isOpen ? replies : replies.slice(0, 2)
            const rest = replies.length - shown.length

            return (
              <div key={c.id} className={`comment${c.pinned ? ' comment--pinned' : ''}`}>
                {c.pinned ? <span className="pin-badge">置顶</span> : null}

                <div className="comment__head">
                  <Link to={`/u/${c.uid}`} className="comment__who" aria-label={`查看 ${c.author} 的主页`}>
                    <Avatar name={c.author} src={c.avatar} size={32} />
                    <span className="comment__author">{c.author}</span>
                  </Link>
                  <span className="comment__time">{relativeTime(c.createdAt)}</span>
                </div>

                <p className="comment__body">{c.body}</p>

                <div className="comment__actions">
                  <button
                    type="button"
                    className={`act${c.liked ? ' act--on' : ''}`}
                    aria-label={c.liked ? '取消点赞' : '点赞'}
                    onClick={() => void like(c)}
                  >
                    <Icon name="heart" size={14} filled={c.liked} />
                    {c.likes > 0 ? c.likes : ''}
                  </button>
                  <button
                    type="button"
                    className="act"
                    onClick={() => setReplyTo({ id: c.id, name: c.author })}
                  >
                    回复
                  </button>
                  {isAdmin ? (
                    <button type="button" className="act faint" onClick={() => void pin(c)}>
                      {c.pinned ? '取消置顶' : '置顶'}
                    </button>
                  ) : null}
                  {c.mine || isAdmin ? (
                    <button type="button" className="act faint" onClick={() => void remove(c.id)}>
                      删除
                    </button>
                  ) : null}
                </div>

                {replies.length > 0 ? (
                  <div className="replies">
                    {shown.map(renderReply)}
                    {rest > 0 || isOpen ? (
                      <button
                        type="button"
                        className="replies__more"
                        onClick={() =>
                          setExpanded((prev) => {
                            const next = new Set(prev)
                            if (next.has(c.id)) next.delete(c.id)
                            else next.add(c.id)
                            return next
                          })
                        }
                      >
                        {isOpen ? '收起回复' : `展开其余 ${rest} 条回复`}
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {replyTo?.id === c.id ? (
                  <div className="reply__composer">
                    <input
                      className="composer__input"
                      maxLength={MAX}
                      value={body}
                      placeholder={`回复 @${c.author}`}
                      aria-label="写回复"
                      onChange={(e) => setBody(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void send(c.id)
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn--primary"
                      style={{ minHeight: 36, padding: '0 16px' }}
                      disabled={sending || !body.trim()}
                      onClick={() => void send(c.id)}
                    >
                      发送
                    </button>
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
