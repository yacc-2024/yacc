/**
 * 统一存储入口：IndexedDB -> localStorage -> 内存
 * 任何一层不可用都自动降级，绝不抛错打断页面。
 */
import { get, set, del } from 'idb-keyval'

type Mode = 'idb' | 'local' | 'memory'
let mode: Mode | null = null
const memory = new Map<string, unknown>()

function detect(): Mode {
  if (mode) return mode
  if (typeof indexedDB !== 'undefined') {
    mode = 'idb'
  } else if (typeof localStorage !== 'undefined') {
    mode = 'local'
  } else {
    mode = 'memory'
  }
  return mode
}

async function tryIdbGet<T>(key: string): Promise<T | undefined> {
  return (await get<T>(key)) ?? undefined
}

export async function storageGet<T>(key: string): Promise<T | undefined> {
  const m = detect()
  if (m === 'idb') {
    try {
      return await tryIdbGet<T>(key)
    } catch {
      mode = typeof localStorage !== 'undefined' ? 'local' : 'memory'
    }
  }
  if (mode === 'local' && typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(key)
    if (!raw) return undefined
    try {
      return JSON.parse(raw) as T
    } catch {
      return undefined
    }
  }
  return memory.get(key) as T | undefined
}

export async function storageSet(key: string, value: unknown): Promise<void> {
  const m = detect()
  if (m === 'idb') {
    try {
      await set(key, value)
      return
    } catch {
      mode = typeof localStorage !== 'undefined' ? 'local' : 'memory'
    }
  }
  if (mode === 'local' && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      return
    } catch {
      mode = 'memory'
    }
  }
  memory.set(key, value)
}

export async function storageDel(key: string): Promise<void> {
  const m = detect()
  if (m === 'idb') {
    try {
      await del(key)
      return
    } catch {
      mode = typeof localStorage !== 'undefined' ? 'local' : 'memory'
    }
  }
  if (mode === 'local' && typeof localStorage !== 'undefined') {
    localStorage.removeItem(key)
    return
  }
  memory.delete(key)
}

/** 仅测试使用 */
export function __resetStorage(next?: Mode): void {
  mode = next ?? null
  memory.clear()
  if (typeof localStorage !== 'undefined') localStorage.clear()
}

export function storageMode(): Mode {
  return detect()
}
