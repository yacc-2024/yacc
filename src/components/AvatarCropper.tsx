import { useEffect, useRef, useState } from 'react'
import { Sheet } from './ui'

const VIEW = 260
const OUTPUT = 256

/**
 * 头像裁剪：拖动调整位置、滑杆缩放，确认后才写回。
 */
export function AvatarCropper({
  file,
  onCancel,
  onConfirm,
}: {
  file: File | null
  onCancel: () => void
  onConfirm: (dataUrl: string) => void
}) {
  const [src, setSrc] = useState<string | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ x: number; y: number } | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!file) {
      setSrc(null)
      return
    }
    const url = URL.createObjectURL(file)
    const probe = new Image()
    let alive = true
    probe.onload = () => {
      if (!alive) return
      setSize({ w: probe.naturalWidth, h: probe.naturalHeight })
      setSrc(url)
      setZoom(1)
      setOffset({ x: 0, y: 0 })
    }
    probe.onerror = () => {
      if (!alive) return
      setSrc(null)
    }
    probe.src = url
    return () => {
      alive = false
      URL.revokeObjectURL(url)
    }
  }, [file])

  const base = size.w && size.h ? Math.max(VIEW / size.w, VIEW / size.h) : 1
  const scale = base * zoom

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    setOffset({
      x: e.clientX - dragRef.current.x,
      y: e.clientY - dragRef.current.y,
    })
  }

  const onPointerUp = () => {
    dragRef.current = null
  }

  const confirm = () => {
    const img = imgRef.current
    if (!img) return
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT
    canvas.height = OUTPUT
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const k = OUTPUT / VIEW
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, OUTPUT, OUTPUT)
    ctx.save()
    ctx.translate(OUTPUT / 2 + offset.x * k, OUTPUT / 2 + offset.y * k)
    ctx.scale(scale * k, scale * k)
    ctx.drawImage(img, -size.w / 2, -size.h / 2, size.w, size.h)
    ctx.restore()
    const data = canvas.toDataURL('image/jpeg', 0.86)
    if (data.length > 180_000) {
      ctx.fillStyle = '#fff'
      canvas.width = 160
      canvas.height = 160
      const ctx2 = canvas.getContext('2d')
      if (ctx2) ctx2.drawImage(img, 0, 0, 160, 160)
      onConfirm(canvas.toDataURL('image/jpeg', 0.8))
      return
    }
    onConfirm(data)
  }

  return (
    <Sheet
      open={!!file}
      title="调整头像"
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            取消
          </button>
          <button type="button" className="btn btn--primary" onClick={confirm}>
            用这张
          </button>
        </>
      }
    >
      <p className="t-caption faint" style={{ marginBottom: 12 }}>
        拖动图片调整位置，下面可以放大缩小。
      </p>

      <div
        className="cropper"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {src ? (
          <img
            ref={imgRef}
            src={src}
            alt="待裁剪的头像"
            draggable={false}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: size.w || 'auto',
              height: size.h || 'auto',
              maxWidth: 'none',
              maxHeight: 'none',
              transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})`,
              transformOrigin: 'center',
              touchAction: 'none',
              userSelect: 'none',
            }}
          />
        ) : null}
        <span className="cropper__ring" aria-hidden="true" />
      </div>

      <input
        className="range"
        type="range"
        min={1}
        max={3}
        step={0.02}
        value={zoom}
        aria-label="缩放"
        onChange={(e) => setZoom(Number(e.target.value))}
        style={{ marginTop: 14 }}
      />
    </Sheet>
  )
}
