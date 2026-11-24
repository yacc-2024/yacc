import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../../state/AppContext'
import { NavBar, Sheet, useConfirm } from '../../components/ui'
import { api } from '../../lib/api'

type Product = {
  id: string
  title: string
  description: string
  price: number
  currency: string
  kind: string
  value: string | null
  durationDays: number
  active: boolean
  sort: number
}

const EMPTY: Product = {
  id: '',
  title: '',
  description: '',
  price: 100,
  currency: 'points',
  kind: 'nameplate',
  value: 'vip',
  durationDays: 7,
  active: true,
  sort: 0,
}

export function ProductsAdmin() {
  const { toast } = useApp()
  const confirm = useConfirm()
  const [list, setList] = useState<Product[]>([])
  const [editing, setEditing] = useState<Product | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    try {
      const res = await api.adminProducts()
      setList(res.products)
    } catch (err) {
      toast(err instanceof Error ? err.message : '加载失败', 'error')
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const save = async (p: Product) => {
    try {
      await api.saveProduct({
        id: p.id || undefined,
        title: p.title,
        description: p.description,
        price: p.price,
        currency: p.currency,
        kind: p.kind,
        value: p.value,
        durationDays: p.durationDays,
        active: p.active,
        sort: p.sort,
      })
      toast('已保存')
      setEditing(null)
      await load()
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', 'error')
    }
  }

  const toggleAll = async (active: boolean) => {
    if (selected.size === 0) return
    try {
      await api.batchProducts([...selected], active)
      setSelected(new Set())
      await load()
      toast(active ? '已批量上架' : '已批量下架')
    } catch (err) {
      toast(err instanceof Error ? err.message : '操作失败', 'error')
    }
  }

  return (
    <>
      <NavBar
        title="商品管理"
        back
        action={
          <button
            type="button"
            className="nav__action"
            aria-label="新增商品"
            onClick={() => setEditing({ ...EMPTY })}
          >
            ＋
          </button>
        }
      />
      <div className="page__body">
        {selected.size > 0 ? (
          <div className="bulkbar" style={{ marginTop: 12 }}>
            <span className="grow t-caption">已选 {selected.size} 件</span>
            <button type="button" className="linklike" onClick={() => void toggleAll(true)}>
              批量上架
            </button>
            <button type="button" className="linklike" onClick={() => void toggleAll(false)}>
              批量下架
            </button>
          </div>
        ) : null}

        <div className="list" style={{ marginTop: 12 }}>
          {list.map((p) => (
            <div key={p.id} className="list__row list__row--plain">
              <button
                type="button"
                className={`check${selected.has(p.id) ? ' check--on' : ''}`}
                aria-label={`选择 ${p.title}`}
                aria-pressed={selected.has(p.id)}
                onClick={() =>
                  setSelected((prev) => {
                    const next = new Set(prev)
                    if (next.has(p.id)) next.delete(p.id)
                    else next.add(p.id)
                    return next
                  })
                }
              />
              <button
                type="button"
                className="grow"
                style={{ textAlign: 'left', background: 'none', border: 0 }}
                onClick={() => setEditing(p)}
              >
                <span className="list__title" style={{ display: 'block' }}>
                  {p.title}
                  {!p.active ? <span className="t-tag faint"> · 已下架</span> : null}
                </span>
                <span className="list__sub">
                  {p.price} {p.currency === 'member' ? '会员积分' : '积分'} ·{' '}
                  {p.kind === 'avatar_frame' ? '头像框' : p.kind === 'nameplate' ? '铭牌' : p.kind} ·{' '}
                  {p.durationDays > 0 ? `${p.durationDays} 天` : '永久'}
                </span>
              </button>
              <button
                type="button"
                className="linklike"
                onClick={async () => {
                  const ok = await confirm({
                    title: `删除「${p.title}」？`,
                    message: '删除后已兑换的记录还在，但商品不再出现。',
                    confirmText: '删除',
                    danger: true,
                  })
                  if (!ok) return
                  try {
                    await api.deleteProduct(p.id)
                    await load()
                    toast('已删除')
                  } catch (err) {
                    toast(err instanceof Error ? err.message : '删除失败', 'error')
                  }
                }}
              >
                删除
              </button>
            </div>
          ))}
        </div>

        {list.length === 0 ? (
          <p className="t-caption faint" style={{ marginTop: 20 }}>
            还没有商品，点右上角 ＋ 新增
          </p>
        ) : null}
      </div>

      <Sheet
        open={!!editing}
        title={editing?.id ? '编辑商品' : '新增商品'}
        onClose={() => setEditing(null)}
      >
        {editing ? (
          <div className="stack">
            <div className="field">
              <label className="field__label" htmlFor="p-title">
                名称
              </label>
              <input
                id="p-title"
                className="input"
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="p-desc">
                说明
              </label>
              <input
                id="p-desc"
                className="input"
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="p-price">
                价格
              </label>
              <input
                id="p-price"
                className="input"
                type="number"
                value={editing.price}
                onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
              />
            </div>
            <div className="field">
              <span className="field__label">积分类型</span>
              <div className="chips">
                {[
                  ['points', '积分'],
                  ['member', '会员积分'],
                ].map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    className="chip"
                    aria-pressed={editing.currency === v}
                    onClick={() => setEditing({ ...editing, currency: v })}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span className="field__label">类型</span>
              <div className="chips">
                {[
                  ['nameplate', '铭牌'],
                  ['avatar_frame', '头像框'],
                ].map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    className="chip"
                    aria-pressed={editing.kind === v}
                    onClick={() => setEditing({ ...editing, kind: v })}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="p-days">
                有效天数（0 表示永久）
              </label>
              <input
                id="p-days"
                className="input"
                type="number"
                value={editing.durationDays}
                onChange={(e) => setEditing({ ...editing, durationDays: Number(e.target.value) })}
              />
            </div>
            <div className="field">
              <span className="field__label">上架</span>
              <div className="chips">
                <button
                  type="button"
                  className="chip"
                  aria-pressed={editing.active}
                  onClick={() => setEditing({ ...editing, active: true })}
                >
                  上架
                </button>
                <button
                  type="button"
                  className="chip"
                  aria-pressed={!editing.active}
                  onClick={() => setEditing({ ...editing, active: false })}
                >
                  下架
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
