import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../state/AppContext'
import { NavBar, useConfirm } from '../components/ui'
import { Spinner } from '../components/PullToRefresh'
import { api } from '../lib/api'
import { formatDate } from '../lib/format'

type Product = {
  id: string
  title: string
  description: string
  price: number
  currency: string
  kind: string
  value: string | null
  durationDays: number
}

type Item = {
  id: string
  productId: string
  title: string
  kind: string
  value: string | null
  createdAt: string
  expiresAt: string | null
}

export function Store() {
  const { account, toast } = useApp()
  const confirm = useConfirm()
  const [data, setData] = useState<{
    points: number
    memberPoints: number
    products: Product[]
    mine: Item[]
    equipped: { avatarFrame: string | null; badgeStyle: string | null }
  } | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setData(await api.store())
    } catch {
      setData(null)
    }
  }, [])

  useEffect(() => {
    if (!account) return
    void refresh()
  }, [account, refresh])

  const buy = async (p: Product) => {
    const ok = await confirm({
      title: `兑换「${p.title}」？`,
      message: `将消耗 ${p.price} ${p.currency === 'member' ? '会员积分' : '积分'}`,
      confirmText: '兑换',
    })
    if (!ok) return
    setBusy(true)
    try {
      await api.buyProduct(p.id)
      toast('兑换成功')
      await refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : '兑换失败', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <NavBar title="积分商城" back />
      <div className="page__body">
        <div className="store-wallet">
          <div className="store-wallet__item">
            <span className="store-wallet__num t-num">{data?.points ?? 0}</span>
            <span className="store-wallet__label">积分</span>
          </div>
          <div className="store-wallet__item">
            <span className="store-wallet__num t-num">{data?.memberPoints ?? 0}</span>
            <span className="store-wallet__label">会员积分</span>
          </div>
        </div>

        <h2 className="section__title" style={{ marginTop: 22 }}>
          商品
        </h2>

        {!data ? (
          <Spinner label="正在加载商品" />
        ) : data.products.length === 0 ? (
          <p className="t-caption faint" style={{ marginTop: 16 }}>
            暂时还没有上架的商品
          </p>
        ) : (
          <div className="store-grid">
            {data.products.map((p) => (
              <button
                key={p.id}
                type="button"
                className="store-card"
                disabled={busy}
                onClick={() => void buy(p)}
              >
                <span className={`store-card__art store-card__art--${p.kind}`} />
                <span className="store-card__title">{p.title}</span>
                <span className="store-card__desc">{p.description}</span>
                <span className="store-card__price">
                  {p.price} {p.currency === 'member' ? '会员积分' : '积分'}
                </span>
              </button>
            ))}
          </div>
        )}

        <h2 className="section__title" style={{ marginTop: 26 }}>
          我的物品
        </h2>

        {data && data.mine.length > 0 ? (
          <div className="list">
            {data.mine.map((item) => (
              <div key={item.id} className="list__row list__row--plain">
                <span className="grow">
                  <span className="list__title" style={{ display: 'block' }}>
                    {item.title}
                  </span>
                  <span className="list__sub">
                    {item.expiresAt ? `有效期至 ${formatDate(item.expiresAt)}` : '永久'}
                  </span>
                </span>
                <button
                  type="button"
                  className="linklike"
                  onClick={async () => {
                    try {
                      await api.equipItem(item.id)
                      toast('已装备')
                      await refresh()
                    } catch (err) {
                      toast(err instanceof Error ? err.message : '装备失败', 'error')
                    }
                  }}
                >
                  装备
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="t-caption faint" style={{ marginTop: 12 }}>
            还没有兑换过物品
          </p>
        )}
      </div>
    </>
  )
}
