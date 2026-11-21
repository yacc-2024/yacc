import { useState } from 'react'
import { useApp } from '../../state/AppContext'
import { NavBar, Sheet, useConfirm } from '../../components/ui'
import { DirtyBanner } from '../../components/DirtyBanner'
import { useBulk, Pick, BulkBar, useBulkDelete } from '../../components/BulkSelect'
import { Icon } from '../../components/Icon'
import { TextField } from '../../components/form'
import { formatDate } from '../../lib/format'
import { todayInput } from '../../lib/datetime'
import type { ChangelogEntry } from '../../data/schema'

export function ChangelogAdmin() {
  const { content, updateContent, toast } = useApp()
  const confirm = useConfirm()
  const c = content!
  const [editing, setEditing] = useState<ChangelogEntry | 'new' | null>(null)
  const bulk = useBulk<string>()
  const askBulkDelete = useBulkDelete()
  const [deleting, setDeleting] = useState(false)

  const list = [...c.changelog].reverse()

  const save = async (entry: ChangelogEntry) => {
    await updateContent((prev) => {
      const exists = prev.changelog.some((x) => x.version === entry.version)
      return {
        ...prev,
        changelog: exists
          ? prev.changelog.map((x) => (x.version === entry.version ? entry : x))
          : [...prev.changelog, entry],
      }
    })
    setEditing(null)
    toast('更新日志已保存')
  }

  const remove = async (version: string) => {
    const ok = await confirm({
      title: `删除 ${version}？`,
      message: '删除后无法恢复。发布前还可以用「清除本地草稿」整体撤回。',
      confirmText: '删除',
      danger: true,
    })
    if (!ok) return
    await updateContent((prev) => ({
      ...prev,
      changelog: prev.changelog.filter((x) => x.version !== version),
    }))
    setEditing(null)
    toast('已删除')
  }

  const removeMany = async () => {
    if (bulk.count === 0) return
    const ok = await askBulkDelete(bulk.count, '个版本')
    if (!ok) return
    setDeleting(true)
    try {
      const picked = new Set(bulk.list)
      await updateContent((prev) => ({
        ...prev,
        changelog: prev.changelog.filter((x) => !picked.has(x.version)),
      }))
      toast(`已删除 ${picked.size} 个版本`)
      bulk.exit()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <NavBar
        title={bulk.selecting ? '选择版本' : '更新日志'}
        back
        action={
          bulk.selecting ? (
            <button type="button" className="nav__action" onClick={bulk.exit}>
              取消
            </button>
          ) : (
            <div className="row gap-3">
              <button
                type="button"
                className="nav__action"
                onClick={bulk.start}
                disabled={list.length === 0}
              >
                选择
              </button>
              <button
                type="button"
                className="nav__action"
                aria-label="新增版本"
                onClick={() => setEditing('new')}
              >
                <Icon name="plus" size={22} />
              </button>
            </div>
          )
        }
      />
      <DirtyBanner />
      <div className="page__body">
        <p className="t-caption faint" style={{ marginTop: 8, lineHeight: 1.6 }}>
          这里写的会出现在「我的 → 版本与更新日志」里，所有人都能看到。
        </p>

        {list.length === 0 ? (
          <p className="t-caption faint" style={{ marginTop: 20 }}>
            还没有记录，点右上角加一个。
          </p>
        ) : (
          <div className="list" style={{ marginTop: 16 }}>
            {list.map((entry) => (
              <div
                key={entry.version}
                className="list__row list__row--plain"
                style={{ alignItems: 'flex-start', paddingBlock: 14 }}
              >
                {bulk.selecting ? (
                  <Pick
                    checked={bulk.has(entry.version)}
                    onChange={() => bulk.toggle(entry.version)}
                    label={`选择 ${entry.version}`}
                  />
                ) : null}
                <button
                  type="button"
                  className="grow"
                  style={{ textAlign: 'left', background: 'none', border: 0 }}
                  onClick={() => {
                    if (bulk.selecting) bulk.toggle(entry.version)
                    else setEditing(entry)
                  }}
                >
                <span className="grow" style={{ textAlign: 'left' }}>
                  <span className="list__title" style={{ display: 'block' }}>
                    {entry.version}
                    <span className="t-tag faint" style={{ marginLeft: 8 }}>
                      {formatDate(entry.date)}
                    </span>
                  </span>
                  <span className="list__sub" style={{ display: 'block' }}>
                    {entry.items.length} 条改动
                  </span>
                </span>
                </button>
                <Icon name="chevron-right" size={18} />
              </div>
            ))}
          </div>
        )}
      </div>

      {bulk.selecting ? (
        <BulkBar
          count={bulk.count}
          onSelectAll={() => bulk.toggleAll(list.map((x) => x.version))}
          onCancel={bulk.exit}
          onDelete={() => void removeMany()}
          busy={deleting}
        />
      ) : null}

      {editing ? (
        <ChangelogForm
          initial={editing === 'new' ? null : editing}
          existingVersions={c.changelog.map((x) => x.version)}
          onClose={() => setEditing(null)}
          onSave={(entry) => void save(entry)}
          onDelete={(version) => void remove(version)}
        />
      ) : null}
    </>
  )
}

function ChangelogForm({
  initial,
  existingVersions,
  onClose,
  onSave,
  onDelete,
}: {
  initial: ChangelogEntry | null
  existingVersions: string[]
  onClose: () => void
  onSave: (entry: ChangelogEntry) => void
  onDelete: (version: string) => void
}) {
  const [version, setVersion] = useState(initial?.version ?? '')
  const [date, setDate] = useState(initial?.date ?? todayInput())
  const [items, setItems] = useState((initial?.items ?? []).join('\n'))
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const v = version.trim()
    if (!v) {
      setError('版本号不能为空，比如 1.0.1')
      return
    }
    if (v !== initial?.version && existingVersions.includes(v)) {
      setError('这个版本号已经有了')
      return
    }
    const lines = items
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    if (lines.length === 0) {
      setError('至少写一条改动')
      return
    }
    onSave({ version: v, date, items: lines })
  }

  return (
    <Sheet
      open
      title={initial ? '编辑版本' : '新增版本'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn btn--primary" onClick={submit}>
            保存
          </button>
        </>
      }
    >
      <div className="row gap-2">
        <div style={{ flex: 1 }}>
          <TextField label="版本号" value={version} onChange={setVersion} placeholder="1.0.1" />
        </div>
        <div style={{ flex: 1 }}>
          <TextField label="日期" value={date} onChange={setDate} type="date" />
        </div>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="changelog-items">
          改动内容
        </label>
        <textarea
          id="changelog-items"
          className="textarea"
          style={{ minHeight: 140 }}
          value={items}
          onChange={(e) => setItems(e.target.value)}
          placeholder={'一行一条，比如：\n更新日志支持在线编辑\n账号可以改头像了'}
        />
        <p className="field__hint">一行一条，保存时会自动去掉空行。</p>
      </div>

      {error ? <p className="error-line">{error}</p> : null}

      {initial ? (
        <button
          type="button"
          className="btn btn--ghost btn--block"
          style={{ marginTop: 16, color: 'var(--danger)' }}
          onClick={() => onDelete(initial.version)}
        >
          删除这个版本
        </button>
      ) : null}
    </Sheet>
  )
}
