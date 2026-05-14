import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as path from 'path'
import * as fs from 'fs'
import { app } from 'electron'
import * as schema from '../shared/schema'

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>

let sqlite: InstanceType<typeof Database>
let db: DrizzleDb

export function initDatabase(): void {
  const dbDir = app.getPath('userData')
  fs.mkdirSync(dbDir, { recursive: true })
  const dbPath = path.join(dbDir, 'mirror.db')

  sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS window_tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME NOT NULL,
      app_name TEXT NOT NULL,
      window_title TEXT,
      url TEXT,
      classification_result TEXT,
      confidence INTEGER,
      is_distraction BOOLEAN,
      action_taken TEXT
    );

    CREATE TABLE IF NOT EXISTS block_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME NOT NULL,
      app_name TEXT,
      url TEXT,
      confidence INTEGER,
      reason TEXT,
      trigger_type TEXT NOT NULL,
      user_response TEXT,
      duration_on_app_before_block INTEGER,
      false_positive BOOLEAN DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS correction_profile (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME NOT NULL,
      app_name TEXT,
      url TEXT,
      task_label TEXT,
      correction_type TEXT NOT NULL,
      context_string TEXT
    );

    CREATE TABLE IF NOT EXISTS focus_score_daily (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date DATE NOT NULL UNIQUE,
      final_score INTEGER,
      focus_ratio_points INTEGER,
      block_resistance_points INTEGER,
      distraction_depth_points INTEGER,
      consistency_points INTEGER,
      total_focus_minutes INTEGER,
      total_blocks INTEGER,
      summary_line TEXT
    );

    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `)

  db = drizzle(sqlite, { schema })
}

export function getDb(): DrizzleDb {
  return db
}

export function closeDatabase(): void {
  sqlite?.close()
}
