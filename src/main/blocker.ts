import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { getDb } from './database'
import { blockLog, correctionProfile } from '../shared/schema'
import { getConfig } from './config'
import { closeTab, isExtensionConnected } from './websocket'
import { nudgeAfterBlock } from './lifecycle'

const execFileAsync = promisify(execFile)

function osascript(script: string): Promise<void> {
  return execFileAsync('osascript', ['-e', script], { timeout: 3_000 }).then(() => {}).catch(() => {})
}

export async function hideApp(appName: string, url?: string | null): Promise<void> {
  nudgeAfterBlock()
  // If extension is connected and we have a URL, close the specific tab instead of hiding the whole app
  if (url && isExtensionConnected()) {
    closeTab(url)
    return
  }
  const safe = appName.replace(/"/g, '')
  await osascript(`tell application "System Events" to set visible of process "${safe}" to false`)
}

export async function showApp(appName: string): Promise<void> {
  const safe = appName.replace(/"/g, '')
  await osascript(`tell application "System Events" to set visible of process "${safe}" to true`)
}

export function writeBlockLog(data: {
  appName: string | null
  url: string | null
  confidence: number
  reason: string
  triggerType: string
}): void {
  getDb().insert(blockLog).values({
    timestamp: new Date().toISOString(),
    appName: data.appName,
    url: data.url,
    confidence: data.confidence,
    reason: data.reason,
    triggerType: data.triggerType,
    durationOnAppBeforeBlock: null,
    falsePositive: false,
  }).run()
}

export function writeCorrection(data: {
  appName: string
  url: string | null
  correctionType: string
  contextString?: string
}): void {
  const config = getConfig()
  getDb().insert(correctionProfile).values({
    timestamp: new Date().toISOString(),
    appName: data.appName,
    url: data.url,
    taskLabel: config.taskLabel || null,
    correctionType: data.correctionType,
    contextString: data.contextString ?? null,
  }).run()
}
