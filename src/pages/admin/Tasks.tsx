import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../../state/AppContext'
import { NavBar, Sheet } from '../../components/ui'
import { api } from '../../lib/api'

type Task = { kind: string; title: string; points: number; dailyLimit: number; active: boolean }

export function TasksAdmin() {
  const { toast } = useApp()
  const [list, setList] = useState<Task[]>([])
  const [editing, setEditing] = useState<Task | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await api.adminTasks()
      setList(res.tasks)
    } catch (err) {
      toast(err instanceof Error ? err.message : '加载失败', 'error')
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const save = async (t: Task) => {
    try {
      await api.saveTask(t)
      toast('已保存')
      setEditing(null)
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', 'error')
    }
  }

  return (
    <>
      <NavBar title="积分任务" back />
      <div className="page__body">
        <p className="t-caption faint" style={{ marginTop: 12 }}>
          每次触发给多少分、每天最多算几次，改完立刻生效。
        </p>
        <div className="list" style={{ marginTop: 12 }}>
          {list.map((t) => (
            <button
              key={t.kind}
              type="button"
              className="list__row"
              onClick={() => setEditing(t)}
            >
              <span className="grow" style={{ textAlign: 'left' }}>
                <span className="list__title" style={{ display: 'block' }}>
                  {t.title}
                  {!t.active ? <span className="t-tag faint"> · 已停用</span> : null}
                </span>
                <span className="list__sub">
                  每次 +{t.points} 分 · 每天最多 {t.dailyLimit} 次
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <Sheet open={!!editing} title="编辑任务" onClose={() => setEditing(null)}>
        {editing ? (
          <div className="stack">
            <div className="field">
              <label className="field__label" htmlFor="t-title">
                名称
              </label>
              <input
                id="t-title"
                className="input"
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="t-points">
                每次给多少分
              </label>
              <input
                id="t-points"
                className="input"
                type="number"
                value={editing.points}
                onChange={(e) => setEditing({ ...editing, points: Number(e.target.value) })}
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="t-limit">
                每天最多几次
              </label>
              <input
                id="t-limit"
                className="input"
                type="number"
                value={editing.dailyLimit}
                onChange={(e) => setEditing({ ...editing, dailyLimit: Number(e.target.value) })}
              />
            </div>
            <div className="field">
              <span className="field__label">状态</span>
              <div className="chips">
                <button
                  type="button"
                  className="chip"
                  aria-pressed={editing.active}
                  onClick={() => setEditing({ ...editing, active: true })}
                >
                  启用
                </button>
                <button
                  type="button"
                  className="chip"
                  aria-pressed={!editing.active}
                  onClick={() => setEditing({ ...editing, active: false })}
                >
                  停用
                </button>
              </div>
            </div>
            <button type="button" className="btn btn--primary" onClick={() => void save(editing)}>
              保存
            </button>
          </div>
        ) : null}
      </Sheet>
    </>
  )
}
