import { useCallback, useMemo, useState } from 'react'
import { useConfirm } from './ui'
import { Icon } from './Icon'

/**
 * 批量选择 + 批量删除的通用逻辑。
 * 用法：const bulk = useBulk<string>()，然后把 bulk.toggle(id) 接到每行的选择框上。
 */
export function useBulk<T extends string>() {
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<T>>(new Set())

  const toggle = useCallback((id: T) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clear = useCallback(() => setSelected(new Set()), [])

  const exit = useCallback(() => {
    setSelected(new Set())
    setSelecting(false)
  }, [])

  const start = useCallback(() => setSelecting(true), [])

  const toggleAll = useCallback((ids: T[]) => {
    setSelected((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id))
      return allSelected ? new Set<T>() : new Set<T>(ids)
    })
  }, [])

  return {
    selecting,
    selected,
    count: selected.size,
    start,
    exit,
    clear,
    toggle,
    toggleAll,
    has: (id: T) => selected.has(id),
    list: useMemo(() => Array.from(selected), [selected]),
  }
}

/** 行左边的选择框 */
export function Pick({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: () => void
  label: string
}) {
  return (
    <button
      type="button"
      className={`pick${checked ? ' pick--on' : ''}`}
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
    >
      {checked ? <Icon name="check" size={14} /> : null}
    </button>
  )
}

/** 底部操作条 */
export function BulkBar({
  count,
  onSelectAll,
  onCancel,
  onDelete,
  busy,
}: {
  count: number
  onSelectAll?: () => void
  onCancel: () => void
  onDelete: () => void
  busy?: boolean
}) {
  return (
    <div className="bulkbar" role="region" aria-label="批量操作">
      <span className="bulkbar__count">已选 {count} 项</span>
      <span className="grow" />
      {onSelectAll ? (
        <button type="button" className="linklike" onClick={onSelectAll}>
          全选
        </button>
      ) : null}
      <button type="button" className="linklike faint" onClick={onCancel}>
        取消
      </button>
      <button
        type="button"
        className="btn btn--danger"
        style={{ minHeight: 36, padding: '0 16px' }}
        disabled={count === 0 || busy}
        onClick={onDelete}
      >
        {busy ? '删除中…' : '删除'}
      </button>
    </div>
  )
}

/** 删除前的二次确认，统一话术 */
export function useBulkDelete() {
  const confirm = useConfirm()
  return useCallback(
    async (count: number, what: string) =>
      confirm({
        title: `删除选中的 ${count} ${what}？`,
        message: '删除后无法恢复。发布前还可以用「清除本地草稿」整体撤回。',
        confirmText: '批量删除',
        danger: true,
      }),
    [confirm],
  )
}
