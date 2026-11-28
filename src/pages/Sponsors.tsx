import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { NavBar, Avatar, EmptyState } from '../components/ui'
import { Spinner } from '../components/PullToRefresh'
import { api } from '../lib/api'

type Sponsor = { uid: string; name: string; avatar: string | null; until: string }

/** 当前年份 – 有效期年份；同年则显示到次年 */
function partnerRange(until: string): string {
  const now = new Date().getFullYear()
  const end = new Date(until).getFullYear()
  const to = end > now ? end : now + 1
  return `${now}-${to}`
}

export function Sponsors() {
  const [list, setList] = useState<Sponsor[] | null>(null)

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
          <div className="member-grid" style={{ marginTop: 16 }}>
            {list.map((s) => (
              <Link key={s.uid} to={`/u/${s.uid}`} className="member member--sponsor">
                <Avatar name={s.name} src={s.avatar} size={88} />
                <span className="member__name clamp-1 sponsor-glow">{s.name}</span>
                <span className="member__role">
                  {partnerRange(s.until)} 官方合作伙伴
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
