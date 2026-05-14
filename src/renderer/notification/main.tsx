import React from 'react'
import { createRoot } from 'react-dom/client'
import '../globals.css'

// Stub — implemented Day 5
function NotificationApp() {
  return (
    <div className="w-full bg-zinc-800 text-white p-3 rounded-xl">
      <p className="text-sm text-zinc-400">Notification — Day 5</p>
    </div>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<NotificationApp />)
