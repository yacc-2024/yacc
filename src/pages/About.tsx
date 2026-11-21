import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { NavBar } from '../components/ui'
import { Icon } from '../components/Icon'
import { shareOrCopy } from '../lib/share'

export function About() {
  const { content, toast } = useApp()
  const c = content!
  const [sourceOpen, setSourceOpen] = useState(false)

  const roleRows = c.roles.map((role) => ({
    role,
    count: c.members.filter((m) => m.roles.includes(role)).length,
  }))

  const copySource = async () => {
    const text = `${c.about.source.text}（${c.about.source.note}）`
    try {
      await navigator.clipboard.writeText(text)
      toast('已复制')
    } catch {
      toast('复制失败，请手动选择', 'error')
    }
  }

  const share = async () => {
    const outcome = await shareOrCopy({
      title: `${c.site.fullName} · 关于`,
      text: c.home.claim,
      url: window.location.href,
    })
    if (outcome === 'copied') toast('链接已复制')
    if (outcome === 'failed') toast('分享失败', 'error')
  }

  return (
    <>
      <NavBar
        title="关于"
        back
        action={
          <button type="button" className="nav__action" aria-label="分享" onClick={() => void share()}>
            <Icon name="share" size={21} />
          </button>
        }
      />

      <div className="page__body" id="figures">
        <section style={{ marginTop: 8 }}>
          <h2 className="t-title2">为什么拍</h2>
          <p className="t-body" style={{ marginTop: 10, lineHeight: 1.72 }}>
            {c.about.lead}
          </p>

          <div className="figures">
            {c.about.figures.map((f) => (
              <div className="figure" key={f.label}>
                <div className="figure__value">{f.value}</div>
                <div className="figure__label">{f.label}</div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="t-caption faint"
            style={{ marginTop: 8, textAlign: 'left', display: 'block', width: '100%' }}
            aria-expanded={sourceOpen}
            onClick={() => setSourceOpen((v) => !v)}
          >
            来源：{c.about.source.text}
          </button>

          {sourceOpen ? (
            <div style={{ marginTop: 8 }}>
              <p className="quote">
                {c.about.source.text}
                {c.about.source.note ? `（${c.about.source.note}）` : ''}
              </p>
              <button type="button" className="linklike" onClick={() => void copySource()}>
                复制引用
              </button>
            </div>
          ) : null}
        </section>

        <section className="section">
          <h2 className="t-title2">项目历程</h2>
          <div className="tl" style={{ marginTop: 14 }}>
            {[...c.about.timeline].reverse().map((t, i) => (
              <div className="tl__item" key={`${t.date}-${i}`}>
                <p className="tl__date">{t.date}</p>
                <p className="tl__title">{t.title}</p>
                {t.desc ? <p className="tl__desc">{t.desc}</p> : null}
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <h2 className="t-title2">项目概览</h2>
          <div className="figures" style={{ marginTop: 12 }}>
            {c.home.stats.map((s) => (
              <div className="figure" key={s.label}>
                <div className="figure__value">{s.value}</div>
                <div className="figure__label">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <h2 className="t-title2">制作分工</h2>
          <div className="list" style={{ marginTop: 12 }}>
            {roleRows.map((r) => (
              <Link
                key={r.role}
                to={`/members?role=${encodeURIComponent(r.role)}`}
                className="list__row"
              >
                <span className="grow list__title" style={{ textAlign: 'left' }}>
                  {r.role}
                </span>
                <span className="count">{r.count} 人</span>
                <span className="list__chev">
                  <Icon name="chevron-right" size={18} />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="section">
          <h2 className="t-title2">出品</h2>
          <p className="t-body" style={{ marginTop: 8 }}>
            {c.site.school}
          </p>
          <p className="t-caption faint" style={{ marginTop: 4 }}>
            {c.site.fullName}
          </p>
        </section>

        <p className="t-tag faint" style={{ marginTop: 32, textAlign: 'center' }}>
          {c.site.copyright}
        </p>
      </div>
    </>
  )
}
