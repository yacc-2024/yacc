import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { api } from '../lib/api'
import { Icon } from './Icon'
import { Avatar } from './ui'
import { useConfirm } from './ui'
import { formatDateTime } from '../lib/format'

interface CommentItem {
  id: string
  body: string
  createdAt: string
  author: string
  avatar: string | null
  uid: string
  mine: boolean
}

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

  const [items, setItems] = useState<CommentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [moderation, setModeration] = useState<'on' | 'off'>('on')

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

  if (mode !== 'online') return null

  const send = async () => {
    const text = body.trim()
    if (!text) return
    if (text.length > MAX) {
      toast(`最多 ${MAX} 个字`, 'error')
      return
    }
    setSending(true)
    try {
      const res = await api.postComment(targetType, targetId, text)
      setBody('')
      if (res.status === 'pending') {
        toast('已提交，审核通过后显示')
      } else {
        toast('评论已发布')
        await load()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '发送失败'
      toast(message, 'error')
    } finally {
      setSending(false)
    }
  }

  const remove = async (id: string) => {
    const ok = await confirm({
      title: '删除这条评论？',
      message: '删除后不可恢复。',
      confirmText: '删除',
      danger: true,
    })
    if (!ok) return
    try {
      await api.deleteComment(id)
      setItems((prev) => prev.filter((c) => c.id !== id))
      toast('已删除')
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败', 'error')
    }
  }

  return (
    <section className="comments">
      <div className="section__head" style={{ marginBottom: 10 }}>
        <h2 className="section__title">评论</h2>
        <span className="count">{items.length} 条</span>
      </div>

      {!account ? (
        <p className="t-caption faint">登录并通过学校认证后才能评论。</p>
      ) : !account.verified ? (
        <p className="t-caption faint">
          你的账号还没有通过认证，暂时只能浏览。
        </p>
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
          items.map((c) => (
            <div key={c.id} className="comment">
              <Link to={`/u/${c.uid}`} className="comment__who" aria-label={`查看 ${c.author} 的主页`}>
                <Avatar name={c.author} src={c.avatar} size={32} />
                <span className="grow">
                  <span className="comment__author">{c.author}</span>
                  <span className="t-tag faint t-num" style={{ display: 'block' }}>
                    ID {c.uid} · {formatDateTime(c.createdAt)}
                  </span>
                </span>
              </Link>
              <p className="comment__body">{c.body}</p>
              {c.mine ? (
                <button
                  type="button"
                  className="linklike"
                  style={{ minHeight: 32, color: 'var(--text-3)' }}
                  onClick={() => void remove(c.id)}
                >
                  删除
                </button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  )
}
