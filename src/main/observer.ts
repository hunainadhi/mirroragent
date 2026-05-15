import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { getDb } from './database'
import { getConfig } from './config'
import { hideApp, writeBlockLog } from './blocker'
import { windowTracking } from '../shared/schema'
import { OBSERVATION_INTERVAL_MS } from '../shared/constants'
import type { ActiveWindowInfo } from '../shared/types'

// Debounce: don't block the same app more than once per 60s
const recentlyBlocked = new Map<string, number>()

const execFileAsync = promisify(execFile)

const GET_ACTIVE_WINDOW_SCRIPT = `
tell application "System Events"
  set frontApp to first application process whose frontmost is true
  set appName to name of frontApp
  try
    set winTitle to name of first window of frontApp
  on error
    set winTitle to ""
  end try
  return appName & "\t" & winTitle
end tell
`

const BROWSER_URL_SCRIPTS: Record<string, string> = {
  'Google Chrome': 'tell application "Google Chrome" to return URL of active tab of first window',
  Safari: 'tell application "Safari" to return URL of current tab of first window',
  Firefox: 'tell application "Firefox" to return URL of active tab of first window',
  Arc: 'tell application "Arc" to return URL of active tab of first window',
  'Brave Browser': 'tell application "Brave Browser" to return URL of active tab of first window',
  'Microsoft Edge': 'tell application "Microsoft Edge" to return URL of active tab of first window',
}

async function getActiveWindowInfo(): Promise<ActiveWindowInfo | null> {
  try {
    const { stdout } = await execFileAsync('osascript', ['-e', GET_ACTIVE_WINDOW_SCRIPT], {
      timeout: 2_000,
    })
    const parts = stdout.trim().split('\t')
    const appName = parts[0]
    if (!appName) return null
    const windowTitle = parts.slice(1).join('\t') || ''

    let url: string | null = null
    const urlScript = BROWSER_URL_SCRIPTS[appName]
    if (urlScript) {
      try {
        const { stdout: urlOut } = await execFileAsync('osascript', ['-e', urlScript], {
          timeout: 2_000,
        })
        url = urlOut.trim() || null
      } catch {
        // not a browser or no open window
      }
    }

    return { appName, windowTitle, url }
  } catch {
    return null
  }
}

type GateResult = 'whitelist' | 'blocklist' | 'observe'

function preClassificationGate(info: ActiveWindowInfo): GateResult {
  const config = getConfig()
  const appLower = info.appName.toLowerCase()
  const urlLower = info.url?.toLowerCase() ?? ''

  const matchesEntry = (entry: string) => {
    const e = entry.toLowerCase()
    return appLower.includes(e) || (urlLower && urlLower.includes(e))
  }

  if (config.permanentBlocklist.some(matchesEntry)) return 'blocklist'
  if (config.whitelist.some(matchesEntry) || config.workApps.some(matchesEntry)) return 'whitelist'
  return 'observe'
}

function writeEntry(info: ActiveWindowInfo, gate: GateResult): void {
  const db = getDb()
  db.insert(windowTracking).values({
    timestamp: new Date().toISOString(),
    appName: info.appName,
    windowTitle: info.windowTitle || null,
    url: info.url,
    classificationResult: gate === 'observe' ? null : gate === 'whitelist' ? 'work' : 'distraction',
    confidence: gate === 'observe' ? null : 100,
    isDistraction: gate === 'observe' ? null : gate === 'blocklist',
    actionTaken: gate === 'blocklist' ? 'pending_block' : null,
  }).run()
}

let observerInterval: ReturnType<typeof setInterval> | null = null
let lastWindowInfo: ActiveWindowInfo | null = null

export function startObserver(): void {
  if (observerInterval) return

  observerInterval = setInterval(async () => {
    const config = getConfig()
    if (!config.onboardingComplete || config.mode === 'free') return

    const info = await getActiveWindowInfo()
    if (!info) return

    const gate = preClassificationGate(info)
    writeEntry(info, gate)
    lastWindowInfo = info

    if (gate === 'blocklist') {
      const lastAt = recentlyBlocked.get(info.appName) ?? 0
      if (Date.now() - lastAt > 5_000) {
        recentlyBlocked.set(info.appName, Date.now())
        void hideApp(info.appName, info.url)
        writeBlockLog({
          appName: info.appName,
          url: info.url,
          confidence: 100,
          reason: 'permanent blocklist',
          triggerType: 'autonomous',
        })
      }
    }
  }, OBSERVATION_INTERVAL_MS)
}

export function stopObserver(): void {
  if (observerInterval) {
    clearInterval(observerInterval)
    observerInterval = null
  }
}

// Used by Day 5 classifier to know the current context
export function getLastWindowInfo(): ActiveWindowInfo | null {
  return lastWindowInfo
}

// Called by Day 5 when app/URL changes trigger an immediate screenshot
export function resetLastWindowInfo(): void {
  lastWindowInfo = null
}
