import { useId, type ReactNode } from 'react'

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint ? <p className="field__hint">{hint}</p> : null}
    </div>
  )
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
  type?: string
}) {
  const id = useId()
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="input"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint ? <p className="field__hint">{hint}</p> : null}
    </div>
  )
}

export function NumberField({
  label,
  value,
  onChange,
  hint,
  min = 0,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  hint?: string
  min?: number
}) {
  const id = useId()
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="input"
        type="number"
        min={min}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint ? <p className="field__hint">{hint}</p> : null}
    </div>
  )
}

export function TextAreaField({
  label,
  value,
  onChange,
  hint,
  rows = 4,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  hint?: string
  rows?: number
}) {
  const id = useId()
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        className="textarea"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint ? <p className="field__hint">{hint}</p> : null}
    </div>
  )
}

export function MultiChips({
  label,
  options,
  value,
  onChange,
  hint,
}: {
  label: string
  options: string[]
  value: string[]
  onChange: (v: string[]) => void
  hint?: string
}) {
  const toggle = (o: string) => {
    onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o])
  }
  return (
    <Field label={label} hint={hint}>
      <div className="chips">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            className="chip"
            aria-pressed={value.includes(o)}
            onClick={() => toggle(o)}
          >
            {o}
          </button>
        ))}
      </div>
    </Field>
  )
}

export function NumberChips({
  label,
  options,
  value,
  onChange,
  hint,
}: {
  label: string
  options: number[]
  value: number[]
  onChange: (v: number[]) => void
  hint?: string
}) {
  const toggle = (o: number) => {
    onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o])
  }
  return (
    <Field label={label} hint={hint}>
      <div className="chips">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            className="chip"
            aria-pressed={value.includes(o)}
            onClick={() => toggle(o)}
          >
            第{o}季
          </button>
        ))}
      </div>
    </Field>
  )
}
