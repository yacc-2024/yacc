import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { NavBar } from '../components/ui'
import { api } from '../lib/api'
import { fileToDataUrl } from '../lib/imageFile'

const MAX = 500
const MAX_IMAGES = 3

export function NewPost() {
  const { account, toast } = useApp()
  const navigate = useNavigate()
  const [body, setBody] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const pick = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const room = MAX_IMAGES - images.length
    const picked = Array.from(files).slice(0, room)
    for (const file of picked) {
      try {
        const data = await fileToDataUrl(file)
        setImages((prev) => [...prev, data].slice(0, MAX_IMAGES))
      } catch (err) {
        toast(err instanceof Error ? err.message : '图片处理失败', 'error')
      }
    }
  }

  const publish = async () => {
    const text = body.trim()
    if (!text) {
      toast('写点什么吧', 'error')
      return
    }
    setBusy(true)
    try {
      const res = await api.createPost(text, images)
      toast('已发布')
      navigate(`/forum/${res.id}`, { replace: true })
    } catch (err) {
      toast(err instanceof Error ? err.message : '发布失败', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!account) {
    return (
      <>
        <NavBar title="发帖" back />
        <div className="page__body">
          <p className="t-caption faint" style={{ marginTop: 16 }}>
            登录后才能发帖。
          </p>
        </div>
      </>
    )
  }

  return (
    <>
      <NavBar title="发帖" back />
      <div className="page__body">
        <textarea
          className="composer__input"
          style={{ minHeight: 160, marginTop: 12 }}
          maxLength={MAX}
          value={body}
          placeholder="说点什么…"
          aria-label="帖子内容"
          onChange={(e) => setBody(e.target.value)}
        />

        <div className="row gap-2" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          {images.map((src, i) => (
            <span key={i} style={{ position: 'relative' }}>
              <img
                src={src}
                alt=""
                style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 12 }}
              />
              <button
                type="button"
                className="act"
                style={{ position: 'absolute', top: -6, right: -6 }}
                aria-label="移除图片"
                onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
              >
                ✕
              </button>
            </span>
          ))}
          {images.length < MAX_IMAGES ? (
            <button
              type="button"
              className="chip"
              style={{ width: 88, height: 88, borderRadius: 12 }}
              onClick={() => fileRef.current?.click()}
            >
              加图片
            </button>
          ) : null}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          aria-label="选择图片"
          onChange={(e) => {
            void pick(e.target.files)
            e.target.value = ''
          }}
        />

        <div className="between" style={{ marginTop: 14 }}>
          <span className="t-tag faint">
            {body.length}/{MAX} · 最多 {MAX_IMAGES} 张图
          </span>
          <button
            type="button"
            className="btn btn--primary"
            style={{ minHeight: 40, padding: '0 22px' }}
            disabled={busy || !body.trim()}
            onClick={() => void publish()}
          >
            {busy ? '发布中…' : '发布'}
          </button>
        </div>
      </div>
    </>
  )
}
