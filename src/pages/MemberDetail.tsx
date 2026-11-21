import { Link, useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { NavBar, Avatar, EmptyState } from '../components/ui'
import { Icon } from '../components/Icon'
import { EpisodeRow } from '../components/media'
import { formatDuration, formatDate } from '../lib/format'
import { episodesOfSeason, findMember, findSeason } from '../lib/selectors'
import { LoginGate } from './Members'

export function MemberDetail() {
  const { content, account } = useApp()
  const { id } = useParams()
  const navigate = useNavigate()
  const c = content!

  if (!account) {
    return (
      <>
        <NavBar title="成员" back />
        <LoginGate />
      </>
    )
  }

  const member = id ? findMember(c, id) : undefined
  if (!member) {
    return (
      <>
        <NavBar title="成员" back />
        <EmptyState
          title="找不到这个成员"
          desc="可能已经被移除。"
          action={
            <button type="button" className="btn btn--ghost" onClick={() => navigate('/members')}>
              回到成员
            </button>
          }
        />
      </>
    )
  }

  const episodes = member.seasons.flatMap((no) => {
    const season = c.seasons.find((s) => s.no === no)
    return season ? episodesOfSeason(c, season.id) : []
  })

  return (
    <>
      <NavBar
        title={member.name}
        back
        action={
          account.role === 'admin' ? (
            <Link to="/admin/members" className="nav__action" aria-label="管理成员">
              <Icon name="edit" size={21} />
            </Link>
          ) : null
        }
      />
      <div className="page__body">
        <div style={{ textAlign: 'center', paddingTop: 12 }}>
          <Avatar name={member.name} src={member.avatar} size={88} />
          <h2 className="t-title2" style={{ marginTop: 12 }}>
            {member.name}
          </h2>
          <p className="t-caption" style={{ marginTop: 4 }}>
            {member.roles.join(' · ')}
            {member.seasons.length > 0
              ? ` · ${member.seasons.map((s) => `第${s}季`).join('、')}`
              : ''}
          </p>
          {member.joinedAt ? (
            <p className="t-tag faint" style={{ marginTop: 4 }}>
              {member.joinedAt} 加入
            </p>
          ) : null}
        </div>

        {member.bio ? (
          <div className="card" style={{ marginTop: 20 }}>
            <p className="t-body" style={{ whiteSpace: 'pre-wrap' }}>
              {member.bio}
            </p>
          </div>
        ) : null}

        <section className="section">
          <h2 className="t-title2">参与作品</h2>
          {episodes.length === 0 ? (
            <EmptyState icon="film" title="还没有作品" desc="这一季还没开拍。" />
          ) : (
            <div style={{ marginTop: 8 }}>
              {episodes.map((ep) => {
                const season = findSeason(c, ep.seasonId)
                return (
                  <EpisodeRow
                    key={ep.id}
                    to={`/watch/${ep.id}`}
                    no={ep.no}
                    title={ep.title}
                    meta={`${season?.title ?? ''} · ${formatDuration(ep.durationSec)} · ${formatDate(ep.publishedAt)}`}
                    cover={ep.cover}
                  />
                )
              })}
            </div>
          )}
        </section>
      </div>
    </>
  )
}
