import type { Configuration } from 'electron-builder'

const config: Configuration = {
  appId: 'com.reflexlab.mirroragent',
  productName: 'MirrorAgent',
  copyright: 'Copyright © 2026 Hunain Adhikari',

  files: [
    'out/**/*',
    'package.json',
  ],

  extraResources: [
    { from: 'out/extension', to: 'extension' },
  ],

  asarUnpack: [
    '**/node_modules/better-sqlite3/**',
    '**/node_modules/node-mac-permissions/**',
    '**/node_modules/ws/**',
  ],

  mac: {
    category: 'public.app-category.productivity',
    icon: 'resources/icon.icns',
    target: [{ target: 'dmg', arch: ['arm64', 'x64'] }],
    hardenedRuntime: true,
    entitlements: 'resources/entitlements.mac.plist',
    entitlementsInherit: 'resources/entitlements.mac.plist',
    extendInfo: {
      // Prevents the app from appearing in the Dock
      LSUIElement: true,
      NSAppleEventsUsageDescription: 'MirrorAgent uses Apple Events to read the active window title and browser URL for focus tracking.',
      NSScreenCaptureUsageDescription: 'MirrorAgent captures your screen to classify your current activity using AI.',
      NSAccessibilityUsageDescription: 'MirrorAgent uses Accessibility to read the active window and hide distracting apps.',
    },
  },

  dmg: {
    title: 'MirrorAgent',
    icon: 'resources/icon.icns',
    contents: [
      { x: 130, y: 220, type: 'file' },
      { x: 410, y: 220, type: 'link', path: '/Applications' },
    ],
    window: { width: 540, height: 380 },
  },

  directories: {
    output: 'dist',
    buildResources: 'resources',
  },
}

export default config
