import { BrowserWindow, ipcMain, screen } from 'electron'
import * as path from 'node:path'
import { getConfig, saveConfig } from './config'

const COLLAPSED = { width: 72, height: 36 }
const EXPANDED = { width: 280, height: 64 }

let hudWindow: BrowserWindow | null = null

export function createHud(): void {
  const config = getConfig()
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const { x: dx, y: dy, width: dw, height: dh } = display.workArea

  const defaultPos = { x: dx + dw - COLLAPSED.width - 16, y: dy + dh - COLLAPSED.height - 16 }
  const pos = config.hudPosition ?? defaultPos

  hudWindow = new BrowserWindow({
    width: COLLAPSED.width,
    height: COLLAPSED.height,
    x: pos.x,
    y: pos.y,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    hudWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/hud/index.html`)
  } else {
    hudWindow.loadFile(path.join(__dirname, '../renderer/hud/index.html'))
  }

  hudWindow.on('moved', () => {
    if (!hudWindow || hudWindow.isDestroyed()) return
    const [x, y] = hudWindow.getPosition()
    saveConfig({ hudPosition: { x, y } })
  })

  hudWindow.on('closed', () => { hudWindow = null })
}

export function setupHudIpc(): void {
  ipcMain.on('hud:resize', (_, expanded: boolean) => {
    if (!hudWindow || hudWindow.isDestroyed()) return
    const [cx, cy] = hudWindow.getPosition()
    const next = expanded ? EXPANDED : COLLAPSED

    // Keep right edge anchored when expanding/collapsing
    const currentWidth = hudWindow.getSize()[0]
    const newX = cx - (next.width - currentWidth)

    hudWindow.setPosition(Math.max(0, newX), cy, false)
    hudWindow.setSize(next.width, next.height, false)
  })
}

export function getHudWindow(): BrowserWindow | null {
  return hudWindow
}
