import type { Configuration } from 'electron-builder'

const config: Configuration = {
  appId: 'com.reflexlab.mirroragent',
  productName: 'MirrorAgent',
  copyright: 'Copyright © 2026 Hunain Adhikari',
  mac: {
    category: 'public.app-category.productivity',
    target: [{ target: 'dmg', arch: ['universal'] }],
    icon: 'resources/icon.icns',
  },
  dmg: {
    title: 'MirrorAgent',
  },
  files: ['out/**/*', 'package.json'],
  asarUnpack: [
    '**/node_modules/better-sqlite3/**',
    '**/node_modules/node-mac-permissions/**',
  ],
  directories: {
    output: 'release',
    buildResources: 'resources',
  },
}

export default config
