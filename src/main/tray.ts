import { Tray, Menu, BrowserWindow, nativeImage, shell, app } from 'electron'
import * as path from 'node:path'
import { getConfig, saveConfig } from './config'
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

function loadIcon(filename: string): Electron.NativeImage {
  const p = app.isPackaged
    ? path.join(process.resourcesPath, filename)
    : path.join(__dirname, `../../resources/${filename}`)
  const img = nativeImage.createFromPath(p).resize({ width: 18, height: 18 })
  img.setTemplateImage(true)
  return img
}

export function updateTrayIcon(): void {
  if (!tray) return
  const { mode } = getConfig()
  tray.setImage(mode === 'focus' ? loadIcon('trayIcon.png') : loadIcon('trayIconFree.png'))
}

export function createTray(): void {
  const { mode } = getConfig()
  const icon = mode === 'focus' ? loadIcon('trayIcon.png') : loadIcon('trayIconFree.png')

  tray = new Tray(icon)
  tray.setToolTip('MirrorAgent')
  tray.on('click', () => tray?.popUpContextMenu())

  rebuildTrayMenu()
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
