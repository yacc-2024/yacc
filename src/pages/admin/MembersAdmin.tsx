import { useState } from 'react'
import { useApp } from '../../state/AppContext'
import { NavBar, Avatar, Sheet, useConfirm } from '../../components/ui'
import { DirtyBanner } from '../../components/DirtyBanner'
import { Icon } from '../../components/Icon'
import { MultiChips, NumberChips, TextAreaField, TextField } from '../../components/form'
import { sortMembers } from '../../lib/format'
import { uid } from '../../lib/id'
import type { Member } from '../../data/schema'

export function MembersAdmin() {
  const { content, updateContent, toast } = useApp()
  const c = content!
  const confirm = useConfirm()
  const [editing, setEditing] = useState<Member | 'new' | null>(null)

  const list = sortMembers(c.members)
  const seasonNumbers = c.seasons.map((s) => s.no).sort((a, b) => a - b)

  const save = async (m: Member) => {
    await updateContent((prev) => {
      const exists = prev.members.some((x) => x.id === m.id)
      if (exists) {
        return {
          ...prev,
          members: prev.members.map((x) => (x.id === m.id ? m : x)),
        }
      }
      const maxOrder = prev.members.reduce((max, x) => Math.max(max, x.order), 0)
      return {
        ...prev,
        members: [...prev.members, { ...m, order: m.order || maxOrder + 1 }],
      }
    })
    setEditing(null)
    toast('成员已保存')
  }

  const remove = async (id: string) => {
    const ok = await confirm({
      title: '删除这个成员？',
      message: '删除后无法恢复。发布前可以用「清除本地草稿」整体撤回。',
      confirmText: '删除',
      danger: true,
    })
    if (!ok) return
    await updateContent((prev) => ({
      ...prev,
      members: prev.members.filter((x) => x.id !== id),
    }))
    setEditing(null)
    toast('已删除')
  }

  const move = async (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= list.length) return
    const a = list[index]
    const b = list[target]
    await updateContent((prev) => ({
      ...prev,
      members: prev.members.map((m) => {
        if (m.id === a.id) return { ...m, order: b.order }
        if (m.id === b.id) return { ...m, order: a.order }
        return m
      }),
    }))
  }

  return (
    <>
      <NavBar
        title="成员管理"
        back
        action={
          <button
            type="button"
            className="nav__action"
            aria-label="新增成员"
            onClick={() => setEditing('new')}
          >
            <Icon name="plus" size={22} />
          </button>
        }
      />
      <DirtyBanner />
      <div className="page__body">
        {list.length === 0 ? (
          <p className="t-caption faint" style={{ marginTop: 16 }}>
            还没有成员，点右上角加一个。
          </p>
        ) : (
          <div className="list" style={{ marginTop: 8 }}>
            {list.map((m, i) => (
              <div key={m.id} className="list__row" style={{ gap: 10 }}>
                <button
                  type="button"
                  className="grow row gap-3"
                  style={{ textAlign: 'left', minWidth: 0 }}
                  onClick={() => setEditing(m)}
                >
                  <Avatar name={m.name} src={m.avatar} size={32} />
                  <span style={{ minWidth: 0 }}>
                    <span className="list__title clamp-1" style={{ display: 'block' }}>
                      {m.name}
                    </span>
                    <span className="list__sub">
                      {m.roles.join(' · ') || '未分工'} ·{' '}
                      {m.seasons.map((s) => `S${s}`).join(' ') || '未分季'}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="nav__action"
                  style={{ width: 34 }}
                  aria-label={`上移 ${m.name}`}
                  disabled={i === 0}
                  onClick={() => void move(i, -1)}
                >
                  <Icon name="chevron-down" size={15} style={{ transform: 'rotate(180deg)' }} />
                </button>
                <button
                  type="button"
                  className="nav__action"
                  style={{ width: 34 }}
                  aria-label={`下移 ${m.name}`}
                  disabled={i === list.length - 1}
                  onClick={() => void move(i, 1)}
                >
                  <Icon name="chevron-down" size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="t-caption faint" style={{ marginTop: 16 }}>
          用右侧箭头调整顺序，主页和成员页会跟着变。
        </p>
      </div>

      {editing ? (
        <MemberForm
          initial={editing === 'new' ? null : editing}
          roles={c.roles}
          seasons={seasonNumbers}
          onClose={() => setEditing(null)}
          onSave={(m) => void save(m)}
          onDelete={(id) => void remove(id)}
        />
      ) : null}
    </>
  )
}

function MemberForm({
  initial,
  roles,
  seasons,
  onClose,
  onSave,
  onDelete,
}: {
  initial: Member | null
  roles: string[]
  seasons: number[]
  onClose: () => void
  onSave: (m: Member) => void
  onDelete: (id: string) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [memberRoles, setMemberRoles] = useState<string[]>(initial?.roles ?? [])
  const [memberSeasons, setMemberSeasons] = useState<number[]>(initial?.seasons ?? [])
  const [bio, setBio] = useState(initial?.bio ?? '')
  const [avatar, setAvatar] = useState(initial?.avatar ?? '')
  const [joinedAt, setJoinedAt] = useState(initial?.joinedAt ?? '')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    if (!name.trim()) {
      setError('名字不能为空')
      return
    }
    onSave({
      id: initial?.id ?? uid('m'),
      name: name.trim(),
      roles: memberRoles,
      seasons: memberSeasons,
      bio,
      avatar: avatar.trim() ? avatar.trim() : null,
      joinedAt: joinedAt.trim(),
      order: initial?.order ?? 0,
    })
  }

  return (
    <Sheet
      open
      title={initial ? '编辑成员' : '新增成员'}
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
      <TextField label="名字" value={name} onChange={setName} />
      <MultiChips
        label="分工"
        options={roles}
        value={memberRoles}
        onChange={setMemberRoles}
      />
      <NumberChips
        label="参与季"
        options={seasons}
        value={memberSeasons}
        onChange={setMemberSeasons}
      />
      <TextAreaField
        label="一句话介绍"
        value={bio}
        onChange={setBio}
        rows={3}
        hint="会显示在成员详情页。"
      />
      <TextField
        label="头像图片地址"
        value={avatar}
        onChange={setAvatar}
        hint="可以留空，会显示姓氏首字母。"
      />
      <TextField label="加入时间" value={joinedAt} onChange={setJoinedAt} placeholder="2026-03" />
      {error ? <p className="error-line">{error}</p> : null}
      {initial ? (
        <button
          type="button"
          className="btn btn--ghost btn--block"
          style={{ marginTop: 16, color: 'var(--danger)' }}
          onClick={() => onDelete(initial.id)}
        >
          删除这个成员
        </button>
      ) : null}
    </Sheet>
  )
}
