import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../state/AppContext'
import { NavBar, EmptyState } from '../components/ui'
import { api } from '../lib/api'
import { relativeTime } from '../lib/format'
import { usePolling } from '../hooks/usePolling'

export function Devices() {
  const { mode, account, toast } = useApp()
  const [sessions, setSessions] = useState<
    Array<{ key: string; name: string; createdAt: string; current: boolean }>
  >([])
  const [requests, setRequests] = useState<Array<{ id: string; device: string; createdAt: string }>>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (mode !== 'online' || !account) {
      setLoading(false)
      return
    }
    try {
      const [s, r] = await Promise.all([api.sessions(), api.authRequests()])
      setSessions(s.sessions)
      setRequests(r.requests)
    } catch {
      /* 忽略 */
    } finally {
      setLoading(false)
    }
  }, [mode, account])

  useEffect(() => {
    void refresh()
  }, [refresh])

  usePolling(() => refresh(), 8_000, mode === 'online' && !!account)

  const decide = async (id: string, action: 'approve' | 'deny') => {
    try {
      await api.decideRequest(id, action)
      toast(action === 'approve' ? '已批准，那台设备可以登录了' : '已拒绝')
      await refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : '操作失败', 'error')
    }
  }

  return (
    <>
      <NavBar title="设备管理" back />
      <div className="page__body">
        {requests.length > 0 ? (
          <section style={{ marginTop: 8 }}>
            <h2 className="section__title" style={{ marginBottom: 10 }}>
              等待批准的登录
            </h2>
            {requests.map((r) => (
              <div key={r.id} className="card" style={{ marginBottom: 10, padding: 16 }}>
                <p className="t-body">{r.device || '未知设备'} 想登录这个账号</p>
                <p className="t-caption faint" style={{ marginTop: 4 }}>
                  {relativeTime(r.createdAt)}发起
                </p>
                <div className="row gap-2" style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className="btn btn--primary"
                    style={{ minHeight: 38, padding: '0 18px' }}
                    onClick={() => void decide(r.id, 'approve')}
                  >
                    批准
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    style={{ minHeight: 38, padding: '0 18px' }}
                    onClick={() => void decide(r.id, 'deny')}
                  >
                    拒绝
                  </button>
                </div>
              </div>
            ))}
          </section>
        ) : null}

        <section style={{ marginTop: 16 }}>
          <h2 className="section__title" style={{ marginBottom: 10 }}>
            正在登录的设备
          </h2>
          {loading ? (
            <p className="t-caption faint">加载中…</p>
          ) : sessions.length === 0 ? (
            <EmptyState icon="lock" title="没有在线设备" desc="登录后这里会显示。" />
          ) : (
            <div className="list">
              {sessions.map((s) => (
                <div key={s.key} className="list__row list__row--plain">
                  <span className="grow">
                    <span className="list__title" style={{ display: 'block' }}>
                      {s.name}
                      {s.current ? (
                        <span className="title-chip" style={{ marginLeft: 8 }}>
                          当前设备
                        </span>
                      ) : null}
                    </span>
                    <span className="list__sub">{relativeTime(s.createdAt)}登录</span>
                  </span>
                  {s.current ? null : (
                    <button
                      type="button"
                      className="linklike"
                      style={{ color: 'var(--danger)' }}
                      onClick={async () => {
                        try {
                          await api.removeDevice(s.key)
                          toast('已让这台设备下线')
                          await refresh()
                        } catch (err) {
                          toast(err instanceof Error ? err.message : '操作失败', 'error')
                        }
                      }}
                    >
                      下线
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="field__hint" style={{ marginTop: 16, lineHeight: 1.7 }}>
          一个账号默认只能在一台设备上登录。如果要在第二台设备上用，那边登录时会自动发一条申请，你在主设备上点「批准」就行。
        </p>
      </div>
    </>
  )
}
