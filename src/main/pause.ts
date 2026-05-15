import { BrowserWindow } from 'electron'
import { saveConfig } from './config'
import { IPC } from '../shared/ipc-channels'
import type { PauseDuration } from '../shared/types'

const COOLDOWN_MS = 10 * 60 * 1_000

let pauseEndAt = 0
let ticker: ReturnType<typeof setInterval> | null = null
let cooldownUntil = 0
let extendUsed = false

function broadcast(channel: string, ...args: unknown[]): void {
  BrowserWindow.getAllWindows().forEach((w) => {
    if (!w.isDestroyed()) w.webContents.send(channel, ...args)
  })
}

function stopTicker(): void {
  if (ticker) { clearInterval(ticker); ticker = null }
}

function startTicker(): void {
  stopTicker()
  ticker = setInterval(() => {
    const remaining = pauseEndAt - Date.now()
    if (remaining <= 0) {
      stopTicker()
      pauseEndAt = 0
      cooldownUntil = Date.now() + COOLDOWN_MS
      extendUsed = false
      saveConfig({ mode: 'focus' })
      broadcast(IPC.PAUSE_ENDED)
      broadcast(IPC.MODE_CHANGED, 'focus')
    } else {
      broadcast(IPC.PAUSE_TICK, remaining)
    }
  }, 1_000)
}

export function startPause(duration: PauseDuration): void {
  pauseEndAt = Date.now() + duration * 60 * 1_000
  extendUsed = false
  saveConfig({ mode: 'free' })
  broadcast(IPC.MODE_CHANGED, 'free')
  startTicker()
}

export function extendPause(): void {
  if (extendUsed || !isPaused()) return
  pauseEndAt += 15 * 60 * 1_000
  extendUsed = true
}

export function endPause(): void {
  stopTicker()
  pauseEndAt = 0
  cooldownUntil = Date.now() + COOLDOWN_MS
  extendUsed = false
  saveConfig({ mode: 'focus' })
  broadcast(IPC.PAUSE_ENDED)
  broadcast(IPC.MODE_CHANGED, 'focus')
}

export function isPaused(): boolean {
  return pauseEndAt > Date.now()
}

export function isInCooldown(): boolean {
  return Date.now() < cooldownUntil
}

export function getPauseRemainingMs(): number {
  return Math.max(0, pauseEndAt - Date.now())
}

export function canExtend(): boolean {
  return isPaused() && !extendUsed
}

export function stopPauseTimer(): void {
  stopTicker()
}
