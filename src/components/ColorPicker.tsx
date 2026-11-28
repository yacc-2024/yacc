import { useRef, useState } from 'react'

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const to = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

/** 调色盘：上方色板 + 下方色相条 */
export function ColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (hex: string) => void
}) {
  const [hue, setHue] = useState(200)
  const [sat, setSat] = useState(0.8)
  const [val, setVal] = useState(1)
  const areaRef = useRef<HTMLDivElement>(null)

  const pick = (clientX: number, clientY: number) => {
    const el = areaRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height))
    setSat(x)
    setVal(1 - y)
    onChange(hsvToHex(hue, x, 1 - y))
  }

  return (
    <div className="picker">
      <div
        className="picker__area"
        ref={areaRef}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          pick(e.clientX, e.clientY)
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) pick(e.clientX, e.clientY)
        }}
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hue} 100% 50%))`,
        }}
      >
        <span
          className="picker__knob"
          style={{
            left: `${sat * 100}%`,
            top: `${(1 - val) * 100}%`,
          }}
        />
      </div>

      <input
        className="picker__hue"
        type="range"
        min={0}
        max={359}
        value={hue}
        aria-label="色相"
        onChange={(e) => {
          const h = Number(e.target.value)
          setHue(h)
          onChange(hsvToHex(h, sat, val))
        }}
      />

      <div className="picker__preview">
        <span className="picker__swatch" style={{ background: value }} />
        <span className="t-caption faint">{value.toUpperCase()}</span>
      </div>
    </div>
  )
}
