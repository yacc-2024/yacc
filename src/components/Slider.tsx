import { useRef } from 'react'

/**
 * 自定义滑块：
 * - 按住轨道任意位置即可拖动
 * - 拖动时手指上下移动也不会中断（指针被捕获）
 */
export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  label: string
}) {
  const trackRef = useRef<HTMLDivElement>(null)

  const setFromX = (clientX: number) => {
    const el = trackRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    const raw = min + ratio * (max - min)
    const snapped = Math.round(raw / step) * step
    onChange(Math.min(max, Math.max(min, snapped)))
  }

  const percent = ((value - min) / (max - min)) * 100

  return (
    <div
      className="slider"
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        setFromX(e.clientX)
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1 || e.pointerType === 'touch') setFromX(e.clientX)
      }}
      ref={trackRef}
    >
      <span className="slider__rail" />
      <span className="slider__fill" style={{ width: `${percent}%` }} />
      <span className="slider__knob" style={{ left: `${percent}%` }} />
    </div>
  )
}
