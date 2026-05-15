import { useState, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import '../globals.css'
import type { Mode } from '../../shared/types'

function scoreColor(s: number): string {
  if (s >= 70) return '#34d399'  // emerald
  if (s >= 40) return '#fbbf24'  // amber
  return '#f87171'               // red
}

function HudApp() {
  const [mode, setMode] = useState<Mode>('focus')
  const [score, setScore] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [pauseRemaining, setPauseRemaining] = useState(0)
  const [nudge, setNudge] = useState('')
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    window.mirrorAgent.getMode().then(setMode).catch(() => {})
    window.mirrorAgent.getScore().then((s) => setScore(s.total)).catch(() => {})

    const u1 = window.mirrorAgent.onModeChanged(setMode)
    const u2 = window.mirrorAgent.onScoreUpdated((s) => setScore(s.total))
    const u3 = window.mirrorAgent.onPauseTick((ms) => setPauseRemaining(ms))
    const u4 = window.mirrorAgent.onPauseEnded(() => setPauseRemaining(0))
    const u5 = window.mirrorAgent.onHudNudge((msg) => {
      setNudge(msg)
      if (nudgeTimer.current) clearTimeout(nudgeTimer.current)
      nudgeTimer.current = setTimeout(() => setNudge(''), 4_000)
    })

    return () => { u1(); u2(); u3(); u4(); u5() }
  }, [])

  function handleMouseEnter() {
    setExpanded(true)
    window.mirrorAgent.resizeHud(true)
  }

  function handleMouseLeave() {
    setExpanded(false)
    window.mirrorAgent.resizeHud(false)
  }

  const dot = mode === 'focus' ? '#34d399' : '#71717a'
  const sc = scoreColor(score)

  const pauseMins = Math.ceil(pauseRemaining / 60_000)

  if (!expanded) {
    return (
      <div
        className="w-full h-full flex items-center justify-center gap-1.5 select-none rounded-full"
        style={{
          background: 'rgba(9,9,11,0.88)',
          backdropFilter: 'blur(8px)',
          WebkitAppRegion: 'drag',
        } as React.CSSProperties}
        onMouseEnter={handleMouseEnter}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: sc, lineHeight: 1 }}>
          {score}
        </span>
      </div>
    )
  }

  return (
    <div
      className="w-full h-full flex items-center px-3 gap-2.5 select-none rounded-2xl"
      style={{
        background: 'rgba(9,9,11,0.92)',
        backdropFilter: 'blur(10px)',
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}
      onMouseLeave={handleMouseLeave}
    >
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />

      <div className="flex flex-col min-w-0 flex-1">
        {nudge ? (
          <span style={{ fontSize: 11, color: '#a1a1aa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {nudge}
          </span>
        ) : pauseRemaining > 0 ? (
          <span style={{ fontSize: 11, color: '#fbbf24' }}>
            Break — {pauseMins}m left
          </span>
        ) : (
          <span style={{ fontSize: 11, color: '#71717a', textTransform: 'capitalize' }}>
            {mode}
          </span>
        )}
      </div>

      <span style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: 700, color: sc, flexShrink: 0 }}>
        {score}
      </span>
    </div>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<HudApp />)
