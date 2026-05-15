import { BrowserWindow, ipcMain, screen } from 'electron'
import * as path from 'node:path'
import { hideApp, writeBlockLog, writeCorrection } from './blocker'
import { startPause } from './pause'
import { IPC } from '../shared/ipc-channels'
import { PASSIVE_WAIT_MS } from '../shared/constants'
import type { ClassificationResult, ActiveWindowInfo, NotificationAction, NotificationType } from '../shared/types'

const COUNTDOWN_SECS = 30
const WIN_W = 340
const WIN_H = 152

type State = 'idle' | 'passive' | 'countdown'

let state: State = 'idle'
let notifWindow: BrowserWindow | null = null
let escalationTimer: ReturnType<typeof setTimeout> | null = null
let currentContext: { result: ClassificationResult; current: ActiveWindowInfo } | null = null

// ── Window ─────────────────────────────────────────────────────────────────

export function createNotificationWindow(): void {
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const { x: dx, y: dy, width: dw } = display.workArea

  notifWindow = new BrowserWindow({
    width: WIN_W,
    height: WIN_H,
    x: dx + dw - WIN_W - 16,
    y: dy + 24,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    notifWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/notification/index.html`)
  } else {
    notifWindow.loadFile(path.join(__dirname, '../renderer/notification/index.html'))
  }

  notifWindow.on('closed', () => { notifWindow = null })
}

function showWindow(type: NotificationType, appName: string, url: string | null, reason: string): void {
  if (!notifWindow || notifWindow.isDestroyed()) return
  notifWindow.webContents.send(IPC.NOTIFICATION_FIRE, { type, appName, url, reason, countdownSecs: COUNTDOWN_SECS })
  notifWindow.showInactive()
}

function hideWindow(): void {
  notifWindow?.hide()
}

// ── Timer helpers ──────────────────────────────────────────────────────────

function clearEscalation(): void {
  if (escalationTimer) { clearTimeout(escalationTimer); escalationTimer = null }
}

function scheduleEscalation(ms: number, fn: () => void): void {
  clearEscalation()
  escalationTimer = setTimeout(fn, ms)
}

// ── State machine ──────────────────────────────────────────────────────────

function enterPassive(result: ClassificationResult, current: ActiveWindowInfo): void {
  state = 'passive'
  currentContext = { result, current }
  const type: NotificationType = result.confidence < 75 ? 'passive-unsure' : 'passive-distraction'
  showWindow(type, current.appName, current.url, result.reason)

  scheduleEscalation(PASSIVE_WAIT_MS, () => {
    if (state === 'passive') enterCountdown()
  })
}

function enterCountdown(): void {
  if (!currentContext) return
  state = 'countdown'
  const { current, result } = currentContext
  showWindow('warning-countdown', current.appName, current.url, result.reason)

  scheduleEscalation(COUNTDOWN_SECS * 1_000, () => {
    if (state === 'countdown') executeBlock('autonomous')
  })
}

async function executeBlock(triggerType: string): Promise<void> {
  clearEscalation()
  const ctx = currentContext
  state = 'idle'
  currentContext = null
  hideWindow()

  if (!ctx) return

  const { current, result } = ctx
  await hideApp(current.appName, current.url)
  writeBlockLog({
    appName: current.appName,
    url: current.url,
    confidence: result.confidence,
    reason: result.reason,
    triggerType,
  })
}

function dismiss(): void {
  clearEscalation()
  state = 'idle'
  currentContext = null
  hideWindow()
}

// ── Public entry points ────────────────────────────────────────────────────

export function handleClassificationResult(result: ClassificationResult, current: ActiveWindowInfo): void {
  if (state !== 'idle') return

  if (result.suggested_action === 'allow') return

  if (result.suggested_action === 'block') {
    currentContext = { result, current }
    enterCountdown()
  } else {
    enterPassive(result, current)
  }
}

export function setupNotificationIpc(): void {
  ipcMain.handle(IPC.NOTIFICATION_RESPOND, (_, action: NotificationAction) => {
    const ctx = currentContext

    switch (action) {
      case 'yes-work':
      case 'this-is-work':
        if (ctx) {
          writeCorrection({
            appName: ctx.current.appName,
            url: ctx.current.url,
            correctionType: 'this_is_work',
            contextString: `${ctx.current.windowTitle ?? ''} — ${ctx.result.reason}`,
          })
        }
        dismiss()
        break

      case 'no-distraction':
        // User acknowledges it's a distraction and will stop themselves
        dismiss()
        break

      case 'block-it':
        void executeBlock('user')
        break

      case 'ignored':
        if (state === 'passive') enterCountdown()
        else dismiss()
        break
    }
  })
}
