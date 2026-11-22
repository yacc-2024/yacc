import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../../state/AppContext'
import { api } from '../../lib/api'
import { NavBar, Sheet, useConfirm } from '../../components/ui'
import { DirtyBanner } from '../../components/DirtyBanner'
import { Icon } from '../../components/Icon'
import { validateContent } from '../../data/validate'
import {
  buildBackup,
  buildContentPack,
  downloadJson,
  fileName,
  planImport,
  serialize,
  type ImportPlan,
} from '../../data/contentIO'
import { listAccounts } from '../../data/accounts'
import { applyRestore, applyRollback, loadRollback } from '../../data/restore'
import { storageMode } from '../../data/storage'
import { readFileText } from '../../lib/file'
import { formatDateTime } from '../../lib/format'

export function DataAdmin() {
  const {
    mode,
    publishToServer,
    content,
    source,
    dirty,
    conflict,
    favorites,
    history,
    discardDraft,
    restoreMyDraft,
    toast,
  } = useApp()
  const c = content!
  const confirm = useConfirm()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [preview, setPreview] = useState<ImportPlan | null>(null)
  const [importErrors, setImportErrors] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [hasRollback, setHasRollback] = useState(false)
  const [versions, setVersions] = useState<
    Array<{ version: number; publishedAt: string; publisher: string }>
  >([])

  const refreshVersions = useCallback(async () => {
    if (mode !== 'online') return
    try {
      const res = await api.admin.versions()
      setVersions(res.versions)
    } catch {
      /* 没有权限或离线时静默 */
    }
  }, [mode])

  useEffect(() => {
    void refreshVersions()
  }, [refreshVersions])

  useEffect(() => {
    void loadRollback().then((snap) => setHasRollback(!!snap))
  }, [])

  const counts = `成员 ${c.members.length} · 集 ${c.episodes.length} · 花絮 ${c.extras.length} · 公告 ${c.announcements.length}`

  const exportContent = async () => {
    const check = validateContent(c)
    if (!check.ok) {
      toast(`导出被拦下：${check.errors[0]}`, 'error')
      return
    }
    const ok = downloadJson(fileName('content'), serialize(buildContentPack(c)))
    toast(ok ? '已导出内容包' : '这台浏览器不支持下载，请在电脑上试', ok ? 'ok' : 'error')
  }

  const exportBackup = async () => {
    const accounts = await listAccounts()
    const backup = buildBackup(c, accounts, favorites, history)
    const ok = downloadJson(fileName('backup'), serialize(backup))
    toast(ok ? '已导出完整备份' : '这台浏览器不支持下载，请在电脑上试', ok ? 'ok' : 'error')
  }

  const onPickFile = async (file: File | undefined) => {
    if (!file) return
    setImportErrors(null)
    const text = await readFileText(file)
    const result = planImport(text, file.size)
    if (!result.ok) {
      setImportErrors(result.errors)
      return
    }
    setPreview(result.plan)
  }

  const confirmImport = async () => {
    if (!preview) return
    setBusy(true)
    try {
      await applyRestore({
        content: preview.content,
        accounts: preview.accounts,
        favorites: preview.favorites,
        history: preview.history,
      })
      setPreview(null)
      window.location.reload()
    } catch (err) {
      setBusy(false)
      toast(err instanceof Error ? err.message : '导入失败', 'error')
    }
  }

  const onRollback = async () => {
    const ok = await confirm({
      title: '撤销上一次导入？',
      message: '会把内容和账号恢复到那次导入之前的样子。',
      confirmText: '撤销',
      danger: true,
    })
    if (!ok) return
    const done = await applyRollback()
    if (!done) {
      toast('没有可撤销的记录', 'error')
      return
    }
    window.location.reload()
  }

  const onPublish = async () => {
    try {
      await publishToServer()
    } catch (err) {
      toast(err instanceof Error ? err.message : '发布失败', 'error')
    }
  }

  const onDiscard = async () => {
    const ok = await confirm({
      title: '清除本地草稿？',
      message: '这台设备上未发布的修改会全部丢掉，回到网站上当前的版本。',
      confirmText: '清除',
      danger: true,
    })
    if (!ok) return
    await discardDraft()
  }

  return (
    <>
      <NavBar title="数据管理" back />
      <DirtyBanner />
      <div className="page__body">
        <div className="card" style={{ marginTop: 8 }}>
          <p className="t-caption faint">当前使用</p>
          <p className="t-title3" style={{ marginTop: 2 }}>
            {mode === 'online' ? '在线' : '本地'} ·{' '}
            {source === 'draft' ? '本地草稿' : '线上版本'}
            {dirty ? ' · 有未发布的修改' : ''}
          </p>
          <p className="t-caption" style={{ marginTop: 6 }}>
            {counts}
          </p>
          <p className="t-tag faint" style={{ marginTop: 6 }}>
            内容更新于 {formatDateTime(c.updatedAt)} · 存储：{storageMode()}
          </p>
        </div>

        {conflict ? (
          <div className="card" style={{ marginTop: 12 }}>
            <p className="t-body">网站内容已更新，本地草稿的基线变了。</p>
            <button
              type="button"
              className="btn btn--ghost btn--block"
              style={{ marginTop: 12 }}
              onClick={() => void restoreMyDraft()}
            >
              改用我的草稿
            </button>
          </div>
        ) : null}

        {mode === 'online' ? (
          <div className="card" style={{ marginTop: 16 }}>
            <p className="t-body">在线模式已连接</p>
            <p className="t-caption" style={{ marginTop: 4 }}>
              改完点这里，所有人立刻看到，不需要再替换文件。
            </p>
            <button
              type="button"
              className="btn btn--primary btn--block"
              style={{ marginTop: 12 }}
              onClick={() => void onPublish()}
            >
              发布到线上
            </button>
          </div>
        ) : null}

        <div className="list" style={{ marginTop: 16 }}>
          <button type="button" className="list__row" onClick={() => void exportContent()}>
            <span className="list__icon">
              <Icon name="download" size={22} />
            </span>
            <span className="grow" style={{ textAlign: 'left' }}>
              <span className="list__title">导出内容包</span>
              <span className="list__sub" style={{ display: 'block' }}>
                生成 content.json，用于发布到网站
              </span>
            </span>
            <Icon name="chevron-right" size={18} />
          </button>

          <button type="button" className="list__row" onClick={() => void exportBackup()}>
            <span className="list__icon">
              <Icon name="download" size={22} />
            </span>
            <span className="grow" style={{ textAlign: 'left' }}>
              <span className="list__title">导出完整备份</span>
              <span className="list__sub" style={{ display: 'block' }}>
                包含账号与收藏，用于换设备
              </span>
            </span>
            <Icon name="chevron-right" size={18} />
          </button>

          <button type="button" className="list__row" onClick={() => fileRef.current?.click()}>
            <span className="list__icon">
              <Icon name="upload" size={22} />
            </span>
            <span className="grow" style={{ textAlign: 'left' }}>
              <span className="list__title">导入</span>
              <span className="list__sub" style={{ display: 'block' }}>
                从 JSON 文件恢复内容
              </span>
            </span>
            <Icon name="chevron-right" size={18} />
          </button>

          {hasRollback ? (
            <button type="button" className="list__row" onClick={() => void onRollback()}>
              <span className="list__icon">
                <Icon name="clock" size={22} />
              </span>
              <span className="grow" style={{ textAlign: 'left' }}>
                <span className="list__title">撤销上一次导入</span>
                <span className="list__sub" style={{ display: 'block' }}>
                  回到导入之前的状态
                </span>
              </span>
              <Icon name="chevron-right" size={18} />
            </button>
          ) : null}

          <button type="button" className="list__row" onClick={() => void onDiscard()}>
            <span className="list__icon">
              <Icon name="trash" size={22} />
            </span>
            <span className="grow" style={{ textAlign: 'left' }}>
              <span className="list__title">清除本地草稿</span>
              <span className="list__sub" style={{ display: 'block' }}>
                回到网站上当前的版本
              </span>
            </span>
            <Icon name="chevron-right" size={18} />
          </button>
        </div>

        {mode === 'online' && versions.length > 0 ? (
          <section style={{ marginTop: 22 }}>
            <h2 className="section__title" style={{ marginBottom: 10 }}>
              版本历史
            </h2>
            <div className="list">
              {versions.map((v) => (
                <div key={v.version} className="list__row list__row--plain">
                  <span className="grow" style={{ textAlign: 'left' }}>
                    <span className="list__title" style={{ display: 'block' }}>
                      第 {v.version} 版
                    </span>
                    <span className="list__sub">
                      {formatDateTime(v.publishedAt)} · {v.publisher}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="linklike"
                    onClick={async () => {
                      const ok = await confirm({
                        title: `回到第 ${v.version} 版？`,
                        message: '会以这版内容生成一次新的发布，历史记录不会丢。',
                        confirmText: '回滚',
                      })
                      if (!ok) return
                      try {
                        await api.admin.rollback(v.version)
                        toast('已回滚，刷新页面查看')
                        await refreshVersions()
                      } catch (err) {
                        toast(err instanceof Error ? err.message : '回滚失败', 'error')
                      }
                    }}
                  >
                    回滚
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          aria-label="选择配置文件"
          onChange={(e) => {
            void onPickFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />

        <div className="card" style={{ marginTop: 20 }}>
          <p className="t-caption" style={{ lineHeight: 1.65 }}>
            数据保存在这台设备上。网站内容以线上发布为准，本地修改只有自己可见。
          </p>
        </div>

        <div className="card" style={{ marginTop: 12 }}>
          <p className="t-caption faint">发布步骤</p>
          <ol className="t-caption" style={{ marginTop: 6, paddingLeft: 18, lineHeight: 1.8 }}>
            <li>点「导出内容包」拿到 json 文件</li>
            <li>把它替换成网站项目里的 public/content.json</li>
            <li>提交后网站会自动更新，所有人看到的就变了</li>
          </ol>
        </div>
      </div>

      {/* 导入预览 */}
      <Sheet
        open={!!preview}
        title="确认导入"
        onClose={() => setPreview(null)}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setPreview(null)}>
              取消
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy}
              onClick={() => void confirmImport()}
            >
              {busy ? '导入中…' : '确认覆盖'}
            </button>
          </>
        }
      >
        {preview ? (
          <>
            <p className="t-body">将覆盖这台设备上的内容：</p>
            <p className="t-caption" style={{ marginTop: 8 }}>
              成员 {preview.content.members.length} · 集 {preview.content.episodes.length} · 花絮{' '}
              {preview.content.extras.length} · 公告 {preview.content.announcements.length}
            </p>
            {preview.kind === 'backup' ? (
              <p className="t-caption" style={{ marginTop: 6 }}>
                账号 {preview.accounts.length} · 收藏 {preview.favorites.length} · 历史{' '}
                {preview.history.length}
              </p>
            ) : null}
            {preview.warnings.map((w) => (
              <p key={w} className="t-caption" style={{ marginTop: 10, color: 'var(--danger)' }}>
                {w}
              </p>
            ))}
            <p className="t-caption faint" style={{ marginTop: 12 }}>
              导入后如果想要撤回，可以用上一次导出的备份再导一次。
            </p>
          </>
        ) : null}
      </Sheet>

      {/* 导入错误 */}
      <Sheet
        open={!!importErrors}
        title="这个文件不能导入"
        onClose={() => setImportErrors(null)}
        footer={
          <button type="button" className="btn btn--primary" onClick={() => setImportErrors(null)}>
            知道了
          </button>
        }
      >
        <p className="t-caption" style={{ marginBottom: 8 }}>
          现有数据没有改动。具体原因：
        </p>
        <ul>
          {importErrors?.slice(0, 8).map((e) => (
            <li key={e} className="t-caption" style={{ lineHeight: 1.7 }}>
              · {e}
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  )
}
