import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { App } from '../src/App'
import { AppProvider } from '../src/state/AppContext'
import { ConfirmProvider } from '../src/components/ui'
import { __resetStorage } from '../src/data/storage'
import seed from '../public/content.json'

export function resetAll(): void {
  __resetStorage()
}

/** 让 /content.json 返回种子内容 */
export function mockContentFetch(content: unknown = seed): void {
  const body = JSON.stringify(content)
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('content.json')) {
        return new Response(body, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response('{}', { status: 200 })
    }),
  )
}

export function renderApp(entries: string[] = ['/']) {
  return render(
    <MemoryRouter initialEntries={entries}>
      <AppProvider>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </AppProvider>
    </MemoryRouter>,
  ) as unknown as ReturnType<typeof render> & { ui?: ReactElement }
}

import { register, setSession } from '../src/data/accounts'

export async function seedAdmin(name = '导演', password = 'abc123') {
  const acc = await register({
    name,
    password,
    inviteCode: '',
    expectedInviteCode: '',
    role: 'admin',
  })
  await setSession(acc.id)
  return acc
}

export async function seedMember(name = '普通成员', password = 'abc123') {
  const acc = await register({
    name,
    password,
    inviteCode: 'YACC2026',
    expectedInviteCode: 'YACC2026',
    role: 'member',
  })
  await setSession(acc.id)
  return acc
}
