import React from 'react'
import { createRoot } from 'react-dom/client'
import '../globals.css'

// Stub — implemented Day 6
function TrayApp() {
  return (
    <div className="w-full bg-zinc-900 text-white p-4">
      <p className="text-sm text-zinc-400">Tray — Day 6</p>
    </div>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<TrayApp />)
