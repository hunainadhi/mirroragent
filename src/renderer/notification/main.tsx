import { useState, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import '../globals.css'
import type { NotificationType, NotificationAction } from '../../shared/types'

interface NotifData {
  type: NotificationType
  appName: string
  url: string | null
  reason: string
  countdownSecs: number
}

function respond(action: NotificationAction) {
  window.mirrorAgent.respondToNotification(action)
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '…' : s
}

function PassiveCard({ data }: { data: NotifData }) {
  const isUnsure = data.type === 'passive-unsure'
  const label = data.url
    ? truncate(data.url.replace(/^https?:\/\//, ''), 36)
    : truncate(data.appName, 36)

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: isUnsure ? '#fbbf24' : '#f87171', flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: '#e4e4e7', letterSpacing: 0.2 }}>
          {isUnsure ? 'Is this work?' : 'Distraction detected'}
        </span>
      </div>

      <p style={{ fontSize: 11, color: '#71717a', margin: '0 0 10px', lineHeight: 1.4 }}>
        <span style={{ color: '#a1a1aa' }}>{label}</span>
        {data.reason ? ` — ${truncate(data.reason, 60)}` : ''}
      </p>

      <div style={{ display: 'flex', gap: 6 }}>
        <button style={btnPrimary} onClick={() => respond('yes-work')}>
          Yes, it's work
        </button>
        <button style={btnGhost} onClick={() => respond('no-distraction')}>
          I'm stopping
        </button>
      </div>
    </div>
  )
}

function CountdownCard({ data }: { data: NotifData }) {
  const [secs, setSecs] = useState(data.countdownSecs)
  const label = data.url
    ? truncate(data.url.replace(/^https?:\/\//, ''), 36)
    : truncate(data.appName, 36)

  useEffect(() => {
    setSecs(data.countdownSecs)
    const id = setInterval(() => {
      setSecs((s) => {
        if (s <= 1) {
          clearInterval(id)
          respond('ignored')
          return 0
        }
        return s - 1
      })
    }, 1_000)
    return () => clearInterval(id)
  }, [data])

  const pct = (secs / data.countdownSecs) * 100

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#e4e4e7' }}>Blocking in {secs}s</span>
        </div>
        <span style={{ fontSize: 11, color: '#52525b' }}>{label}</span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 2, background: '#27272a', borderRadius: 1, marginBottom: 10, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: '#f87171', borderRadius: 1, transition: 'width 1s linear' }} />
      </div>

      {data.reason && (
        <p style={{ fontSize: 11, color: '#71717a', margin: '0 0 10px', lineHeight: 1.4 }}>
          {truncate(data.reason, 72)}
        </p>
      )}

      <div style={{ display: 'flex', gap: 6 }}>
        <button style={btnPrimary} onClick={() => respond('this-is-work')}>
          This is work
        </button>
        <button style={btnGhost} onClick={() => respond('no-distraction')}>
          I'm stopping
        </button>
        <button style={btnDanger} onClick={() => respond('block-it')}>
          Block now
        </button>
      </div>
    </div>
  )
}

function NotificationApp() {
  const [data, setData] = useState<NotifData | null>(null)

  useEffect(() => {
    const unsub = window.mirrorAgent.onNotificationFire((raw) => {
      setData(raw as NotifData)
    })
    return unsub
  }, [])

  if (!data) return null

  return data.type === 'warning-countdown'
    ? <CountdownCard key={data.type + data.appName} data={data} />
    : <PassiveCard key={data.type + data.appName} data={data} />
}

// ── Styles ─────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  margin: 0,
  padding: '14px 16px',
  background: 'rgba(18,18,20,0.97)',
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.07)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
}

const btnBase: React.CSSProperties = {
  border: 'none',
  borderRadius: 7,
  fontSize: 11,
  fontWeight: 600,
  padding: '5px 10px',
  cursor: 'pointer',
  WebkitAppRegion: 'no-drag',
  transition: 'opacity 0.15s',
} as React.CSSProperties

const btnPrimary: React.CSSProperties = { ...btnBase, background: '#3f3f46', color: '#e4e4e7' }
const btnGhost: React.CSSProperties = { ...btnBase, background: 'transparent', color: '#71717a', border: '1px solid #3f3f46' }
const btnDanger: React.CSSProperties = { ...btnBase, background: '#450a0a', color: '#fca5a5' }

const root = createRoot(document.getElementById('root')!)
root.render(<NotificationApp />)
