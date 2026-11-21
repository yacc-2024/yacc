import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** 当前是不是以「已安装」的方式打开的 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const mm = window.matchMedia?.('(display-mode: standalone)').matches
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone
  return Boolean(mm || iosStandalone)
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iPhoneLike = /iPad|iPhone|iPod/.test(ua)
  // iPadOS 13+ 的 UA 伪装成 Mac
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return iPhoneLike || iPadOS
}

export interface InstallState {
  /** 浏览器允许用系统弹窗安装 */
  canInstall: boolean
  /** 已经装好了 */
  installed: boolean
  /** 是 iOS，需要手动走「分享 → 添加到主屏幕」 */
  ios: boolean
  /** 触发安装；返回是否安装成功 */
  install: () => Promise<boolean>
}

/** 安装到桌面的状态与动作 */
export function useInstall(): InstallState {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone())

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvent(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setEvent(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = async () => {
    if (!event) return false
    await event.prompt()
    const choice = await event.userChoice
    if (choice.outcome === 'accepted') {
      setInstalled(true)
      setEvent(null)
      return true
    }
    return false
  }

  return {
    canInstall: Boolean(event),
    installed,
    ios: isIOS(),
    install,
  }
}
