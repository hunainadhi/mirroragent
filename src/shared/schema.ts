import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'

export const windowTracking = sqliteTable('window_tracking', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  timestamp: text('timestamp').notNull(),
  appName: text('app_name').notNull(),
  windowTitle: text('window_title'),
  url: text('url'),
  classificationResult: text('classification_result'),
  confidence: integer('confidence'),
  isDistraction: integer('is_distraction', { mode: 'boolean' }),
  actionTaken: text('action_taken'),
})

export const blockLog = sqliteTable('block_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  timestamp: text('timestamp').notNull(),
  appName: text('app_name'),
  url: text('url'),
  confidence: integer('confidence'),
  reason: text('reason'),
  triggerType: text('trigger_type').notNull(),
  userResponse: text('user_response'),
  durationOnAppBeforeBlock: integer('duration_on_app_before_block'),
  falsePositive: integer('false_positive', { mode: 'boolean' }).default(false),
})

export const correctionProfile = sqliteTable('correction_profile', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  timestamp: text('timestamp').notNull(),
  appName: text('app_name'),
  url: text('url'),
  taskLabel: text('task_label'),
  correctionType: text('correction_type').notNull(),
  contextString: text('context_string'),
})

export const focusScoreDaily = sqliteTable('focus_score_daily', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull().unique(),
  finalScore: integer('final_score'),
  focusRatioPoints: integer('focus_ratio_points'),
  blockResistancePoints: integer('block_resistance_points'),
  distractionDepthPoints: integer('distraction_depth_points'),
  consistencyPoints: integer('consistency_points'),
  totalFocusMinutes: integer('total_focus_minutes'),
  totalBlocks: integer('total_blocks'),
  summaryLine: text('summary_line'),
})

export const appState = sqliteTable('app_state', {
  key: text('key').primaryKey(),
  value: text('value'),
})
