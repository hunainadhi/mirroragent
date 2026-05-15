export const APP_NAME = 'MirrorAgent'
export const DB_FILENAME = 'mirror.db'
export const CONFIG_FILENAME = 'config.json'

export const OBSERVATION_INTERVAL_MS = 5_000
export const SCREENSHOT_INTERVAL_MS = 60_000
export const MIN_MS_BETWEEN_CALLS = 60_000
export const MAX_CALLS_PER_MINUTE = 1

export const WEBSOCKET_PORT = 1423
export const DASHBOARD_PORT = 1422

export const PASSIVE_WAIT_MS = 2 * 60 * 1_000
export const AUTO_BLOCK_TIMEOUT_MS = 3 * 60 * 1_000
export const MICRO_DRIFT_WINDOW_MS = 5 * 60 * 1_000
export const MICRO_DRIFT_THRESHOLD = 3
export const COOLDOWN_MS = 10 * 60 * 1_000

export const CALIBRATION_THRESHOLDS: Record<number, number> = {
  1: 85,
  2: 85,
  3: 85,
  4: 80,
  5: 75,
  6: 72,
}
export const DEFAULT_CONFIDENCE_THRESHOLD = 70

export const DEFAULT_CONFIG = {
  apiKey: '',
  onboardingComplete: false,
  profession: [] as string[],
  workStyle: [] as string[],
  workApps: [] as string[],
  workUrls: [] as string[],
  permanentBlocklist: [] as string[],
  whitelist: [] as string[],
  workStartTime: '09:00',
  workEndTime: '18:00',
  hudVisible: true,
  hudPosition: null as { x: number; y: number } | null,
  mode: 'free' as const,
  calibrationDays: 0,
  taskLabel: '',
}

export const KNOWN_WORK_APPS = [
  'Visual Studio Code',
  'Xcode',
  'Figma',
  'Sketch',
  'Adobe Photoshop',
  'Adobe Illustrator',
  'Notion',
  'Obsidian',
  'Bear',
  'Things 3',
  'Linear',
  'Jira',
  'Slack',
  'Microsoft Teams',
  'Zoom',
  'Terminal',
  'iTerm2',
  'Warp',
  'Postman',
  'TablePlus',
  'DataGrip',
  'IntelliJ IDEA',
  'WebStorm',
  'PyCharm',
  'Cursor',
  'Zed',
]

export const KNOWN_DISTRACTION_APPS = [
  'Twitter',
  'X',
  'Instagram',
  'TikTok',
  'YouTube',
  'Netflix',
  'Spotify',
  'Discord',
  'Reddit',
  'Facebook',
  'Messages',
  'WhatsApp',
  'Telegram',
]

export const AMBIENT_NUDGES: Record<string, string> = {
  first_30_min: 'Good start. Keep it going.',
  two_hours_clean: 'Two hours clean. You are locked in.',
  after_block: 'Distraction blocked. Back on track.',
  score_above_80: 'Strong day so far. Do not stop now.',
  score_below_50: 'Losing ground. Refocus.',
  near_end_time: 'Home stretch. Finish strong.',
  free_mode: 'Enjoying your break.',
  after_pause_resume: 'Break over. Back to it.',
  this_is_work: 'Got it. I will remember that.',
  resumed: 'MirrorAgent resumed.',
}
