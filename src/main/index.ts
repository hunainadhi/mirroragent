import { app, BrowserWindow, ipcMain, shell } from 'electron'
import * as path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { loadConfig, getConfig, saveConfig } from './config'
import { initDatabase, closeDatabase } from './database'
import { startObserver, stopObserver } from './observer'
import { startClassifier, stopClassifier } from './classifier'
import { createTray, destroyTray, rebuildTrayMenu } from './tray'
import { createHud, setupHudIpc } from './hud'
import { startPause, extendPause, endPause } from './pause'
import { createNotificationWindow, setupNotificationIpc } from './notifications'
import { startWebSocketServer, stopWebSocketServer } from './websocket'
import { startScoreUpdater, stopScoreUpdater, calculateScore } from './score'
import { startDashboard, stopDashboard } from './dashboard'
import { setupPowerMonitor, startNudgeScheduler, stopNudgeScheduler, initMode } from './lifecycle'
import {
  checkPermissions,
  openAccessibilitySettings,
  openScreenRecordingSettings,
  allGranted,
} from './permissions'
import { IPC } from '../shared/ipc-channels'
import type { AppConfig, Mode, PauseDuration } from '../shared/types'

app.setName('MirrorAgent')

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let onboardingWindow: BrowserWindow | null = null
let recoveryWindow: BrowserWindow | null = null
let permissionPollInterval: ReturnType<typeof setInterval> | null = null

// ── Window factories ───────────────────────────────────────────────────────

function createOnboardingWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    resizable: false,
    center: true,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#09090b',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/onboarding/index.html`)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/onboarding/index.html'))
  }

  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools({ mode: 'detach' })
  }

  return win
}

function createRecoveryWindow(): BrowserWindow {
  if (recoveryWindow && !recoveryWindow.isDestroyed()) {
    recoveryWindow.focus()
    return recoveryWindow
  }

  const win = new BrowserWindow({
    width: 520,
    height: 380,
    resizable: false,
    center: true,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#09090b',
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/recovery/index.html`)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/recovery/index.html'))
  }

  win.on('closed', () => { recoveryWindow = null })
  recoveryWindow = win
  return win
}

// ── Permission monitoring ──────────────────────────────────────────────────

function startPermissionMonitor(): void {
  if (permissionPollInterval) return

  permissionPollInterval = setInterval(() => {
    const config = getConfig()
    if (!config.onboardingComplete) return

    const status = checkPermissions()
    if (!allGranted(status)) {
      BrowserWindow.getAllWindows().forEach((w) => {
        if (!w.isDestroyed()) w.webContents.send(IPC.PERMISSION_LOST, status)
      })
      if (!recoveryWindow || recoveryWindow.isDestroyed()) {
        createRecoveryWindow()
      }
    } else if (recoveryWindow && !recoveryWindow.isDestroyed()) {
      recoveryWindow.close()
    }
  }, 10_000)
}

// ── IPC handlers ───────────────────────────────────────────────────────────

function setupIpcHandlers(): void {
  ipcMain.handle(IPC.CONFIG_GET, () => {
    const config = getConfig()
    return { ...config, apiKey: config.apiKey ? '***redacted***' : '' }
  })

  ipcMain.handle(IPC.CONFIG_SET, (_, partial: Partial<AppConfig>) => {
    saveConfig(partial)
  })

  ipcMain.handle(IPC.CONFIG_RELOAD, () => {
    loadConfig()
  })

  ipcMain.handle(IPC.MODE_GET, () => getConfig().mode)

  ipcMain.handle(IPC.MODE_SET, (_, mode: Mode) => {
    saveConfig({ mode })
    BrowserWindow.getAllWindows().forEach((w) => {
      if (!w.isDestroyed()) w.webContents.send(IPC.MODE_CHANGED, mode)
    })
    rebuildTrayMenu()
  })

  ipcMain.handle(IPC.TASK_LABEL_SET, (_, label: string) => {
    saveConfig({ taskLabel: label })
    rebuildTrayMenu()
  })

  ipcMain.handle(IPC.API_KEY_VALIDATE, async (_, apiKey: string) => {
    const trimmed = typeof apiKey === 'string' ? apiKey.trim() : ''
    if (!trimmed.startsWith('sk-ant-')) return false
    try {
      const client = new Anthropic({ apiKey: trimmed })
      await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      })
      saveConfig({ apiKey: trimmed })
      return true
    } catch (err: unknown) {
      if ((err as { status?: number })?.status === 429) {
        saveConfig({ apiKey: trimmed })
        return true
      }
      return false
    }
  })

  ipcMain.handle(IPC.PERMISSIONS_CHECK, () => checkPermissions())
  ipcMain.handle(IPC.PERMISSIONS_OPEN_ACCESSIBILITY, () => openAccessibilitySettings())
  ipcMain.handle(IPC.PERMISSIONS_OPEN_SCREEN_RECORDING, () => openScreenRecordingSettings())

  ipcMain.handle(IPC.ONBOARDING_COMPLETE, (_, data: Partial<AppConfig>) => {
    saveConfig({ ...data, onboardingComplete: true, mode: 'focus' })
    onboardingWindow?.close()
    startPermissionMonitor()
    startObserver()
    startClassifier()
    createTray()
    createHud()
    createNotificationWindow()
    startScoreUpdater()
    startNudgeScheduler()
    initMode()
  })

  ipcMain.handle(IPC.APPS_SCAN, async () => {
    const { readdirSync } = await import('node:fs')
    const { KNOWN_WORK_APPS } = await import('../shared/constants')
    try {
      const installed = readdirSync('/Applications')
        .filter((f) => f.endsWith('.app'))
        .map((f) => f.replace(/\.app$/, ''))
      return KNOWN_WORK_APPS.filter((app) =>
        installed.some((name) => name.toLowerCase().includes(app.toLowerCase()))
      )
    } catch {
      return []
    }
  })

  // Pause
  ipcMain.handle(IPC.PAUSE_START, (_, duration: PauseDuration) => {
    startPause(duration)
    rebuildTrayMenu()
  })
  ipcMain.handle(IPC.PAUSE_EXTEND, () => {
    extendPause()
    rebuildTrayMenu()
  })
  ipcMain.handle(IPC.PAUSE_END, () => {
    endPause()
    rebuildTrayMenu()
  })

  ipcMain.handle(IPC.SCORE_GET, () => calculateScore())

  ipcMain.handle(IPC.APP_PATH_GET, () => app.getPath('exe'))

  ipcMain.handle(IPC.OPEN_EXTENSION_FOLDER, () => {
    const extensionPath = app.isPackaged
      ? path.join(process.resourcesPath, 'extension')
      : path.join(__dirname, '../../extension')
    shell.openPath(extensionPath)
  })

  ipcMain.handle(IPC.BLOCKED_APPS_GET, () => [])
  ipcMain.handle(IPC.BLOCKED_APPS_RESTORE, () => {})
  ipcMain.handle(IPC.CORRECTION_SUBMIT, () => {})
  ipcMain.handle(IPC.CORRECTION_RETROACTIVE, () => {})
}

// ── App lifecycle ──────────────────────────────────────────────────────────

app.whenReady().then(() => {
  app.dock?.hide()

  loadConfig()
  initDatabase()
  setupIpcHandlers()
  setupHudIpc()
  setupNotificationIpc()
  startWebSocketServer()
  startDashboard()
  setupPowerMonitor()

  const config = getConfig()

  if (!config.onboardingComplete) {
    onboardingWindow = createOnboardingWindow()
  } else {
    startPermissionMonitor()
    startObserver()
    startClassifier()
    createTray()
    createHud()
    createNotificationWindow()
    startScoreUpdater()
    startNudgeScheduler()
    initMode()
  }

  app.on('activate', () => {
    // On macOS, clicking the dock icon when all windows are closed
    // should do nothing (menubar-only app)
  })
})

app.on('window-all-closed', () => {
  // Don't quit on macOS when all windows close — tray keeps the app alive
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (permissionPollInterval) clearInterval(permissionPollInterval)
  stopObserver()
  stopClassifier()
  stopWebSocketServer()
  stopScoreUpdater()
  stopNudgeScheduler()
  stopDashboard()
  destroyTray()
  closeDatabase()
})
