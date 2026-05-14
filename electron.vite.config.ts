import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts'),
        },
      },
    },
  },
  renderer: {
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          onboarding: resolve(__dirname, 'src/renderer/onboarding/index.html'),
          hud: resolve(__dirname, 'src/renderer/hud/index.html'),
          tray: resolve(__dirname, 'src/renderer/tray/index.html'),
          notification: resolve(__dirname, 'src/renderer/notification/index.html'),
          recovery: resolve(__dirname, 'src/renderer/recovery/index.html'),
        },
      },
    },
  },
})
