export type Mode = 'focus' | 'free'
export type PauseDuration = 15 | 30 | 60
export type TriggerType = 'autonomous' | 'user' | 'passive'
export type CorrectionType = 'this_is_work' | 'retroactive'
export type NotificationType = 'passive-unsure' | 'passive-distraction' | 'warning-countdown'
export type NotificationAction = 'yes-work' | 'no-distraction' | 'this-is-work' | 'block-it' | 'ignored'

export interface AppConfig {
  apiKey: string
  onboardingComplete: boolean
  profession: string[]
  workStyle: string[]
  workApps: string[]
  workUrls: string[]
  permanentBlocklist: string[]
  whitelist: string[]
  workStartTime: string   // "09:00"
  workEndTime: string     // "18:00"
  hudVisible: boolean
  hudPosition: { x: number; y: number } | null
  mode: Mode
  calibrationDays: number
  taskLabel: string
}

export interface WindowTrackingEntry {
  id: number
  timestamp: string
  appName: string
  windowTitle: string | null
  url: string | null
  classificationResult: string | null
  confidence: number | null
  isDistraction: boolean | null
  actionTaken: string | null
}

export interface BlockLogEntry {
  id: number
  timestamp: string
  appName: string | null
  url: string | null
  confidence: number | null
  reason: string | null
  triggerType: TriggerType
  userResponse: string | null
  durationOnAppBeforeBlock: number | null
  falsePositive: boolean
}

export interface FocusScore {
  total: number
  focusRatioPoints: number
  blockResistancePoints: number
  distractionDepthPoints: number
  consistencyPoints: number
  summaryLine: string
  color: 'green' | 'amber' | 'red'
}

export interface BlockedApp {
  appName: string
  blockedAt: string
  url: string | null
}

export interface ClassificationResult {
  is_distraction: boolean
  confidence: number
  reason: string
  suggested_action: 'block' | 'notify' | 'allow'
}

export interface NotificationData {
  type: NotificationType
  appName: string
  url?: string
  countdown?: number
}

export interface ActiveWindowInfo {
  appName: string
  windowTitle: string
  url: string | null
}
