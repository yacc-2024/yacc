import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { NavBar, Avatar, EmptyState } from '../components/ui'
import { Spinner, usePageRefresh } from '../components/PullToRefresh'
import { api } from '../lib/api'

type Sponsor = {
  uid: string
  name: string
  avatar: string | null
  until: string
  since: string
}

/** 合作年份：不跨年只显示一年，跨年显示「建立年-到期年」 */
function partnerRange(since: string | null, until: string): string {
  const start = new Date(since ?? until).getFullYear()
  const end = new Date(until).getFullYear()
  return start === end ? String(start) : `${start}-${end}`
}

export function Sponsors() {
  const [list, setList] = useState<Sponsor[] | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await api.sponsors()
      setList(res.sponsors)
    } catch {
      setList([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  usePageRefresh(load)

  useEffect(() => {
    let alive = true
    void api
      .sponsors()
      .then((res) => {
        if (alive) setList(res.sponsors)
      })
      .catch(() => {
        if (alive) setList([])
      })
    return () => {
      alive = false
    }
  }, [])

  return (
    <>
      <NavBar title="合作伙伴" back />
      <div className="page__body">
        {list === null ? (
          <Spinner label="正在加载" />
        ) : list.length === 0 ? (
          <EmptyState icon="person" title="还没有合作伙伴" desc="支持 YACC 的伙伴会出现在这里。" />
        ) : (
          <div className="grid-2" style={{ marginTop: 16 }}>
            {list.map((s) => (
              <Link key={s.uid} to={`/u/${s.uid}`} className="member member--sponsor">
                <Avatar name={s.name} src={s.avatar} size={88} />
                <span className="member__name clamp-1 sponsor-glow">{s.name}</span>
                <span className="member__role">
                  {partnerRange(s.since, s.until)} 官方合作伙伴
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
