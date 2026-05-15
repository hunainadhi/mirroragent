import { powerMonitor, BrowserWindow, Notification } from 'electron'
import { getConfig, saveConfig } from './config'
import { startObserver, stopObserver } from './observer'
import { startClassifier, stopClassifier } from './classifier'
import { startScoreUpdater, stopScoreUpdater, calculateScore } from './score'
import { isPaused } from './pause'
import { IPC } from '../shared/ipc-channels'
import { AMBIENT_NUDGES } from '../shared/constants'

// ── Helpers ────────────────────────────────────────────────────────────────

export function broadcastNudge(message: string): void {
  BrowserWindow.getAllWindows().forEach((w) => {
    if (!w.isDestroyed()) w.webContents.send(IPC.HUD_NUDGE, message)
  })
}

function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function isWithinWorkingHours(): boolean {
  const config = getConfig()
  if (!config.workStartTime || !config.workEndTime) return true
  const now = new Date().getHours() * 60 + new Date().getMinutes()
  return now >= parseTime(config.workStartTime) && now < parseTime(config.workEndTime)
}

// ── Sleep / wake ───────────────────────────────────────────────────────────

export function setupPowerMonitor(): void {
  powerMonitor.on('suspend', () => {
    stopObserver()
    stopClassifier()
    stopScoreUpdater()
  })

  powerMonitor.on('resume', () => {
    const config = getConfig()
    if (!config.onboardingComplete) return
    startObserver()
    startClassifier()
    startScoreUpdater()
    broadcastNudge(AMBIENT_NUDGES.resumed)
  })

  powerMonitor.on('lock-screen', () => {
    stopObserver()
    stopClassifier()
  })

  powerMonitor.on('unlock-screen', () => {
    const config = getConfig()
    if (!config.onboardingComplete) return
    startObserver()
    startClassifier()
  })
}

// ── Calibration ────────────────────────────────────────────────────────────

let lastCalibrationDate = ''

function maybeIncrementCalibration(): void {
  const today = new Date().toISOString().slice(0, 10)
  if (today === lastCalibrationDate) return
  lastCalibrationDate = today

  const config = getConfig()
  if (config.calibrationDays >= 7) return

  const next = config.calibrationDays + 1
  saveConfig({ calibrationDays: next })

  if (next === 7) showCalibrationSummary()
}

function showCalibrationSummary(): void {
  if (!Notification.isSupported()) return
  const score = calculateScore()
  new Notification({
    title: 'MirrorAgent is calibrated',
    body: `7 days in. Confidence threshold is now at 70. Today's score: ${score.total}. ${score.summaryLine}`,
  }).show()
}

// ── Nudge scheduler ────────────────────────────────────────────────────────

let nudgeInterval: ReturnType<typeof setInterval> | null = null
let sessionStart = Date.now()
const nudgeSent = new Set<string>()
let wasInWorkHours: boolean | null = null

function broadcastModeChange(mode: 'focus' | 'free'): void {
  saveConfig({ mode })
  BrowserWindow.getAllWindows().forEach((w) => {
    if (!w.isDestroyed()) w.webContents.send(IPC.MODE_CHANGED, mode)
  })
}

export function initMode(): void {
  const config = getConfig()
  if (!config.onboardingComplete) return
  if (isPaused()) return

  const inWorkHours = isWithinWorkingHours()
  const correctMode = inWorkHours ? 'focus' : 'free'

  if (config.mode !== correctMode) {
    broadcastModeChange(correctMode)
  }
}

export function startNudgeScheduler(): void {
  if (nudgeInterval) return
  sessionStart = Date.now()
  nudgeSent.clear()

  nudgeInterval = setInterval(() => {
    const config = getConfig()
    if (!config.onboardingComplete) return

    maybeIncrementCalibration()

    const inWorkHours = isWithinWorkingHours()

    // Auto-switch to focus when work hours begin (unless user is on a pause)
    if (inWorkHours && !wasInWorkHours && !isPaused()) {
      if (config.mode === 'free') {
        broadcastModeChange('focus')
        sessionStart = Date.now()
        nudgeSent.clear()
        broadcastNudge('Work hours started. Switching to focus.')
      }
    }

    // Auto-switch to free when work hours end
    if (!inWorkHours && wasInWorkHours && config.mode === 'focus' && !isPaused()) {
      broadcastModeChange('free')
      broadcastNudge('Work hours over. Switching to free.')
    }

    wasInWorkHours = inWorkHours

    // Only send nudges during work hours and while in focus mode
    if (!inWorkHours || config.mode === 'free') return

    const sessionMins = (Date.now() - sessionStart) / 60_000
    const score = calculateScore()

    if (sessionMins >= 30 && !nudgeSent.has('first_30')) {
      nudgeSent.add('first_30')
      broadcastNudge(AMBIENT_NUDGES.first_30_min)
    }

    if (sessionMins >= 120 && score.total >= 70 && !nudgeSent.has('two_hours')) {
      nudgeSent.add('two_hours')
      broadcastNudge(AMBIENT_NUDGES.two_hours_clean)
    }

    // Hourly score check
    const hourBucket = `score_${Math.floor(sessionMins / 60)}`
    if (!nudgeSent.has(hourBucket) && score.total > 0) {
      nudgeSent.add(hourBucket)
      if (score.total >= 80) broadcastNudge(AMBIENT_NUDGES.score_above_80)
      else if (score.total < 50) broadcastNudge(AMBIENT_NUDGES.score_below_50)
    }

    // 30 min before end of work day
    const endMins = parseTime(config.workEndTime || '18:00')
    const nowMins = new Date().getHours() * 60 + new Date().getMinutes()
    if (!nudgeSent.has('near_end') && endMins - nowMins <= 30 && endMins - nowMins > 0) {
      nudgeSent.add('near_end')
      broadcastNudge(AMBIENT_NUDGES.near_end_time)
    }
  }, 60_000)
}

export function stopNudgeScheduler(): void {
  if (nudgeInterval) { clearInterval(nudgeInterval); nudgeInterval = null }
}

export function nudgeAfterBlock(): void {
  broadcastNudge(AMBIENT_NUDGES.after_block)
}

export function nudgeAfterPauseResume(): void {
  sessionStart = Date.now()
  nudgeSent.clear()
  broadcastNudge(AMBIENT_NUDGES.after_pause_resume)
}
