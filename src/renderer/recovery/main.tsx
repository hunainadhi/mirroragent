/// <reference path="../window.d.ts" />
import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import '../globals.css'

function RecoveryApp() {
  const [accessibility, setAccessibility] = useState(true)
  const [screenRecording, setScreenRecording] = useState(true)
  const [checking, setChecking] = useState(false)

  const refresh = async () => {
    try {
      const status = await window.mirrorAgent.checkPermissions()
      setAccessibility(status.accessibility)
      setScreenRecording(status.screenRecording)
      return status
    } catch {
      return null
    }
  }

  // Poll every 3s so we auto-dismiss once both are restored
  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 3000)
    return () => clearInterval(id)
  }, [])

  const handleCheck = async () => {
    setChecking(true)
    await refresh()
    setChecking(false)
  }

  const allGood = accessibility && screenRecording

  return (
    <div className="h-screen bg-zinc-950 text-white flex flex-col overflow-hidden select-none">
      <div className="h-8 flex-shrink-0" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />

      <div className="flex-1 flex items-center justify-center px-10">
        <div className="w-full max-w-sm space-y-7 text-center">
          {allGood ? (
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#c9f97f] mx-auto flex items-center justify-center">
                <svg width="20" height="16" viewBox="0 0 20 16" fill="none">
                  <path d="M2 8l5 5L18 2" stroke="#09090b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-lg">Permissions restored</p>
                <p className="text-zinc-500 text-sm mt-1">MirrorAgent is resuming observation.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/30 mx-auto flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 7v5M10 14h.01M9.07 3.29L2.39 14.5A1 1 0 003.32 16h13.36a1 1 0 00.93-1.5L10.93 3.29a1 1 0 00-1.86 0z" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-lg">Permissions required</p>
                  <p className="text-zinc-500 text-sm mt-1">MirrorAgent is paused until both permissions are granted.</p>
                </div>
              </div>

              <div className="space-y-2 text-left">
                <PermissionRow
                  title="Accessibility Access"
                  granted={accessibility}
                  onOpen={() => window.mirrorAgent.openAccessibilitySettings()}
                />
                <PermissionRow
                  title="Screen Recording"
                  granted={screenRecording}
                  onOpen={() => window.mirrorAgent.openScreenRecordingSettings()}
                />
              </div>

              <button
                onClick={handleCheck}
                disabled={checking}
                className="w-full py-2.5 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                {checking ? 'Checking...' : 'Check again'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function PermissionRow({ title, granted, onOpen }: {
  title: string
  granted: boolean
  onOpen: () => void
}) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
      granted ? 'border-[#c9f97f]/30 bg-[#c9f97f]/5' : 'border-zinc-800 bg-zinc-900'
    }`}>
      <div className="flex items-center gap-2.5">
        <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
          granted ? 'bg-[#c9f97f]' : 'bg-zinc-700'
        }`}>
          {granted && (
            <svg width="8" height="7" viewBox="0 0 8 7" fill="none">
              <path d="M1 3.5l2 2L7 1" stroke="#09090b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <span className="text-sm text-zinc-300">{title}</span>
      </div>
      {!granted && (
        <button
          onClick={onOpen}
          className="text-xs text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 rounded-lg px-2.5 py-1 transition-colors"
        >
          Fix →
        </button>
      )}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<RecoveryApp />)
