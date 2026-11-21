import { useState } from 'react'
import { useApp } from '../../state/AppContext'
import { NavBar, Sheet, useConfirm } from '../../components/ui'
import { DirtyBanner } from '../../components/DirtyBanner'
import { Icon } from '../../components/Icon'
import { TextAreaField, TextField } from '../../components/form'
import { isoToLocalInput, localInputToIso, todayInput } from '../../lib/datetime'
import { uid } from '../../lib/id'
import { episodeBadge, extraBadge } from '../../lib/selectors'
import type {
  Announcement,
  CrewEvent,
  FigureItem,
  StatItem,
  TimelineItem,
} from '../../data/schema'

/* ============================================================
   主页管理
   ============================================================ */

export function HomeEdit() {
  const { content, updateContent, toast } = useApp()
  const c = content!
  const confirm = useConfirm()

  const [claim, setClaim] = useState(c.home.claim)
  const [intro, setIntro] = useState(c.home.intro)
  const [stats, setStats] = useState<StatItem[]>(c.home.stats)
  const [figures, setFigures] = useState<FigureItem[]>(c.about.figures)

  const [annEditing, setAnnEditing] = useState<Announcement | 'new' | null>(null)
  const [evtEditing, setEvtEditing] = useState<CrewEvent | 'new' | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const saveHeader = async () => {
    await updateContent((prev) => ({
      ...prev,
      home: { ...prev.home, claim, intro, stats },
      about: { ...prev.about, figures },
    }))
    toast('已保存')
  }

  const moveFeatured = async (index: number, delta: number) => {
    await updateContent((prev) => {
      const list = [...prev.home.featured]
      const next = index + delta
      if (next < 0 || next >= list.length) return prev
      const [item] = list.splice(index, 1)
      list.splice(next, 0, item)
      return { ...prev, home: { ...prev.home, featured: list } }
    })
  }

  const removeFeatured = async (index: number) => {
    await updateContent((prev) => ({
      ...prev,
      home: {
        ...prev.home,
        featured: prev.home.featured.filter((_, i) => i !== index),
      },
    }))
  }

  const addFeatured = async (type: 'episode' | 'extra', id: string) => {
    await updateContent((prev) => {
      if (prev.home.featured.length >= 5) return prev
      if (prev.home.featured.some((f) => f.type === type && f.id === id)) return prev
      return {
        ...prev,
        home: { ...prev.home, featured: [...prev.home.featured, { type, id }] },
      }
    })
    setPickerOpen(false)
  }

  const saveAnnouncement = async (a: Announcement) => {
    await updateContent((prev) => {
      const exists = prev.announcements.some((x) => x.id === a.id)
      return {
        ...prev,
        announcements: exists
          ? prev.announcements.map((x) => (x.id === a.id ? a : x))
          : [...prev.announcements, a],
      }
    })
    setAnnEditing(null)
    toast('公告已保存')
  }

  const deleteAnnouncement = async (id: string) => {
    const ok = await confirm({
      title: '删除这条公告？',
      message: '删除后无法恢复。发布前还可以用「清除本地草稿」整体撤回。',
      confirmText: '删除',
      danger: true,
    })
    if (!ok) return
    await updateContent((prev) => ({
      ...prev,
      announcements: prev.announcements.filter((x) => x.id !== id),
    }))
    setAnnEditing(null)
    toast('已删除')
  }

  const togglePin = async (a: Announcement) => {
    await updateContent((prev) => ({
      ...prev,
      announcements: prev.announcements.map((x) =>
        x.id === a.id ? { ...x, pinned: !x.pinned } : x,
      ),
    }))
  }

  const saveEvent = async (ev: CrewEvent) => {
    await updateContent((prev) => {
      const exists = prev.events.some((x) => x.id === ev.id)
      return {
        ...prev,
        events: exists ? prev.events.map((x) => (x.id === ev.id ? ev : x)) : [...prev.events, ev],
      }
    })
    setEvtEditing(null)
    toast('活动已保存')
  }

  const deleteEvent = async (id: string) => {
    const ok = await confirm({
      title: '删除这个活动？',
      message: '删除后无法恢复。',
      confirmText: '删除',
      danger: true,
    })
    if (!ok) return
    await updateContent((prev) => ({
      ...prev,
      events: prev.events.filter((x) => x.id !== id),
    }))
    setEvtEditing(null)
    toast('已删除')
  }

  return (
    <>
      <NavBar title="主页管理" back />
      <DirtyBanner />
      <div className="page__body">
        <section style={{ marginTop: 8 }}>
          <h2 className="section__title">头图</h2>
          <TextField label="主张（大字）" value={claim} onChange={setClaim} />
          <TextAreaField
            label="简介"
            value={intro}
            onChange={setIntro}
            hint="最多 3 行，再长会被截断。"
            rows={3}
          />
          <p className="field__label" style={{ marginTop: 16 }}>
            统计
          </p>
          {stats.map((s, i) => (
            <div key={i} className="row gap-2" style={{ marginTop: 8 }}>
              <input
                className="input"
                style={{ width: 88 }}
                value={s.value}
                aria-label={`第 ${i + 1} 个统计的数值`}
                onChange={(e) =>
                  setStats((prev) =>
                    prev.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x)),
                  )
                }
              />
              <input
                className="input"
                value={s.label}
                aria-label={`第 ${i + 1} 个统计的说明`}
                onChange={(e) =>
                  setStats((prev) =>
                    prev.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)),
                  )
                }
              />
            </div>
          ))}
        </section>

        <section className="section">
          <h2 className="section__title">三组数据</h2>
          <p className="t-caption faint" style={{ marginTop: 4, marginBottom: 8 }}>
            显示在主页头图下方，点进去是「关于」页。
          </p>
          {figures.map((f, i) => (
            <div key={i} className="row gap-2" style={{ marginTop: 8 }}>
              <input
                className="input"
                style={{ width: 96 }}
                value={f.value}
                aria-label={`第 ${i + 1} 个数据的数值`}
                onChange={(e) =>
                  setFigures((prev) =>
                    prev.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x)),
                  )
                }
              />
              <input
                className="input"
                value={f.label}
                aria-label={`第 ${i + 1} 个数据的说明`}
                onChange={(e) =>
                  setFigures((prev) =>
                    prev.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)),
                  )
                }
              />
            </div>
          ))}
        </section>

        <button
          type="button"
          className="btn btn--primary btn--block"
          style={{ marginTop: 20 }}
          onClick={() => void saveHeader()}
        >
          保存头图与数据
        </button>

        <section className="section">
          <div className="section__head">
            <h2 className="section__title">最新推荐</h2>
            <button
              type="button"
              className="linklike"
              aria-label="添加推荐"
              onClick={() => setPickerOpen(true)}
              disabled={c.home.featured.length >= 5}
            >
              ＋ 添加
            </button>
          </div>
          {c.home.featured.length === 0 ? (
            <p className="t-caption faint">还没有推荐。最多可以放 5 个。</p>
          ) : (
            <div className="list">
              {c.home.featured.map((f, i) => {
                const ep = f.type === 'episode' ? c.episodes.find((e) => e.id === f.id) : undefined
                const ex = f.type === 'extra' ? c.extras.find((e) => e.id === f.id) : undefined
                const title = ep?.title ?? ex?.title ?? '（已失效）'
                const badge = ep ? episodeBadge(c, ep) : ex ? extraBadge(c, ex) : ''
                return (
                  <div key={`${f.type}-${f.id}`} className="list__row list__row--plain">
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span className="list__title clamp-1" style={{ display: 'block' }}>
                        {title}
                      </span>
                      <span className="list__sub">{badge}</span>
                    </span>
                    <button
                      type="button"
                      className="nav__action"
                      aria-label="上移"
                      disabled={i === 0}
                      style={{ width: 36 }}
                      onClick={() => void moveFeatured(i, -1)}
                    >
                      <Icon name="chevron-down" size={16} style={{ transform: 'rotate(180deg)' }} />
                    </button>
                    <button
                      type="button"
                      className="nav__action"
                      aria-label="下移"
                      disabled={i === c.home.featured.length - 1}
                      style={{ width: 36 }}
                      onClick={() => void moveFeatured(i, 1)}
                    >
                      <Icon name="chevron-down" size={16} />
                    </button>
                    <button
                      type="button"
                      className="nav__action"
                      aria-label="移除"
                      style={{ width: 36, color: 'var(--danger)' }}
                      onClick={() => void removeFeatured(i)}
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="section">
          <div className="section__head">
            <h2 className="section__title">公告</h2>
            <button
              type="button"
              className="linklike"
              aria-label="新增公告"
              onClick={() => setAnnEditing('new')}
            >
              ＋ 新增
            </button>
          </div>
          {c.announcements.length === 0 ? (
            <p className="t-caption faint">还没有公告。</p>
          ) : (
            <div className="list">
              {c.announcements.map((a) => (
                <div key={a.id} className="list__row list__row--plain">
                  <button
                    type="button"
                    aria-label={a.pinned ? '取消置顶' : '置顶'}
                    onClick={() => void togglePin(a)}
                    style={{
                      width: 28,
                      color: a.pinned ? 'var(--accent)' : 'var(--text-3)',
                    }}
                  >
                    <Icon name="check" size={16} />
                  </button>
                  <button
                    type="button"
                    className="grow"
                    style={{ textAlign: 'left', minWidth: 0 }}
                    onClick={() => setAnnEditing(a)}
                  >
                    <span className="list__title clamp-1" style={{ display: 'block' }}>
                      {a.title}
                    </span>
                    <span className="list__sub">{a.date}</span>
                  </button>
                  <Icon name="chevron-right" size={18} />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="section">
          <div className="section__head">
            <h2 className="section__title">活动</h2>
            <button
              type="button"
              className="linklike"
              aria-label="新增活动"
              onClick={() => setEvtEditing('new')}
            >
              ＋ 新增
            </button>
          </div>
          {c.events.length === 0 ? (
            <p className="t-caption faint">还没有活动。</p>
          ) : (
            <div className="list">
              {c.events.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  className="list__row list__row--plain"
                  onClick={() => setEvtEditing(ev)}
                >
                  <span className="grow" style={{ textAlign: 'left', minWidth: 0 }}>
                    <span className="list__title clamp-1" style={{ display: 'block' }}>
                      {ev.title}
                    </span>
                    <span className="list__sub">{ev.placePublic || '地点待定'}</span>
                  </span>
                  <Icon name="chevron-right" size={18} />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {annEditing ? (
        <AnnouncementForm
          initial={annEditing === 'new' ? null : annEditing}
          onClose={() => setAnnEditing(null)}
          onSave={(a) => void saveAnnouncement(a)}
          onDelete={(id) => void deleteAnnouncement(id)}
        />
      ) : null}

      {evtEditing ? (
        <EventForm
          initial={evtEditing === 'new' ? null : evtEditing}
          onClose={() => setEvtEditing(null)}
          onSave={(ev) => void saveEvent(ev)}
          onDelete={(id) => void deleteEvent(id)}
        />
      ) : null}

      <Sheet open={pickerOpen} title="添加到推荐" onClose={() => setPickerOpen(false)}>
        <p className="t-caption faint">最多 5 个，按添加顺序显示。</p>
        <p className="field__label" style={{ marginTop: 16 }}>
          正片
        </p>
        <div className="list">
          {c.episodes.map((ep) => (
            <button
              key={ep.id}
              type="button"
              className="list__row list__row--plain"
              onClick={() => void addFeatured('episode', ep.id)}
            >
              <span className="grow" style={{ textAlign: 'left' }}>
                <span className="list__title">{ep.title}</span>
              </span>
              <span className="count">{episodeBadge(c, ep)}</span>
            </button>
          ))}
        </div>
        <p className="field__label" style={{ marginTop: 16 }}>
          花絮
        </p>
        <div className="list">
          {c.extras.map((x) => (
            <button
              key={x.id}
              type="button"
              className="list__row list__row--plain"
              onClick={() => void addFeatured('extra', x.id)}
            >
              <span className="grow" style={{ textAlign: 'left' }}>
                <span className="list__title">{x.title}</span>
              </span>
              <span className="count">{extraBadge(c, x)}</span>
            </button>
          ))}
        </div>
      </Sheet>
    </>
  )
}

/* ---------- 公告表单 ---------- */

function AnnouncementForm({
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  initial: Announcement | null
  onClose: () => void
  onSave: (a: Announcement) => void
  onDelete: (id: string) => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [date, setDate] = useState(initial?.date ?? todayInput())
  const [pinned, setPinned] = useState(initial?.pinned ?? false)
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    if (!title.trim()) {
      setError('标题不能为空')
      return
    }
    onSave({
      id: initial?.id ?? uid('a'),
      title: title.trim(),
      body,
      date,
      pinned,
    })
  }

  return (
    <Sheet
      open
      title={initial ? '编辑公告' : '新增公告'}
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
      <TextAreaField label="正文" value={body} onChange={setBody} rows={5} />
      <TextField label="日期" value={date} onChange={setDate} type="date" />
      <label className="check">
        <input
          type="checkbox"
          checked={pinned}
          onChange={(e) => setPinned(e.target.checked)}
        />
        <span className="t-body">置顶</span>
      </label>
      {error ? <p className="error-line">{error}</p> : null}
      {initial ? (
        <button
          type="button"
          className="btn btn--ghost btn--block"
          style={{ marginTop: 16, color: 'var(--danger)' }}
          onClick={() => onDelete(initial.id)}
        >
          删除这条公告
        </button>
      ) : null}
    </Sheet>
  )
}

/* ---------- 活动表单 ---------- */

function EventForm({
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  initial: CrewEvent | null
  onClose: () => void
  onSave: (ev: CrewEvent) => void
  onDelete: (id: string) => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [start, setStart] = useState(
    initial ? isoToLocalInput(initial.startAt) : `${todayInput()}T14:00`,
  )
  const [end, setEnd] = useState(
    initial ? isoToLocalInput(initial.endAt) : `${todayInput()}T17:00`,
  )
  const [placePublic, setPlacePublic] = useState(initial?.placePublic ?? '')
  const [placePrivate, setPlacePrivate] = useState(initial?.placePrivate ?? '')
  const [mapQuery, setMapQuery] = useState(initial?.mapQuery ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    if (!title.trim()) {
      setError('标题不能为空')
      return
    }
    if (!start) {
      setError('开始时间不能为空')
      return
    }
    const startIso = localInputToIso(start)
    const endIso = localInputToIso(end || start)
    if (new Date(endIso).getTime() < new Date(startIso).getTime()) {
      setError('结束时间不能早于开始时间')
      return
    }
    onSave({
      id: initial?.id ?? uid('e'),
      title: title.trim(),
      startAt: startIso,
      endAt: endIso,
      placePublic: placePublic.trim(),
      placePrivate: placePrivate.trim(),
      mapQuery: mapQuery.trim(),
      note,
    })
  }

  return (
    <Sheet
      open
      title={initial ? '编辑活动' : '新增活动'}
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
      <TextField label="开始" value={start} onChange={setStart} type="datetime-local" />
      <TextField label="结束" value={end} onChange={setEnd} type="datetime-local" />
      <TextField
        label="公开地点"
        value={placePublic}
        onChange={setPlacePublic}
        hint="所有人都能看到，写「学校操场」这样就好。"
      />
      <TextField
        label="具体地点"
        value={placePrivate}
        onChange={setPlacePrivate}
        hint="只有登录后可见。"
      />
      <TextField
        label="地图搜索词"
        value={mapQuery}
        onChange={setMapQuery}
        hint="填学校名或地址，用于「打开地图」。"
      />
      <TextAreaField label="备注" value={note} onChange={setNote} rows={3} />
      {error ? <p className="error-line">{error}</p> : null}
      {initial ? (
        <button
          type="button"
          className="btn btn--ghost btn--block"
          style={{ marginTop: 16, color: 'var(--danger)' }}
          onClick={() => onDelete(initial.id)}
        >
          删除这个活动
        </button>
      ) : null}
    </Sheet>
  )
}

/* ============================================================
   关于页管理
   ============================================================ */

export function AboutEdit() {
  const { content, updateContent, toast } = useApp()
  const c = content!
  const confirm = useConfirm()

  const [lead, setLead] = useState(c.about.lead)
  const [sourceText, setSourceText] = useState(c.about.source.text)
  const [sourceNote, setSourceNote] = useState(c.about.source.note)
  const [editing, setEditing] = useState<TimelineItem | 'new' | null>(null)

  const save = async () => {
    await updateContent((prev) => ({
      ...prev,
      about: {
        ...prev.about,
        lead,
        source: { text: sourceText, note: sourceNote },
      },
    }))
    toast('已保存')
  }

  const saveTimeline = async (item: TimelineItem) => {
    await updateContent((prev) => {
      const list = prev.about.timeline
      const exists = list.some((t) => t.date === item.date && t.title === item.title)
      return {
        ...prev,
        about: {
          ...prev.about,
          timeline: exists
            ? list.map((t) => (t.date === item.date && t.title === item.title ? item : t))
            : [...list, item],
        },
      }
    })
    setEditing(null)
    toast('已保存')
  }

  const deleteTimeline = async (item: TimelineItem) => {
    const ok = await confirm({
      title: '删除这个节点？',
      message: '删除后无法恢复。',
      confirmText: '删除',
      danger: true,
    })
    if (!ok) return
    await updateContent((prev) => ({
      ...prev,
      about: {
        ...prev.about,
        timeline: prev.about.timeline.filter(
          (t) => !(t.date === item.date && t.title === item.title),
        ),
      },
    }))
    setEditing(null)
    toast('已删除')
  }

  return (
    <>
      <NavBar title="关于页管理" back />
      <DirtyBanner />
      <div className="page__body">
        <TextAreaField
          label="为什么拍（引言）"
          value={lead}
          onChange={setLead}
          rows={7}
          hint="这段会显示在关于页最上方，也是最能打动人的部分。"
        />
        <TextField
          label="数据来源"
          value={sourceText}
          onChange={setSourceText}
          hint="写清出处，别省。"
        />
        <TextField label="来源备注" value={sourceNote} onChange={setSourceNote} />

        <button
          type="button"
          className="btn btn--primary btn--block"
          style={{ marginTop: 20 }}
          onClick={() => void save()}
        >
          保存引言与来源
        </button>

        <section className="section">
          <div className="section__head">
            <h2 className="section__title">项目历程</h2>
            <button type="button" className="linklike" onClick={() => setEditing('new')}>
              ＋ 新增
            </button>
          </div>
          {c.about.timeline.length === 0 ? (
            <p className="t-caption faint">还没有节点。</p>
          ) : (
            <div className="list">
              {c.about.timeline.map((t) => (
                <button
                  key={`${t.date}-${t.title}`}
                  type="button"
                  className="list__row list__row--plain"
                  onClick={() => setEditing(t)}
                >
                  <span className="grow" style={{ textAlign: 'left', minWidth: 0 }}>
                    <span className="list__title clamp-1" style={{ display: 'block' }}>
                      {t.date} · {t.title}
                    </span>
                    <span className="list__sub clamp-1" style={{ display: 'block' }}>
                      {t.desc}
                    </span>
                  </span>
                  <Icon name="chevron-right" size={18} />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {editing ? (
        <TimelineForm
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(t) => void saveTimeline(t)}
          onDelete={(t) => void deleteTimeline(t)}
        />
      ) : null}
    </>
  )
}

function TimelineForm({
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  initial: TimelineItem | null
  onClose: () => void
  onSave: (t: TimelineItem) => void
  onDelete: (t: TimelineItem) => void
}) {
  const [date, setDate] = useState(initial?.date ?? '')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [desc, setDesc] = useState(initial?.desc ?? '')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    if (!title.trim()) {
      setError('标题不能为空')
      return
    }
    if (!date.trim()) {
      setError('时间不能为空，比如 2026.03')
      return
    }
    onSave({ date: date.trim(), title: title.trim(), desc })
  }

  return (
    <Sheet
      open
      title={initial ? '编辑节点' : '新增节点'}
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
      <TextField label="时间" value={date} onChange={setDate} placeholder="2026.03" />
      <TextField label="标题" value={title} onChange={setTitle} placeholder="立项" />
      <TextAreaField label="说明" value={desc} onChange={setDesc} rows={3} />
      {error ? <p className="error-line">{error}</p> : null}
      {initial ? (
        <button
          type="button"
          className="btn btn--ghost btn--block"
          style={{ marginTop: 16, color: 'var(--danger)' }}
          onClick={() => onDelete(initial)}
        >
          删除这个节点
        </button>
      ) : null}
    </Sheet>
  )
}
