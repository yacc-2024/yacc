import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * 兜底：任何页面渲染报错都不再变成白屏/黑屏，
 * 而是显示一句人话 + 重新加载按钮。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 留在控制台，方便排查
    console.error('[yacc] 页面出错', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="page__body" style={{ paddingTop: 48 }}>
        <div className="card" style={{ textAlign: 'center', padding: '32px 20px' }}>
          <p className="t-title3">这个页面出了点问题</p>
          <p className="t-caption faint" style={{ marginTop: 8, lineHeight: 1.6 }}>
            刷新一下通常就好了。如果一直不行，把下面的错误信息发给负责人。
          </p>
          <pre
            className="t-tag"
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 12,
              background: 'var(--control-bg)',
              color: 'var(--text-2)',
              textAlign: 'left',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: 140,
              overflow: 'auto',
            }}
          >
            {error.message || String(error)}
          </pre>
          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <button
              type="button"
              className="btn btn--primary"
              style={{ flex: 1 }}
              onClick={() => window.location.reload()}
            >
              重新加载
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              style={{ flex: 1 }}
              onClick={() => {
                window.location.href = '/'
              }}
            >
              回首页
            </button>
          </div>
        </div>
      </div>
    )
  }
}
