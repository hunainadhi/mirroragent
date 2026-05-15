import { BrowserWindow } from 'electron'
import { and, gte, lt } from 'drizzle-orm'
import { getDb } from './database'
import { windowTracking, blockLog, focusScoreDaily } from '../shared/schema'
import { IPC } from '../shared/ipc-channels'
import type { FocusScore } from '../shared/types'

function todayRange(): { start: string; end: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start.getTime() + 86_400_000)
  return { start: start.toISOString(), end: end.toISOString() }
}

export function calculateScore(): FocusScore {
  const db = getDb()
  const { start, end } = todayRange()

  const entries = db.select().from(windowTracking)
    .where(and(gte(windowTracking.timestamp, start), lt(windowTracking.timestamp, end)))
    .all()

  const classified = entries.filter((e) => e.classificationResult !== null)
  const workEntries = classified.filter((e) => !e.isDistraction)
  const distractionEntries = classified.filter((e) => e.isDistraction)

  // ── Focus ratio (40 pts) ──────────────────────────────────────────────────
  const focusRatioPoints = classified.length > 0
    ? Math.round((workEntries.length / classified.length) * 40)
    : 40

  // ── Block resistance (30 pts) — low false-positive rate = high score ──────
  const blocks = db.select().from(blockLog)
    .where(and(gte(blockLog.timestamp, start), lt(blockLog.timestamp, end)))
    .all()
  const falsePositives = blocks.filter((b) => b.falsePositive).length
  const blockResistancePoints = blocks.length > 0
    ? Math.round((1 - falsePositives / blocks.length) * 30)
    : 30

  // ── Distraction depth (20 pts) — penalise long consecutive streaks ────────
  let maxStreak = 0
  let streak = 0
  for (const e of entries) {
    if (e.isDistraction) { streak++; maxStreak = Math.max(maxStreak, streak) }
    else { streak = 0 }
  }
  // Every 6 consecutive distraction observations (~30s) costs 2pts, max penalty 20
  const distractionDepthPoints = Math.max(0, 20 - Math.floor(maxStreak / 6) * 2)

  // ── Consistency (10 pts) — work spread across distinct hours ─────────────
  const workHours = new Set(workEntries.map((e) => new Date(e.timestamp).getHours()))
  const consistencyPoints = Math.min(10, workHours.size)

  const total = focusRatioPoints + blockResistancePoints + distractionDepthPoints + consistencyPoints
  const color: FocusScore['color'] = total >= 70 ? 'green' : total >= 40 ? 'amber' : 'red'
  const summaryLine =
    total >= 80 ? 'Strong session. Keep it going.' :
    total >= 60 ? 'Decent progress. Stay focused.' :
    total >= 40 ? 'Losing ground. Refocus.' :
    'Rough session. Start fresh.'

  return { total, focusRatioPoints, blockResistancePoints, distractionDepthPoints, consistencyPoints, summaryLine, color }
}

export function persistScore(score: FocusScore): void {
  const db = getDb()
  const date = new Date().toISOString().slice(0, 10)
  db.insert(focusScoreDaily).values({
    date,
    finalScore: score.total,
    focusRatioPoints: score.focusRatioPoints,
    blockResistancePoints: score.blockResistancePoints,
    distractionDepthPoints: score.distractionDepthPoints,
    consistencyPoints: score.consistencyPoints,
    totalFocusMinutes: null,
    totalBlocks: null,
    summaryLine: score.summaryLine,
  }).onConflictDoUpdate({
    target: focusScoreDaily.date,
    set: {
      finalScore: score.total,
      focusRatioPoints: score.focusRatioPoints,
      blockResistancePoints: score.blockResistancePoints,
      distractionDepthPoints: score.distractionDepthPoints,
      consistencyPoints: score.consistencyPoints,
      summaryLine: score.summaryLine,
    },
  }).run()
}

export function broadcastScore(score: FocusScore): void {
  BrowserWindow.getAllWindows().forEach((w) => {
    if (!w.isDestroyed()) w.webContents.send(IPC.SCORE_UPDATED, score)
  })
}

let scoreInterval: ReturnType<typeof setInterval> | null = null

export function startScoreUpdater(): void {
  if (scoreInterval) return
  // Compute immediately on start, then every 5 minutes
  const tick = () => {
    const score = calculateScore()
    persistScore(score)
    broadcastScore(score)
  }
  tick()
  scoreInterval = setInterval(tick, 5 * 60 * 1_000)
}

export function stopScoreUpdater(): void {
  if (scoreInterval) { clearInterval(scoreInterval); scoreInterval = null }
}
