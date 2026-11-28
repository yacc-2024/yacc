import { useState } from 'react'
import { useApp } from '../state/AppContext'
import { NavBar } from '../components/ui'
import { DEFAULT_PRIVACY, PRIVACY_LABELS, type Privacy } from '../lib/privacy'

export function PrivacySettings() {
  const { account, updateProfile, toast } = useApp()
  const [value, setValue] = useState<Privacy>(account?.privacy ?? DEFAULT_PRIVACY)

  const toggle = async (key: keyof Privacy) => {
    const next = { ...value, [key]: !value[key] }
    setValue(next)
    try {
      await updateProfile({ privacy: next })
      toast('已保存')
    } catch (err) {
      toast(err instanceof Error ? err.message : '保存失败', 'error')
    }
  }

  return (
    <>
      <NavBar title="隐私设置" back />
      <div className="page__body">
        <div className="list" style={{ marginTop: 12 }}>
          {PRIVACY_LABELS.map(([key, title, desc]) => (
            <button
              key={key}
              type="button"
              className="list__row"
              onClick={() => void toggle(key)}
            >
              <span className="grow" style={{ textAlign: 'left' }}>
                <span className="list__title" style={{ display: 'block' }}>
                  {title}
                </span>
                <span className="list__sub">{desc}</span>
              </span>
              <span className={`switch${value[key] ? ' switch--on' : ''}`}>
                <span className="switch__knob" />
              </span>
            </button>
          ))}
        </div>
        <p className="field__hint" style={{ marginTop: 12, padding: '0 4px' }}>
          关闭后，别人访问你的主页时看不到对应内容；你自己仍然能看到。
        </p>
      </div>
    </>
  )
}
