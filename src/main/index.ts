import { app, BrowserWindow, ipcMain } from 'electron'
import * as path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { loadConfig, getConfig, saveConfig } from './config'
import { initDatabase, closeDatabase } from './database'
import { startObserver, stopObserver } from './observer'
import {
  checkPermissions,
  openAccessibilitySettings,
  openScreenRecordingSettings,
  allGranted,
} from './permissions'
import { IPC } from '../shared/ipc-channels'
import type { AppConfig, Mode } from '../shared/types'

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
      // Notify all windows
      BrowserWindow.getAllWindows().forEach((w) => {
        if (!w.isDestroyed()) w.webContents.send(IPC.PERMISSION_LOST, status)
      })
      // Show recovery window if not already showing
      if (!recoveryWindow || recoveryWindow.isDestroyed()) {
        createRecoveryWindow()
      }
    } else if (recoveryWindow && !recoveryWindow.isDestroyed()) {
      // Permissions restored — close recovery window
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
  })

  ipcMain.handle(IPC.TASK_LABEL_SET, (_, label: string) => {
    saveConfig({ taskLabel: label })
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
      // 429 = rate limited but key is valid
      if ((err as { status?: number })?.status === 429) {
        saveConfig({ apiKey: trimmed })
        return true
      }
      return false
    }
  })

  ipcMain.handle(IPC.PERMISSIONS_CHECK, () => checkPermissions())

  ipcMain.handle(IPC.PERMISSIONS_OPEN_ACCESSIBILITY, () => {
    openAccessibilitySettings()
  })

  ipcMain.handle(IPC.PERMISSIONS_OPEN_SCREEN_RECORDING, () => openScreenRecordingSettings())

  ipcMain.handle(IPC.ONBOARDING_COMPLETE, (_, data: Partial<AppConfig>) => {
    saveConfig({ ...data, onboardingComplete: true })
    onboardingWindow?.close()
    startPermissionMonitor()
    startObserver()
    // Day 6: create tray + HUD here
  })

  ipcMain.handle(IPC.APPS_SCAN, async () => {
    // Day 8: scan /Applications and filter by KNOWN_WORK_APPS
    return []
  })
}

// ── App lifecycle ──────────────────────────────────────────────────────────

app.whenReady().then(() => {
  loadConfig()
  initDatabase()
  setupIpcHandlers()

  const config = getConfig()

  if (!config.onboardingComplete) {
    onboardingWindow = createOnboardingWindow()
  } else {
    startPermissionMonitor()
    startObserver()
    // Day 6: show tray instead of re-opening onboarding
    onboardingWindow = createOnboardingWindow()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      onboardingWindow = createOnboardingWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (permissionPollInterval) clearInterval(permissionPollInterval)
  stopObserver()
  closeDatabase()
})
