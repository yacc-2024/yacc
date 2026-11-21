import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { NavBar, Segmented, Chip, EmptyState } from '../components/ui'
import { EpisodeRow, PosterCard } from '../components/media'
import { DirtyBanner } from '../components/DirtyBanner'
import { formatDate, formatDuration } from '../lib/format'
import { episodesOfSeason, extraBadge, seasonsSorted } from '../lib/selectors'

type Tab = 'main' | 'extra'

export function Works() {
  const { content } = useApp()
  const c = content!
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab')
  const tab: Tab = tabParam === 'extra' ? 'extra' : 'main'

  const seasons = seasonsSorted(c)
  const [seasonNo, setSeasonNo] = useState<number | null>(seasons[0]?.no ?? null)
  const current = seasons.find((s) => s.no === seasonNo) ?? seasons[0]
  const episodes = current ? episodesOfSeason(c, current.id) : []

  const setTab = (v: Tab) => {
    const next = new URLSearchParams(params)
    if (v === 'main') next.delete('tab')
    else next.set('tab', v)
    setParams(next, { replace: true })
  }

  return (
    <>
      <NavBar title="作品" large />
      <DirtyBanner />

      <div className="page__body">
        <Segmented<Tab>
          label="作品分类"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'main', label: '正片' },
            { value: 'extra', label: '花絮' },
          ]}
        />

        {tab === 'main' ? (
          <div key="main" className="panel-enter">
            {seasons.length > 0 ? (
              <div className="chips" style={{ marginTop: 16 }} role="group" aria-label="选择季度">
                {seasons.map((s) => (
                  <Chip key={s.id} active={current?.id === s.id} onClick={() => setSeasonNo(s.no)}>
                    {s.title}
                  </Chip>
                ))}
              </div>
            ) : null}

            <div style={{ marginTop: 8 }}>
              {episodes.length === 0 ? (
                <EmptyState
                  icon="film"
                  title="这一季还在剪"
                  desc="剪好之后会放上来，先去别的地方逛逛。"
                />
              ) : (
                episodes.map((ep) => (
                  <EpisodeRow
                    key={ep.id}
                    to={`/watch/${ep.id}`}
                    no={ep.no}
                    title={ep.title}
                    meta={`${formatDuration(ep.durationSec)} · ${formatDate(ep.publishedAt)}`}
                    cover={ep.cover}
                  />
                ))
              )}
            </div>

            {current?.synopsis ? (
              <p className="quote" style={{ marginTop: 20 }}>
                {current.synopsis}
              </p>
            ) : null}
          </div>
        ) : (
          <div key="extra" className="panel-enter" style={{ marginTop: 16 }}>
            {c.extras.length === 0 ? (
              <EmptyState icon="film" title="花絮还在剪" desc="拍摄时的碎片会放在这里。" />
            ) : (
              <div className="grid-2">
                {c.extras.map((x) => (
                  <PosterCard
                    key={x.id}
                    to={`/watch/${x.id}`}
                    title={x.title}
                    badge={extraBadge(c, x)}
                    cover={x.cover}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
