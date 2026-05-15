import { useState, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import '../globals.css'
import type { Mode } from '../../shared/types'

function scoreColor(s: number): string {
  if (s >= 70) return '#34d399'
  if (s >= 40) return '#fbbf24'
  return '#f87171'
}

function HudApp() {
  const [mode, setMode] = useState<Mode>('focus')
  const [score, setScore] = useState(0)
  const [hovering, setHovering] = useState(false)
  const [nudge, setNudge] = useState('')
  const [pauseRemaining, setPauseRemaining] = useState(0)
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Derived: expanded whenever hovering OR a nudge is showing
  const expanded = hovering || nudge !== ''

  // Resize the Electron window whenever expanded state changes
  useEffect(() => {
    window.mirrorAgent.resizeHud(expanded)
  }, [expanded])

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
      // Auto-collapse after 4s
      nudgeTimer.current = setTimeout(() => setNudge(''), 4_000)
    })

    return () => { u1(); u2(); u3(); u4(); u5() }
  }, [])

  const dot = mode === 'focus' ? '#34d399' : '#71717a'
  const sc = scoreColor(score)
  const pauseMins = Math.ceil(pauseRemaining / 60_000)

  const base: React.CSSProperties = {
    width: '100%', height: '100%',
    background: '#0e0e10',
    display: 'flex', alignItems: 'center',
    userSelect: 'none',
    WebkitAppRegion: 'drag',
    overflow: 'hidden',
    transition: 'border-radius 0.2s ease',
  } as React.CSSProperties

  if (!expanded) {
    return (
      <div
        style={{ ...base, borderRadius: 9999, justifyContent: 'center', gap: 8 }}
        onMouseEnter={() => setHovering(true)}
      >
        <div
          className={mode === 'focus' ? 'dot-pulse' : ''}
          style={{ width: 12, height: 12, borderRadius: '50%', background: dot, flexShrink: 0, boxShadow: `0 0 8px ${dot}bb` }}
        />
        <span style={{ fontSize: 16, fontFamily: 'monospace', fontWeight: 800, color: sc, lineHeight: 1, letterSpacing: '-0.5px' }}>
          {score}
        </span>
      </div>
    )
  }

  return (
    <div
      style={{ ...base, borderRadius: 18, padding: '0 14px', gap: 10 }}
      onMouseLeave={() => setHovering(false)}
    >
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: dot, flexShrink: 0, boxShadow: `0 0 6px ${dot}99` }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {nudge ? (
          <span style={{ fontSize: 12, fontWeight: 600, color: '#e4e4e7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
            {nudge}
          </span>
        ) : pauseRemaining > 0 ? (
          <span style={{ fontSize: 11, color: '#fbbf24' }}>Break — {pauseMins}m left</span>
        ) : (
          <span style={{ fontSize: 11, color: '#71717a', textTransform: 'capitalize' }}>{mode}</span>
        )}
      </div>

      <span style={{ fontSize: 15, fontFamily: 'monospace', fontWeight: 800, color: sc, flexShrink: 0, letterSpacing: '-0.5px' }}>
        {score}
      </span>
    </div>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<HudApp />)
