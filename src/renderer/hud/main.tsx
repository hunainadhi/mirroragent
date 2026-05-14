import React from 'react'
import { createRoot } from 'react-dom/client'
import '../globals.css'

// Stub — implemented Day 6
function HudApp() {
  return (
    <div className="w-full h-full bg-zinc-900/80 rounded-full flex items-center justify-center">
      <span className="text-xs text-zinc-400">HUD</span>
    </div>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<HudApp />)
