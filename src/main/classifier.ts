import { desktopCapturer, screen } from 'electron'
import Anthropic from '@anthropic-ai/sdk'
import { eq } from 'drizzle-orm'
import { getDb } from './database'
import { getConfig } from './config'
import { windowTracking } from '../shared/schema'
import {
  SCREENSHOT_INTERVAL_MS,
  MIN_MS_BETWEEN_CALLS,
  MAX_CALLS_PER_MINUTE,
  CALIBRATION_THRESHOLDS,
  DEFAULT_CONFIDENCE_THRESHOLD,
} from '../shared/constants'
import { getLastWindowInfo, resetLastWindowInfo } from './observer'
import { handleClassificationResult } from './notifications'
import { correctionProfile } from '../shared/schema'
import type { ActiveWindowInfo, ClassificationResult } from '../shared/types'

let screenshotInterval: ReturnType<typeof setInterval> | null = null
let lastCallAt = 0
let callsThisMinute = 0
let minuteWindowStart = Date.now()
let lastKnownApp = ''
let lastKnownUrl = ''
// Cache last result per app+url — skip re-classification if still work
let lastCacheKey = ''
let lastCacheResult: 'work' | 'distraction' | null = null

// ── Rate limiter ───────────────────────────────────────────────────────────

function canCallClaude(): boolean {
  const now = Date.now()

  // Reset per-minute counter
  if (now - minuteWindowStart >= 60_000) {
    callsThisMinute = 0
    minuteWindowStart = now
  }

  if (now - lastCallAt < MIN_MS_BETWEEN_CALLS) return false
  if (callsThisMinute >= MAX_CALLS_PER_MINUTE) return false
  return true
}

function recordCall(): void {
  lastCallAt = Date.now()
  callsThisMinute++
}

// ── Screenshot ─────────────────────────────────────────────────────────────

async function captureScreenshot(): Promise<string | null> {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 640, height: 400 },
    })
    if (sources.length === 0) return null

    // On multi-monitor setups, capture the display where the cursor is
    let source = sources[0]
    if (sources.length > 1) {
      const cursor = screen.getCursorScreenPoint()
      const active = screen.getDisplayNearestPoint(cursor)
      const match = sources.find((s) => s.display_id === String(active.id))
      if (match) source = match
    }

    return source.thumbnail.toPNG().toString('base64')
  } catch {
    return null
  }
}

// ── Rolling context ────────────────────────────────────────────────────────

function buildRollingContext(): string {
  const db = getDb()
  const rows = db
    .select({
      timestamp: windowTracking.timestamp,
      appName: windowTracking.appName,
      windowTitle: windowTracking.windowTitle,
      url: windowTracking.url,
    })
    .from(windowTracking)
    .orderBy(windowTracking.id)
    .limit(10)
    .all()
    .slice(-10)

  if (rows.length === 0) return 'No recent window history.'

  return rows
    .map((r) => {
      const time = new Date(r.timestamp).toLocaleTimeString()
      const loc = r.url ? r.url : r.windowTitle || r.appName
      return `[${time}] ${r.appName} — ${loc}`
    })
    .join('\n')
}

// ── Correction memory ──────────────────────────────────────────────────────

function buildCorrectionMemory(): string {
  const db = getDb()
  const rows = db.select().from(correctionProfile)
    .orderBy(correctionProfile.id)
    .limit(30)
    .all()

  if (rows.length === 0) return ''

  // Deduplicate by app+url — latest correction per target wins
  const seen = new Map<string, { label: string; isWork: boolean }>()
  for (const row of rows) {
    const key = row.url
      ? row.url.replace(/^https?:\/\//, '').split('/')[0]
      : row.appName ?? ''
    if (!key) continue
    seen.set(key, {
      label: key,
      isWork: row.correctionType === 'this_is_work',
    })
  }

  const workExamples = [...seen.values()].filter((e) => e.isWork).map((e) => e.label)
  // retroactive = user clicked "Block now", confirming distraction
  const distractionExamples = [...seen.values()].filter((e) => !e.isWork).map((e) => e.label)

  const lines: string[] = []
  if (workExamples.length) lines.push(`User confirmed as WORK: ${workExamples.join(', ')}.`)
  if (distractionExamples.length) lines.push(`User confirmed as DISTRACTION: ${distractionExamples.join(', ')}.`)

  return lines.length ? `\nPast corrections (trust these over your own judgment):\n${lines.join('\n')}` : ''
}

// ── Confidence threshold ───────────────────────────────────────────────────

function getThreshold(): number {
  const { calibrationDays } = getConfig()
  return CALIBRATION_THRESHOLDS[calibrationDays] ?? DEFAULT_CONFIDENCE_THRESHOLD
}

// ── Claude classification ──────────────────────────────────────────────────

async function classify(
  screenshot: string,
  current: ActiveWindowInfo,
  context: string,
): Promise<ClassificationResult | null> {
  const config = getConfig()
  if (!config.apiKey) return null

  const client = new Anthropic({ apiKey: config.apiKey })

  const professionHint = config.profession.length
    ? `The user is a ${config.profession.join(', ')}.`
    : ''
  const workAppsHint = config.workApps.length
    ? `Their known work apps: ${config.workApps.join(', ')}.`
    : ''
  const taskHint = config.taskLabel ? `Current task: "${config.taskLabel}".` : ''
  const correctionMemory = buildCorrectionMemory()

  const systemPrompt = `You are MirrorAgent, a focus assistant. ${professionHint} ${workAppsHint} ${taskHint}${correctionMemory}
Classify the user's current screen activity as work or distraction based on the screenshot and recent window history.
Respond ONLY with valid JSON matching this schema:
{"is_distraction": boolean, "confidence": number (0-100), "reason": string (max 20 words), "suggested_action": "block" | "notify" | "allow"}`

  const userContent = `Recent window history (oldest → newest):
${context}

Current: ${current.appName}${current.url ? ` — ${current.url}` : current.windowTitle ? ` — ${current.windowTitle}` : ''}

Classify this activity.`

  try {
    recordCall()
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: screenshot },
            },
            { type: 'text', text: userContent },
          ],
        },
      ],
    })

    const text = response.content.find((b) => b.type === 'text')?.text ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0]) as ClassificationResult
    if (typeof parsed.is_distraction !== 'boolean' || typeof parsed.confidence !== 'number') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

// ── Write result back to DB ────────────────────────────────────────────────

function writeClassification(result: ClassificationResult): void {
  const db = getDb()
  // Update the most recent unclassified entry for this window
  const latest = db
    .select({ id: windowTracking.id })
    .from(windowTracking)
    .where(eq(windowTracking.classificationResult, null as unknown as string))
    .orderBy(windowTracking.id)
    .limit(1)
    .all()
    .pop()

  if (!latest) return

  db.update(windowTracking)
    .set({
      classificationResult: result.is_distraction ? 'distraction' : 'work',
      confidence: result.confidence,
      isDistraction: result.is_distraction,
      actionTaken: result.suggested_action,
    })
    .where(eq(windowTracking.id, latest.id))
    .run()
}

// ── Main loop tick ─────────────────────────────────────────────────────────

async function tick(triggeredByChange = false): Promise<void> {
  const config = getConfig()
  if (!config.onboardingComplete || config.mode === 'free') return

  const current = getLastWindowInfo()
  if (!current) return

  if (!canCallClaude()) return

  // Skip if same app+URL was classified as work since last change
  const cacheKey = `${current.appName}|${current.url ?? ''}`
  if (cacheKey === lastCacheKey && lastCacheResult === 'work' && !triggeredByChange) return

  const screenshot = await captureScreenshot()
  if (!screenshot) return

  const context = buildRollingContext()
  const result = await classify(screenshot, current, context)
  if (!result) return

  writeClassification(result)
  lastCacheKey = cacheKey
  lastCacheResult = result.is_distraction ? 'distraction' : 'work'

  const threshold = getThreshold()
  if (result.is_distraction && result.confidence >= threshold) {
    handleClassificationResult(result, current)
  }
}

// ── Change detection ───────────────────────────────────────────────────────

function checkForChange(): void {
  const current = getLastWindowInfo()
  if (!current) return

  const changed =
    current.appName !== lastKnownApp || (current.url ?? '') !== lastKnownUrl

  if (changed) {
    lastKnownApp = current.appName
    lastKnownUrl = current.url ?? ''
    lastCacheKey = ''
    lastCacheResult = null
    resetLastWindowInfo()
    tick(true).catch(() => {})
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export function startClassifier(): void {
  if (screenshotInterval) return

  // Regular 30s screenshot cycle
  screenshotInterval = setInterval(() => {
    tick().catch(() => {})
  }, SCREENSHOT_INTERVAL_MS)

  // Change detection runs on the observer cadence (5s)
  setInterval(checkForChange, 5_000)
}

export function stopClassifier(): void {
  if (screenshotInterval) {
    clearInterval(screenshotInterval)
    screenshotInterval = null
  }
}

export function getRateLimiterStatus(): { lastCallAt: number; callsThisMinute: number; minGapMs: number; maxPerMinute: number } {
  return { lastCallAt, callsThisMinute, minGapMs: MIN_MS_BETWEEN_CALLS, maxPerMinute: MAX_CALLS_PER_MINUTE }
}
