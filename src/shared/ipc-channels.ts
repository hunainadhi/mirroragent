export const IPC = {
  // Renderer → Main (invoke/handle)
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  CONFIG_RELOAD: 'config:reload',
  MODE_GET: 'mode:get',
  MODE_SET: 'mode:set',
  TASK_LABEL_SET: 'task-label:set',
  PAUSE_START: 'pause:start',
  PAUSE_EXTEND: 'pause:extend',
  PAUSE_END: 'pause:end',
  BLOCKED_APPS_GET: 'blocked-apps:get',
  BLOCKED_APPS_RESTORE: 'blocked-apps:restore',
  CORRECTION_SUBMIT: 'correction:submit',
  CORRECTION_RETROACTIVE: 'correction:retroactive',
  APPS_SCAN: 'apps:scan',
  API_KEY_VALIDATE: 'api-key:validate',
  PERMISSIONS_CHECK: 'permissions:check',
  PERMISSIONS_OPEN_ACCESSIBILITY: 'permissions:open-accessibility',
  PERMISSIONS_OPEN_SCREEN_RECORDING: 'permissions:open-screen-recording',
  SCORE_GET: 'score:get',
  NOTIFICATION_RESPOND: 'notification:respond',
  ONBOARDING_COMPLETE: 'onboarding:complete',
  OPEN_EXTENSION_FOLDER: 'open:extension-folder',

  // Renderer → Main (send, no reply)
  HUD_RESIZE: 'hud:resize',

  // Main → Renderer (send)
  MODE_CHANGED: 'mode:changed',
  SCORE_UPDATED: 'score:updated',
  BLOCK_EXECUTED: 'block:executed',
  NOTIFICATION_FIRE: 'notification:fire',
  NOTIFICATION_COUNTDOWN: 'notification:countdown',
  PAUSE_TICK: 'pause:tick',
  PAUSE_ENDED: 'pause:ended',
  HUD_NUDGE: 'hud:nudge',
  PERMISSION_LOST: 'permission:lost',
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
