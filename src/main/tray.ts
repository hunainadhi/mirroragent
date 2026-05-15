import { Tray, Menu, BrowserWindow, nativeImage, shell, app } from 'electron'
import { getConfig, saveConfig } from './config'

const ICON_FILLED = 'iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAARklEQVR4nO3NwQ0AIAxC0e4/qGvgAkaB2oOxP+H6iOjYAIzVroOpAxaVcBWl8RLYRY94ww/DGXyLlsIOTqEqLqHMgQ3+1wR/miierM7GfQAAAABJRU5ErkJggg=='
const ICON_HOLLOW = 'iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAATklEQVR4nGNgGAXEgv///z/DhqluIEUWEGsoSYYTo5Esw0lRTLRaUl1BtHpyImXUYPINpmrkkepqstMxVTMILo10Ly9IMpQYC8g2cOQBABZn8ZCF7k0oAAAAAElFTkSuQmCC'
import { startPause, extendPause, endPause, isPaused, canExtend } from './pause'
import { IPC } from '../shared/ipc-channels'
import { DASHBOARD_PORT } from '../shared/constants'

let tray: Tray | null = null

function broadcast(channel: string, ...args: unknown[]): void {
  BrowserWindow.getAllWindows().forEach((w) => {
    if (!w.isDestroyed()) w.webContents.send(channel, ...args)
  })
}

export function rebuildTrayMenu(): void {
  if (!tray) return
  const config = getConfig()
  const paused = isPaused()

  const pauseItems: Electron.MenuItemConstructorOptions[] = paused
    ? [
        { label: 'End pause now', click: () => { endPause(); rebuildTrayMenu() } },
        {
          label: 'Extend 15 min',
          enabled: canExtend(),
          click: () => { extendPause(); rebuildTrayMenu() },
        },
      ]
    : [
        { label: '15 minutes', click: () => { startPause(15); rebuildTrayMenu() } },
        { label: '30 minutes', click: () => { startPause(30); rebuildTrayMenu() } },
        { label: '1 hour', click: () => { startPause(60); rebuildTrayMenu() } },
      ]

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: config.mode === 'focus' ? '● Focus mode' : '○ Free mode',
      click: () => {
        const next = config.mode === 'focus' ? 'free' : 'focus'
        saveConfig({ mode: next })
        broadcast(IPC.MODE_CHANGED, next)
        updateTrayIcon()
        rebuildTrayMenu()
      },
    },
    {
      label: config.taskLabel ? `Task: ${config.taskLabel}` : 'No task set',
      enabled: false,
    },
    { type: 'separator' },
    { label: paused ? 'Pause (active)' : 'Take a break', submenu: pauseItems },
    { type: 'separator' },
    {
      label: 'Open Dashboard',
      click: () => shell.openExternal(`http://localhost:${DASHBOARD_PORT}`),
    },
    { type: 'separator' },
    { label: 'Quit MirrorAgent', click: () => app.quit() },
  ]

  tray.setContextMenu(Menu.buildFromTemplate(template))
  updateTrayIcon()
}

function makeIcon(b64: string): Electron.NativeImage {
  const img = nativeImage.createFromBuffer(Buffer.from(b64, 'base64'))
  img.setTemplateImage(true)
  return img
}

export function updateTrayIcon(): void {
  if (!tray) return
  const { mode } = getConfig()
  tray.setImage(makeIcon(mode === 'focus' ? ICON_FILLED : ICON_HOLLOW))
}

export function createTray(): void {
  const { mode } = getConfig()
  const icon = makeIcon(mode === 'focus' ? ICON_FILLED : ICON_HOLLOW)

  tray = new Tray(icon)
  tray.setToolTip('MirrorAgent')
  tray.on('click', () => tray?.popUpContextMenu())

  rebuildTrayMenu()
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
