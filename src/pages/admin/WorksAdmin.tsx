import { useState } from 'react'
import { useApp } from '../../state/AppContext'
import { NavBar, Sheet, useConfirm } from '../../components/ui'
import { DirtyBanner } from '../../components/DirtyBanner'
import { Icon } from '../../components/Icon'
import { TextAreaField, TextField } from '../../components/form'
import { durationToInput, parseDuration, formatDuration } from '../../lib/format'
import { parseVideoInput } from '../../lib/video'
import { uid } from '../../lib/id'
import type { Episode, Extra, Platform, Season } from '../../data/schema'

export function WorksAdmin() {
  const { content, updateContent, toast } = useApp()
  const c = content!
  const confirm = useConfirm()

  const [seasonEdit, setSeasonEdit] = useState<Season | 'new' | null>(null)
  const [epEdit, setEpEdit] = useState<Episode | 'new' | null>(null)
  const [exEdit, setExEdit] = useState<Extra | 'new' | null>(null)

  const seasons = [...c.seasons].sort((a, b) => a.no - b.no)
  const episodes = [...c.episodes].sort((a, b) => a.no - b.no)

  /* ---------- 季 ---------- */

  const saveSeason = async (s: Season) => {
    await updateContent((prev) => {
      const exists = prev.seasons.some((x) => x.id === s.id)
      return {
        ...prev,
        seasons: exists
          ? prev.seasons.map((x) => (x.id === s.id ? s : x))
          : [...prev.seasons, s],
      }
    })
    setSeasonEdit(null)
    toast('季已保存')
  }

  const deleteSeason = async (s: Season) => {
    const affected = c.episodes.filter((e) => e.seasonId === s.id)
    const ok = await confirm({
      title: `删除${s.title}？`,
      message:
        affected.length > 0
          ? `这一季下的 ${affected.length} 集也会一起删除，无法恢复。`
          : '删除后无法恢复。',
      confirmText: '删除',
      danger: true,
    })
    if (!ok) return
    const deadIds = new Set(affected.map((e) => e.id))
    await updateContent((prev) => ({
      ...prev,
      seasons: prev.seasons.filter((x) => x.id !== s.id),
      episodes: prev.episodes.filter((e) => e.seasonId !== s.id),
      extras: prev.extras.map((x) =>
        x.relatedEpisodeId && deadIds.has(x.relatedEpisodeId)
          ? { ...x, relatedEpisodeId: null }
          : x,
      ),
      home: {
        ...prev.home,
        featured: prev.home.featured.filter(
          (f) => !(f.type === 'episode' && deadIds.has(f.id)),
        ),
      },
    }))
    setSeasonEdit(null)
    toast('已删除')
  }

  /* ---------- 集 ---------- */

  const saveEpisode = async (ep: Episode) => {
    await updateContent((prev) => {
      const exists = prev.episodes.some((x) => x.id === ep.id)
      return {
        ...prev,
        episodes: exists
          ? prev.episodes.map((x) => (x.id === ep.id ? ep : x))
          : [...prev.episodes, ep],
      }
    })
    setEpEdit(null)
    toast('剧集已保存')
  }

  const deleteEpisode = async (ep: Episode) => {
    const ok = await confirm({
      title: '删除这一集？',
      message: '相关的花絮会保留，但不再关联到这一集。',
      confirmText: '删除',
      danger: true,
    })
    if (!ok) return
    await updateContent((prev) => ({
      ...prev,
      episodes: prev.episodes.filter((x) => x.id !== ep.id),
      extras: prev.extras.map((x) =>
        x.relatedEpisodeId === ep.id ? { ...x, relatedEpisodeId: null } : x,
      ),
      home: {
        ...prev.home,
        featured: prev.home.featured.filter(
          (f) => !(f.type === 'episode' && f.id === ep.id),
        ),
      },
    }))
    setEpEdit(null)
    toast('已删除')
  }

  /* ---------- 花絮 ---------- */

  const saveExtra = async (x: Extra) => {
    await updateContent((prev) => {
      const exists = prev.extras.some((y) => y.id === x.id)
      return {
        ...prev,
        extras: exists ? prev.extras.map((y) => (y.id === x.id ? x : y)) : [...prev.extras, x],
      }
    })
    setExEdit(null)
    toast('花絮已保存')
  }

  const deleteExtra = async (x: Extra) => {
    const ok = await confirm({
      title: '删除这条花絮？',
      message: '删除后无法恢复。',
      confirmText: '删除',
      danger: true,
    })
    if (!ok) return
    await updateContent((prev) => ({
      ...prev,
      extras: prev.extras.filter((y) => y.id !== x.id),
      home: {
        ...prev.home,
        featured: prev.home.featured.filter((f) => !(f.type === 'extra' && f.id === x.id)),
      },
    }))
    setExEdit(null)
    toast('已删除')
  }

  return (
    <>
      <NavBar title="作品管理" back />
      <DirtyBanner />
      <div className="page__body">
        <section style={{ marginTop: 8 }}>
          <div className="section__head">
            <h2 className="section__title">季</h2>
            <button type="button" className="linklike" onClick={() => setSeasonEdit('new')}>
              ＋ 新增
            </button>
          </div>
          <div className="list">
            {seasons.map((s) => (
              <button
                key={s.id}
                type="button"
                className="list__row list__row--plain"
                onClick={() => setSeasonEdit(s)}
              >
                <span className="grow" style={{ textAlign: 'left' }}>
                  <span className="list__title">
                    {s.title}
                    <span className="count" style={{ marginLeft: 8 }}>
                      {c.episodes.filter((e) => e.seasonId === s.id).length} 集
                    </span>
                  </span>
                </span>
                <Icon name="chevron-right" size={18} />
              </button>
            ))}
            {seasons.length === 0 ? (
              <p className="t-caption faint" style={{ padding: 16 }}>
                还没有季，先建一个。
              </p>
            ) : null}
          </div>
        </section>

        <section className="section">
          <div className="section__head">
            <h2 className="section__title">正片</h2>
            <button
              type="button"
              className="linklike"
              onClick={() => setEpEdit('new')}
              disabled={seasons.length === 0}
            >
              ＋ 添加剧集
            </button>
          </div>
          {seasons.length === 0 ? (
            <p className="t-caption faint">先建一季，才能添加剧集。</p>
          ) : (
            <div className="list">
              {episodes
                .sort((a, b) => a.seasonId.localeCompare(b.seasonId) || a.no - b.no)
                .map((ep) => {
                  const season = c.seasons.find((s) => s.id === ep.seasonId)
                  return (
                    <button
                      key={ep.id}
                      type="button"
                      className="list__row list__row--plain"
                      onClick={() => setEpEdit(ep)}
                    >
                      <span className="grow" style={{ textAlign: 'left', minWidth: 0 }}>
                        <span className="list__title clamp-1" style={{ display: 'block' }}>
                          第{ep.no}集 · {ep.title}
                        </span>
                        <span className="list__sub">
                          {season?.title} · {formatDuration(ep.durationSec)} · {ep.videoId}
                        </span>
                      </span>
                      <Icon name="chevron-right" size={18} />
                    </button>
                  )
                })}
              {episodes.length === 0 ? (
                <p className="t-caption faint" style={{ padding: 16 }}>
                  还没有剧集。
                </p>
              ) : null}
            </div>
          )}
        </section>

        <section className="section">
          <div className="section__head">
            <h2 className="section__title">花絮</h2>
            <button type="button" className="linklike" onClick={() => setExEdit('new')}>
              ＋ 添加花絮
            </button>
          </div>
          <div className="list">
            {c.extras.map((x) => (
              <button
                key={x.id}
                type="button"
                className="list__row list__row--plain"
                onClick={() => setExEdit(x)}
              >
                <span className="grow" style={{ textAlign: 'left', minWidth: 0 }}>
                  <span className="list__title clamp-1" style={{ display: 'block' }}>
                    {x.title}
                  </span>
                  <span className="list__sub">
                    {formatDuration(x.durationSec)} · {x.videoId}
                  </span>
                </span>
                <Icon name="chevron-right" size={18} />
              </button>
            ))}
            {c.extras.length === 0 ? (
              <p className="t-caption faint" style={{ padding: 16 }}>
                还没有花絮。
              </p>
            ) : null}
          </div>
        </section>
      </div>

      {seasonEdit ? (
        <SeasonForm
          initial={seasonEdit === 'new' ? null : seasonEdit}
          nextNo={seasons.reduce((m, s) => Math.max(m, s.no), 0) + 1}
          onClose={() => setSeasonEdit(null)}
          onSave={(s) => void saveSeason(s)}
          onDelete={(s) => void deleteSeason(s)}
        />
      ) : null}

      {epEdit ? (
        <EpisodeForm
          initial={epEdit === 'new' ? null : epEdit}
          seasons={seasons}
          defaultSeasonId={seasons[0]?.id ?? ''}
          onClose={() => setEpEdit(null)}
          onSave={(ep) => void saveEpisode(ep)}
          onDelete={(ep) => void deleteEpisode(ep)}
        />
      ) : null}

      {exEdit ? (
        <ExtraForm
          initial={exEdit === 'new' ? null : exEdit}
          episodes={episodes}
          onClose={() => setExEdit(null)}
          onSave={(x) => void saveExtra(x)}
          onDelete={(x) => void deleteExtra(x)}
        />
      ) : null}
    </>
  )
}

/* ---------- 季表单 ---------- */

function SeasonForm({
  initial,
  nextNo,
  onClose,
  onSave,
  onDelete,
}: {
  initial: Season | null
  nextNo: number
  onClose: () => void
  onSave: (s: Season) => void
  onDelete: (s: Season) => void
}) {
  const [title, setTitle] = useState(initial?.title ?? `第${nextNo}季`)
  const [no, setNo] = useState(initial?.no ?? nextNo)
  const [cover, setCover] = useState(initial?.cover ?? '')
  const [synopsis, setSynopsis] = useState(initial?.synopsis ?? '')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    if (!title.trim()) return setError('名字不能为空')
    if (!Number.isFinite(no) || no < 1) return setError('季号要是正整数')
    onSave({
      id: initial?.id ?? uid('s'),
      no,
      title: title.trim(),
      cover: cover.trim() ? cover.trim() : null,
      synopsis,
    })
  }

  return (
    <Sheet
      open
      title={initial ? '编辑季' : '新增季'}
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
      <TextField label="名字" value={title} onChange={setTitle} />
      <TextField
        label="季号"
        value={String(no)}
        onChange={(v) => setNo(Number(v))}
        hint="数字，用来排序，比如 1、2、3。"
      />
      <TextField label="封面图片地址" value={cover} onChange={setCover} hint="可以留空。" />
      <TextAreaField label="简介" value={synopsis} onChange={setSynopsis} rows={3} />
      {error ? <p className="error-line">{error}</p> : null}
      {initial ? (
        <button
          type="button"
          className="btn btn--ghost btn--block"
          style={{ marginTop: 16, color: 'var(--danger)' }}
          onClick={() => onDelete(initial)}
        >
          删除这一季
        </button>
      ) : null}
    </Sheet>
  )
}

/* ---------- 剧集表单 ---------- */

function EpisodeForm({
  initial,
  seasons,
  defaultSeasonId,
  onClose,
  onSave,
  onDelete,
}: {
  initial: Episode | null
  seasons: Season[]
  defaultSeasonId: string
  onClose: () => void
  onSave: (ep: Episode) => void
  onDelete: (ep: Episode) => void
}) {
  const { content } = useApp()
  const c = content!
  const [seasonId, setSeasonId] = useState(initial?.seasonId ?? defaultSeasonId)
  const [no, setNo] = useState(initial?.no ?? 1)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [duration, setDuration] = useState(
    initial ? durationToInput(initial.durationSec) : '8:00',
  )
  const [publishedAt, setPublishedAt] = useState(
    initial?.publishedAt ?? new Date().toISOString().slice(0, 10),
  )
  const [platform, setPlatform] = useState<Platform>(initial?.platform ?? 'bilibili')
  const [videoId, setVideoId] = useState(initial?.videoId ?? '')
  const [link, setLink] = useState('')
  const [linkHint, setLinkHint] = useState<string | null>(null)
  const [cover, setCover] = useState(initial?.cover ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [error, setError] = useState<string | null>(null)

  const onLinkChange = (v: string) => {
    setLink(v)
    setLinkHint(null)
    if (!v.trim()) return
    const parsed = parseVideoInput(v)
    if (!parsed) {
      setLinkHint('没识别出视频 ID，检查一下链接')
      return
    }
    setPlatform(parsed.platform)
    setVideoId(parsed.videoId)
    setLinkHint(
      parsed.platform === 'bilibili'
        ? `已识别 B 站视频 ${parsed.videoId}`
        : `已识别 YouTube 视频 ${parsed.videoId}`,
    )
  }

  const submit = () => {
    if (!title.trim()) return setError('标题不能为空')
    if (!seasonId) return setError('要选一季')
    const sec = parseDuration(duration)
    if (sec === null) return setError('时长写成 8:00 这样')
    if (!videoId.trim()) return setError('视频链接或 ID 不能为空')
    onSave({
      id: initial?.id ?? uid('ep'),
      seasonId,
      no,
      title: title.trim(),
      durationSec: sec,
      publishedAt,
      platform,
      videoId: videoId.trim(),
      cover: cover.trim() ? cover.trim() : null,
      description,
    })
  }

  return (
    <Sheet
      open
      title={initial ? '编辑剧集' : '添加剧集'}
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
      <p className="field__label" style={{ marginTop: 4 }}>
        属于哪一季
      </p>
      <div className="chips">
        {seasons.map((s) => (
          <button
            key={s.id}
            type="button"
            className="chip"
            aria-pressed={seasonId === s.id}
            onClick={() => {
              setSeasonId(s.id)
              if (!initial) {
                const max = c.episodes
                  .filter((e) => e.seasonId === s.id)
                  .reduce((m, e) => Math.max(m, e.no), 0)
                setNo(max + 1)
              }
            }}
          >
            {s.title}
          </button>
        ))}
      </div>

      <div className="row gap-2">
        <div className="grow">
          <TextField label="集号" value={String(no)} onChange={(v) => setNo(Number(v) || 0)} />
        </div>
        <div style={{ flex: 2 }}>
          <TextField label="标题" value={title} onChange={setTitle} />
        </div>
      </div>

      <TextField
        label="B 站 / YouTube 链接"
        value={link}
        onChange={onLinkChange}
        placeholder="粘贴链接，自动识别"
        hint={linkHint ?? '也可以直接填 BV 号。'}
      />
      <TextField label="视频 ID" value={videoId} onChange={setVideoId} />
      <TextField
        label="时长"
        value={duration}
        onChange={setDuration}
        placeholder="8:00"
        hint="分:秒，超过一小时写成 1:05:30。"
      />
      <TextField
        label="发布日期"
        value={publishedAt}
        onChange={setPublishedAt}
        type="date"
      />
      <TextField label="封面图片地址" value={cover} onChange={setCover} hint="可以留空。" />
      <TextAreaField label="简介" value={description} onChange={setDescription} rows={4} />
      {error ? <p className="error-line">{error}</p> : null}
      {initial ? (
        <button
          type="button"
          className="btn btn--ghost btn--block"
          style={{ marginTop: 16, color: 'var(--danger)' }}
          onClick={() => onDelete(initial)}
        >
          删除这一集
        </button>
      ) : null}
      <p className="t-tag faint" style={{ marginTop: 12 }}>
        当前共 {c.episodes.length} 集。
      </p>
    </Sheet>
  )
}

/* ---------- 花絮表单 ---------- */

function ExtraForm({
  initial,
  episodes,
  onClose,
  onSave,
  onDelete,
}: {
  initial: Extra | null
  episodes: Episode[]
  onClose: () => void
  onSave: (x: Extra) => void
  onDelete: (x: Extra) => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [duration, setDuration] = useState(
    initial ? durationToInput(initial.durationSec) : '2:00',
  )
  const [publishedAt, setPublishedAt] = useState(
    initial?.publishedAt ?? new Date().toISOString().slice(0, 10),
  )
  const [platform, setPlatform] = useState<Platform>(initial?.platform ?? 'bilibili')
  const [videoId, setVideoId] = useState(initial?.videoId ?? '')
  const [link, setLink] = useState('')
  const [linkHint, setLinkHint] = useState<string | null>(null)
  const [cover, setCover] = useState(initial?.cover ?? '')
  const [related, setRelated] = useState(initial?.relatedEpisodeId ?? '')
  const [error, setError] = useState<string | null>(null)

  const onLinkChange = (v: string) => {
    setLink(v)
    setLinkHint(null)
    if (!v.trim()) return
    const parsed = parseVideoInput(v)
    if (!parsed) {
      setLinkHint('没识别出视频 ID，检查一下链接')
      return
    }
    setPlatform(parsed.platform)
    setVideoId(parsed.videoId)
    setLinkHint(`已识别 ${parsed.videoId}`)
  }

  const submit = () => {
    if (!title.trim()) return setError('标题不能为空')
    const sec = parseDuration(duration)
    if (sec === null) return setError('时长写成 2:00 这样')
    if (!videoId.trim()) return setError('视频链接或 ID 不能为空')
    onSave({
      id: initial?.id ?? uid('ex'),
      title: title.trim(),
      platform,
      videoId: videoId.trim(),
      relatedEpisodeId: related || null,
      cover: cover.trim() ? cover.trim() : null,
      durationSec: sec,
      publishedAt,
    })
  }

  return (
    <Sheet
      open
      title={initial ? '编辑花絮' : '添加花絮'}
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
      <TextField label="标题" value={title} onChange={setTitle} />
      <TextField
        label="B 站 / YouTube 链接"
        value={link}
        onChange={onLinkChange}
        placeholder="粘贴链接，自动识别"
        hint={linkHint ?? '也可以直接填 BV 号。'}
      />
      <TextField label="视频 ID" value={videoId} onChange={setVideoId} />
      <TextField
        label="时长"
        value={duration}
        onChange={setDuration}
        placeholder="2:00"
      />
      <TextField label="发布日期" value={publishedAt} onChange={setPublishedAt} type="date" />
      <TextField label="封面图片地址" value={cover} onChange={setCover} hint="可以留空。" />

      <p className="field__label" style={{ marginTop: 12 }}>
        关联到哪一集（可不选）
      </p>
      <select
        className="input"
        value={related}
        onChange={(e) => setRelated(e.target.value)}
        aria-label="关联剧集"
      >
        <option value="">不关联</option>
        {episodes.map((ep) => (
          <option key={ep.id} value={ep.id}>
            第{ep.no}集 · {ep.title}
          </option>
        ))}
      </select>

      {error ? <p className="error-line">{error}</p> : null}
      {initial ? (
        <button
          type="button"
          className="btn btn--ghost btn--block"
          style={{ marginTop: 16, color: 'var(--danger)' }}
          onClick={() => onDelete(initial)}
        >
          删除这条花絮
        </button>
      ) : null}
    </Sheet>
  )
}
