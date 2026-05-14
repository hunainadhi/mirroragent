import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import type { AppConfig } from '../shared/types'
import { DEFAULT_CONFIG, CONFIG_FILENAME } from '../shared/constants'

let configPath: string
let _config: AppConfig = { ...DEFAULT_CONFIG }

function getConfigPath(): string {
  if (!configPath) {
    configPath = path.join(app.getPath('userData'), CONFIG_FILENAME)
  }
  return configPath
}

export function loadConfig(): AppConfig {
  const p = getConfigPath()
  try {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf-8')
      _config = { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
    } else {
      _config = { ...DEFAULT_CONFIG }
      persistConfig()
    }
  } catch {
    _config = { ...DEFAULT_CONFIG }
  }
  return _config
}

export function getConfig(): AppConfig {
  return _config
}

export function saveConfig(partial: Partial<AppConfig>): void {
  _config = { ..._config, ...partial }
  persistConfig()
}

export function reloadConfig(): AppConfig {
  return loadConfig()
}

function persistConfig(): void {
  const p = getConfigPath()
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(_config, null, 2), 'utf-8')
}
