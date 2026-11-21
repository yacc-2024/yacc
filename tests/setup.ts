import '@testing-library/jest-dom/vitest'
import { webcrypto } from 'node:crypto'
import { afterEach, vi } from 'vitest'

const hasDom = typeof window !== 'undefined'
const cleanup = hasDom
  ? (await import('@testing-library/react')).cleanup
  : () => {}

// jsdom 的 crypto 没有 subtle，测试里用 Node 的实现补上
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
    writable: true,
  })
}

if (hasDom && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  })
}

if (hasDom && !('IntersectionObserver' in window)) {
  class IO {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
    root = null
    rootMargin = ''
    thresholds = []
  }
  Object.defineProperty(window, 'IntersectionObserver', { writable: true, value: IO })
}

if (hasDom) {
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
}

afterEach(() => {
  cleanup()
})
