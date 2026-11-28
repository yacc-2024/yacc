import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { NavBar, Avatar, EmptyState } from '../components/ui'
import { Spinner, usePageRefresh } from '../components/PullToRefresh'
import { api } from '../lib/api'
import { formatDate } from '../lib/format'

type Person = {
  uid: string
  name: string
  avatar: string | null
  avatarFrame: string | null
  since: string
}

export function FollowList({ kind }: { kind: 'following' | 'followers' }) {
  const { uid } = useParams()
  const [data, setData] = useState<{ list: Person[]; hidden: boolean } | null>(null)

  useEffect(() => {
    if (!uid) return
    let alive = true
    void api
      .followList(uid, kind)
      .then((res) => {
        if (alive) setData(res)
      })
      .catch(() => {
        if (alive) setData({ list: [], hidden: false })
      })
    return () => {
      alive = false
    }
  }, [uid, kind])

  usePageRefresh(async () => {
    if (!uid) return
    setData(await api.followList(uid, kind))
  })

  return (
    <>
      <NavBar title={kind === 'following' ? '关注' : '粉丝'} back />
      <div className="page__body">
        {!data ? (
          <Spinner label="正在加载" />
        ) : data.hidden ? (
          <EmptyState icon="lock" title="对方没有公开" desc="该列表已被主人设为私密。" />
        ) : data.list.length === 0 ? (
          <EmptyState
            icon="users"
            title={kind === 'following' ? '还没有关注任何人' : '还没有粉丝'}
            desc="多互动就有人来啦。"
          />
        ) : (
          <div className="list" style={{ marginTop: 12 }}>
            {data.list.map((p) => (
              <Link key={p.uid} to={`/u/${p.uid}`} className="list__row">
                <Avatar name={p.name} src={p.avatar} size={32} frame={p.avatarFrame} />
                <span className="grow">
                  <span className="list__title" style={{ display: 'block' }}>
                    {p.name}
                  </span>
                  <span className="list__sub">ID {p.uid} · {formatDate(p.since)}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
