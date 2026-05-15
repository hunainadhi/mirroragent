import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'
import type {
  AppConfig,
  Mode,
  PauseDuration,
  FocusScore,
  BlockedApp,
  NotificationAction,
} from '../shared/types'

type Unsubscribe = () => void

contextBridge.exposeInMainWorld('mirrorAgent', {
  // Config
  getConfig: (): Promise<Omit<AppConfig, 'apiKey'> & { apiKey: string }> =>
    ipcRenderer.invoke(IPC.CONFIG_GET),

  setConfig: (partial: Partial<AppConfig>): Promise<void> =>
    ipcRenderer.invoke(IPC.CONFIG_SET, partial),

  reloadConfig: (): Promise<void> =>
    ipcRenderer.invoke(IPC.CONFIG_RELOAD),

  // Mode
  getMode: (): Promise<Mode> =>
    ipcRenderer.invoke(IPC.MODE_GET),

  setMode: (mode: Mode): Promise<void> =>
    ipcRenderer.invoke(IPC.MODE_SET, mode),

  setTaskLabel: (label: string): Promise<void> =>
    ipcRenderer.invoke(IPC.TASK_LABEL_SET, label),

  // Onboarding
  completeOnboarding: (data: Partial<AppConfig>): Promise<void> =>
    ipcRenderer.invoke(IPC.ONBOARDING_COMPLETE, data),

  validateApiKey: (key: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.API_KEY_VALIDATE, key),

  scanApps: (): Promise<string[]> =>
    ipcRenderer.invoke(IPC.APPS_SCAN),

  // Permissions
  checkPermissions: (): Promise<{ accessibility: boolean; screenRecording: boolean }> =>
    ipcRenderer.invoke(IPC.PERMISSIONS_CHECK),

  openAccessibilitySettings: (): Promise<void> =>
    ipcRenderer.invoke(IPC.PERMISSIONS_OPEN_ACCESSIBILITY),

  openScreenRecordingSettings: (): Promise<void> =>
    ipcRenderer.invoke(IPC.PERMISSIONS_OPEN_SCREEN_RECORDING),

  // Focus score
  getScore: (): Promise<FocusScore> =>
    ipcRenderer.invoke(IPC.SCORE_GET),

  // Pause
  startPause: (duration: PauseDuration): Promise<void> =>
    ipcRenderer.invoke(IPC.PAUSE_START, duration),

  extendPause: (): Promise<void> =>
    ipcRenderer.invoke(IPC.PAUSE_EXTEND),

  endPause: (): Promise<void> =>
    ipcRenderer.invoke(IPC.PAUSE_END),

  // Blocked apps
  getBlockedApps: (): Promise<BlockedApp[]> =>
    ipcRenderer.invoke(IPC.BLOCKED_APPS_GET),

  restoreApp: (appName: string): Promise<void> =>
    ipcRenderer.invoke(IPC.BLOCKED_APPS_RESTORE, appName),

  // Corrections
  submitCorrection: (data: { appName: string; url?: string }): Promise<void> =>
    ipcRenderer.invoke(IPC.CORRECTION_SUBMIT, data),

  retroactiveCorrection: (blockId: number): Promise<void> =>
    ipcRenderer.invoke(IPC.CORRECTION_RETROACTIVE, blockId),

  // Notification response
  respondToNotification: (action: NotificationAction): Promise<void> =>
    ipcRenderer.invoke(IPC.NOTIFICATION_RESPOND, action),

  // HUD
  resizeHud: (expanded: boolean): void => ipcRenderer.send(IPC.HUD_RESIZE, expanded),

  // Utilities
  openExtensionFolder: (): Promise<void> => ipcRenderer.invoke(IPC.OPEN_EXTENSION_FOLDER),
  getAppPath: (): Promise<string> => ipcRenderer.invoke(IPC.APP_PATH_GET),

  // Push events from main → renderer
  onModeChanged: (cb: (mode: Mode) => void): Unsubscribe => {
    const handler = (_: Electron.IpcRendererEvent, mode: Mode) => cb(mode)
    ipcRenderer.on(IPC.MODE_CHANGED, handler)
    return () => ipcRenderer.removeListener(IPC.MODE_CHANGED, handler)
  },

  onScoreUpdated: (cb: (score: FocusScore) => void): Unsubscribe => {
    const handler = (_: Electron.IpcRendererEvent, score: FocusScore) => cb(score)
    ipcRenderer.on(IPC.SCORE_UPDATED, handler)
    return () => ipcRenderer.removeListener(IPC.SCORE_UPDATED, handler)
  },

  onBlockExecuted: (cb: (data: { appName: string; url: string | null }) => void): Unsubscribe => {
    const handler = (_: Electron.IpcRendererEvent, data: { appName: string; url: string | null }) => cb(data)
    ipcRenderer.on(IPC.BLOCK_EXECUTED, handler)
    return () => ipcRenderer.removeListener(IPC.BLOCK_EXECUTED, handler)
  },

  onHudNudge: (cb: (message: string) => void): Unsubscribe => {
    const handler = (_: Electron.IpcRendererEvent, message: string) => cb(message)
    ipcRenderer.on(IPC.HUD_NUDGE, handler)
    return () => ipcRenderer.removeListener(IPC.HUD_NUDGE, handler)
  },

  onPauseTick: (cb: (remainingMs: number) => void): Unsubscribe => {
    const handler = (_: Electron.IpcRendererEvent, remaining: number) => cb(remaining)
    ipcRenderer.on(IPC.PAUSE_TICK, handler)
    return () => ipcRenderer.removeListener(IPC.PAUSE_TICK, handler)
  },

  onPauseEnded: (cb: () => void): Unsubscribe => {
    const handler = () => cb()
    ipcRenderer.on(IPC.PAUSE_ENDED, handler)
    return () => ipcRenderer.removeListener(IPC.PAUSE_ENDED, handler)
  },

  onNotificationFire: (cb: (data: unknown) => void): Unsubscribe => {
    const handler = (_: Electron.IpcRendererEvent, data: unknown) => cb(data)
    ipcRenderer.on(IPC.NOTIFICATION_FIRE, handler)
    return () => ipcRenderer.removeListener(IPC.NOTIFICATION_FIRE, handler)
  },

  onNotificationCountdown: (cb: (seconds: number) => void): Unsubscribe => {
    const handler = (_: Electron.IpcRendererEvent, seconds: number) => cb(seconds)
    ipcRenderer.on(IPC.NOTIFICATION_COUNTDOWN, handler)
    return () => ipcRenderer.removeListener(IPC.NOTIFICATION_COUNTDOWN, handler)
  },
})
