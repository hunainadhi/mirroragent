import type { AppConfig, Mode, PauseDuration, FocusScore, BlockedApp, NotificationAction } from '../shared/types'

type Unsubscribe = () => void

declare global {
  interface Window {
    mirrorAgent: {
      getConfig: () => Promise<Omit<AppConfig, 'apiKey'> & { apiKey: string }>
      setConfig: (partial: Partial<AppConfig>) => Promise<void>
      reloadConfig: () => Promise<void>
      getMode: () => Promise<Mode>
      setMode: (mode: Mode) => Promise<void>
      setTaskLabel: (label: string) => Promise<void>
      completeOnboarding: (data: Record<string, unknown>) => Promise<void>
      validateApiKey: (key: string) => Promise<boolean>
      scanApps: () => Promise<string[]>
      checkPermissions: () => Promise<{ accessibility: boolean; screenRecording: boolean }>
      openAccessibilitySettings: () => Promise<void>
      openScreenRecordingSettings: () => Promise<void>
      getScore: () => Promise<FocusScore>
      startPause: (duration: PauseDuration) => Promise<void>
      extendPause: () => Promise<void>
      endPause: () => Promise<void>
      getBlockedApps: () => Promise<BlockedApp[]>
      restoreApp: (appName: string) => Promise<void>
      submitCorrection: (data: { appName: string; url?: string }) => Promise<void>
      retroactiveCorrection: (blockId: number) => Promise<void>
      respondToNotification: (action: NotificationAction) => Promise<void>
      onModeChanged: (cb: (mode: Mode) => void) => Unsubscribe
      onScoreUpdated: (cb: (score: FocusScore) => void) => Unsubscribe
      onBlockExecuted: (cb: (data: { appName: string; url: string | null }) => void) => Unsubscribe
      onHudNudge: (cb: (message: string) => void) => Unsubscribe
      onPauseTick: (cb: (remainingMs: number) => void) => Unsubscribe
      onPauseEnded: (cb: () => void) => Unsubscribe
      onNotificationFire: (cb: (data: unknown) => void) => Unsubscribe
      onNotificationCountdown: (cb: (seconds: number) => void) => Unsubscribe
      resizeHud: (expanded: boolean) => void
      openExtensionFolder: () => Promise<void>
      getAppPath: () => Promise<string>
    }
  }
}
