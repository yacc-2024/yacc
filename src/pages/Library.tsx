import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { NavBar, EmptyState } from '../components/ui'
import { EpisodeRow } from '../components/media'
import { Icon } from '../components/Icon'
import { formatDate, formatDuration, relativeDay } from '../lib/format'
import {
  episodeBadge,
  extraBadge,
  findEpisode,
  findExtra,
  findSeason,
} from '../lib/selectors'
import { clearHistory } from '../data/history'
import { useConfirm } from '../components/ui'
import { RequireAuth } from '../components/guards'

export function Favorites() {
  const { content, favorites } = useApp()
  const c = content!

  const groups = useMemo(() => {
    const bySeason = new Map<string, { title: string; items: typeof favorites }>()
    const extras: typeof favorites = []
    favorites.forEach((f) => {
      if (f.type === 'extra') {
        extras.push(f)
        return
      }
      const ep = f.type === 'episode' ? findEpisode(c, f.id) : undefined
      if (!ep) return
      const season = findSeason(c, ep.seasonId)
      const key = season?.id ?? 'unknown'
      if (!bySeason.has(key)) {
        bySeason.set(key, { title: season?.title ?? '未分季', items: [] })
      }
      bySeason.get(key)!.items.push(f)
    })
    return { seasons: Array.from(bySeason.values()), extras }
  }, [c, favorites])

  return (
    <RequireAuth>
      <NavBar title="我的收藏" back />
      <div className="page__body">
        {favorites.length === 0 ? (
          <EmptyState
            icon="bookmark"
            title="还没有收藏"
            desc="看到喜欢的，点一下心形就收好了。"
            action={
              <Link to="/works" className="btn btn--ghost" style={{ marginTop: 8 }}>
                去看看作品
              </Link>
            }
          />
        ) : (
          <>
            {groups.seasons.map((g) => (
              <section key={g.title} style={{ marginTop: 16 }}>
                <h2 className="t-caption faint" style={{ fontWeight: 600, marginBottom: 6 }}>
                  {g.title}
                </h2>
                {g.items.map((f) => {
                  const ep = findEpisode(c, f.id)
                  if (!ep) return null
                  return (
                    <EpisodeRow
                      key={`${f.type}-${f.id}`}
                      to={`/watch/${ep.id}`}
                      no={ep.no}
                      title={ep.title}
                      meta={`${episodeBadge(c, ep)} · ${formatDuration(ep.durationSec)}`}
                      cover={ep.cover}
                    />
                  )
                })}
              </section>
            ))}

            {groups.extras.length > 0 ? (
              <section style={{ marginTop: 24 }}>
                <h2 className="t-caption faint" style={{ fontWeight: 600, marginBottom: 6 }}>
                  花絮
                </h2>
                {groups.extras.map((f) => {
                  const x = findExtra(c, f.id)
                  if (!x) return null
                  return (
                    <Link key={f.id} to={`/watch/${x.id}`} className="ep">
                      <span className="ep__media">
                        <Icon name="film" size={22} />
                      </span>
                      <span className="grow">
                        <span className="ep__title">{x.title}</span>
                        <span className="ep__meta" style={{ display: 'block' }}>
                          {extraBadge(c, x)} · {formatDuration(x.durationSec)}
                        </span>
                      </span>
                      <span className="list__chev">
                        <Icon name="chevron-right" size={18} />
                      </span>
                    </Link>
                  )
                })}
              </section>
            ) : null}
          </>
        )}
      </div>
    </RequireAuth>
  )
}

export function History() {
  const { content, history, refreshHistory, toast } = useApp()
  const c = content!
  const confirm = useConfirm()

  const onClear = async () => {
    const ok = await confirm({
      title: '清空观看历史？',
      message: '只清空这台设备上的记录，不影响收藏。',
      confirmText: '清空',
      danger: true,
    })
    if (!ok) return
    await clearHistory()
    await refreshHistory()
    toast('已清空')
  }

  return (
    <RequireAuth>
      <NavBar
        title="观看历史"
        back
        action={
          history.length > 0 ? (
            <button type="button" className="linklike" onClick={() => void onClear()}>
              清空
            </button>
          ) : null
        }
      />
      <div className="page__body">
        {history.length === 0 ? (
          <EmptyState
            icon="clock"
            title="还没有看过"
            desc="看过的片子会记在这里，只你自己能看到。"
            action={
              <Link to="/works" className="btn btn--ghost" style={{ marginTop: 8 }}>
                去看看作品
              </Link>
            }
          />
        ) : (
          history.map((h) => {
            const ep = h.type === 'episode' ? findEpisode(c, h.id) : undefined
            const x = h.type === 'extra' ? findExtra(c, h.id) : undefined
            if (!ep && !x) return null
            return (
              <div key={`${h.type}-${h.id}`}>
                <EpisodeRow
                  to={`/watch/${h.id}`}
                  no={ep ? ep.no : undefined}
                  title={ep?.title ?? x!.title}
                  meta={`${ep ? episodeBadge(c, ep) : extraBadge(c, x!)} · ${relativeDay(h.at)} · ${formatDate(h.at.slice(0, 10))}`}
                  cover={ep?.cover ?? x?.cover ?? null}
                />
              </div>
            )
          })
        )}
      </div>
    </RequireAuth>
  )
}
