import React, { useState, useCallback, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import '../globals.css'

/// <reference path="../window.d.ts" />

type Step = 0 | 1 | 2 | 3 | 4 | 5

interface OnboardingData {
  apiKey: string
  profession: string[]
  workStyle: string[]
  workApps: string[]
  workUrls: string
  distractions: string[]
  workStartTime: string
  workEndTime: string
}

const DISTRACTION_DOMAINS: Record<string, string[]> = {
  'Social media': ['twitter.com', 'x.com', 'instagram.com', 'facebook.com', 'reddit.com', 'tiktok.com', 'snapchat.com', 'threads.net'],
  'Video': ['youtube.com', 'twitch.tv', 'netflix.com', 'hulu.com', 'disneyplus.com'],
  'News sites': ['cnn.com', 'bbc.com', 'nytimes.com', 'theguardian.com', 'huffpost.com', 'buzzfeed.com'],
  'Messaging apps': ['WhatsApp', 'Telegram', 'Discord'],
  'Shopping': ['amazon.com', 'ebay.com', 'etsy.com'],
  'Other': [],
}

// ── Shared components ──────────────────────────────────────────────────────

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
        selected
          ? 'border-[#c9f97f] bg-[#c9f97f]/10 text-[#c9f97f]'
          : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300'
      }`}
    >
      {label}
    </button>
  )
}

function PrimaryButton({ children, onClick, disabled }: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-3 bg-[#c9f97f] text-zinc-950 rounded-xl font-semibold text-base disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#d4fb8a] active:bg-[#bef06a] transition-colors"
    >
      {children}
    </button>
  )
}

function Layout({ children, step, centered = false }: {
  children: React.ReactNode
  step: Step
  centered?: boolean
}) {
  return (
    <div className="h-screen bg-zinc-950 text-white flex flex-col overflow-hidden select-none">
      <div className="h-8 flex-shrink-0" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />
      {step > 0 && (
        <div className="flex justify-center gap-1.5 pt-1 pb-4 flex-shrink-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === step - 1
                  ? 'w-4 h-1.5 bg-[#c9f97f]'
                  : i < step - 1
                  ? 'w-1.5 h-1.5 bg-zinc-600'
                  : 'w-1.5 h-1.5 bg-zinc-800'
              }`}
            />
          ))}
        </div>
      )}
      <div className={`flex-1 overflow-y-auto px-14 ${centered ? 'flex items-center' : 'py-6'}`}>
        <div className="w-full max-w-md mx-auto">
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Screen 0: Welcome ──────────────────────────────────────────────────────

function WelcomeScreen({ onNext }: { onNext: () => void }) {
  return (
    <Layout step={0} centered>
      <div className="text-center space-y-10">
        <div className="space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-[#c9f97f] mx-auto flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="6" fill="#09090b" />
              <circle cx="16" cy="16" r="13" stroke="#09090b" strokeWidth="2.5" />
            </svg>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight">MirrorAgent</h1>
        </div>
        <p className="text-zinc-400 text-base leading-relaxed">
          Blocks distractions autonomously using AI. You bring your own Anthropic API key.{' '}
          <span className="text-zinc-300">Everything stays on your machine.</span>
        </p>
        <PrimaryButton onClick={onNext}>Get started</PrimaryButton>
      </div>
    </Layout>
  )
}

// ── Screen 1: API Key ──────────────────────────────────────────────────────

function ApiKeyScreen({ data, onUpdate, onNext }: {
  data: OnboardingData
  onUpdate: (d: Partial<OnboardingData>) => void
  onNext: () => void
}) {
  const [inputKey, setInputKey] = useState(data.apiKey)
  const [show, setShow] = useState(false)
  const [status, setStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle')

  const validate = useCallback(async () => {
    const trimmed = inputKey.trim()
    if (!trimmed) return
    setStatus('validating')
    try {
      const ok = await window.mirrorAgent.validateApiKey(trimmed)
      if (ok) {
        setStatus('valid')
        onUpdate({ apiKey: trimmed })
      } else {
        setStatus('invalid')
      }
    } catch {
      setStatus('invalid')
    }
  }, [inputKey, onUpdate])

  return (
    <Layout step={1} centered>
      <div className="space-y-7">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Anthropic API key</h2>
          <p className="text-zinc-500 text-sm">Used to power AI classification. Stored locally on your machine, never sent anywhere else.</p>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={inputKey}
              onChange={(e) => { setInputKey(e.target.value); setStatus('idle') }}
              onKeyDown={(e) => e.key === 'Enter' && validate()}
              placeholder="sk-ant-api03-..."
              autoFocus
              className={`w-full bg-zinc-900 border rounded-xl px-4 py-3 pr-14 text-sm font-mono outline-none transition-colors ${
                status === 'invalid'
                  ? 'border-red-500/60 text-red-400'
                  : status === 'valid'
                  ? 'border-[#c9f97f]/60 text-[#c9f97f]'
                  : 'border-zinc-800 text-zinc-200 focus:border-zinc-600'
              }`}
            />
            <button
              onClick={() => setShow(!show)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 text-xs font-medium transition-colors"
            >
              {show ? 'hide' : 'show'}
            </button>
          </div>

          {status === 'invalid' && (
            <p className="text-red-400 text-xs">Key not valid. Check and try again.</p>
          )}
          {status === 'valid' && (
            <p className="text-[#c9f97f] text-xs">Key verified.</p>
          )}

          <p className="text-xs text-zinc-600">
            Get your API key at{' '}
            <span className="text-zinc-500">console.anthropic.com</span>
          </p>
        </div>

        <PrimaryButton
          onClick={status === 'valid' ? onNext : validate}
          disabled={!inputKey.trim() || status === 'validating'}
        >
          {status === 'validating' ? 'Checking...' : status === 'valid' ? 'Continue' : 'Verify key'}
        </PrimaryButton>
      </div>
    </Layout>
  )
}

// ── Screen 2: Permissions ──────────────────────────────────────────────────

function PermissionsScreen({ onNext }: { onNext: () => void }) {
  const [accessibility, setAccessibility] = useState(false)
  const [screenRecording, setScreenRecording] = useState(false)

  // Poll for real permission status every 2s while this screen is mounted
  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      try {
        const status = await window.mirrorAgent.checkPermissions()
        if (!cancelled) {
          setAccessibility(status.accessibility)
          setScreenRecording(status.screenRecording)
        }
      } catch {
        // preload not ready yet in very early render — no-op
      }
    }

    poll()
    const id = setInterval(poll, 2000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  return (
    <Layout step={2} centered>
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Permissions</h2>
          <p className="text-zinc-500 text-sm">Two are required. Used for nothing except what's described.</p>
        </div>

        <div className="space-y-3">
          <PermissionCard
            title="Accessibility Access"
            description="To detect active apps and hide distracting ones. We never read your keystrokes or file contents."
            granted={accessibility}
            onGrant={() => window.mirrorAgent.openAccessibilitySettings()}
          />
          <PermissionCard
            title="Screen Recording"
            description="To take periodic screenshots for AI classification. Screenshots are processed by Claude and immediately discarded. Never stored."
            granted={screenRecording}
            onGrant={() => window.mirrorAgent.openScreenRecordingSettings()}
          />
        </div>

        {accessibility && screenRecording ? (
          <PrimaryButton onClick={onNext}>Continue</PrimaryButton>
        ) : (
          <p className="text-center text-xs text-zinc-600">
            Grant both permissions above to continue
          </p>
        )}
      </div>
    </Layout>
  )
}

function PermissionCard({ title, description, granted, onGrant }: {
  title: string
  description: string
  granted: boolean
  onGrant: () => void
}) {
  return (
    <div className={`p-4 rounded-xl border transition-all ${
      granted ? 'border-[#c9f97f]/30 bg-[#c9f97f]/5' : 'border-zinc-800 bg-zinc-900'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`w-5 h-5 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
          granted ? 'bg-[#c9f97f]' : 'bg-zinc-800 border border-zinc-700'
        }`}>
          {granted && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4l2.5 2.5L9 1" stroke="#09090b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-200">{title}</span>
            {granted && <span className="text-xs text-[#c9f97f]">Granted</span>}
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed">{description}</p>
          {!granted && (
            <button
              onClick={onGrant}
              className="text-xs text-zinc-300 border border-zinc-700 hover:border-zinc-500 hover:text-white rounded-lg px-3 py-1.5 transition-colors"
            >
              Grant {title} →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Screen 3: About You ────────────────────────────────────────────────────

const PROFESSION_OPTIONS = [
  'Software Development', 'Design', 'Writing or Content',
  'Research or Studying', 'Marketing or Sales', 'Other',
]

const WORK_STYLE_OPTIONS = [
  'I work mostly in one or two apps',
  'I switch between many tools throughout the day',
  'I spend most of my time in the browser',
]

const BROWSER_WORK_TOOLS = [
  'Notion', 'Figma', 'Linear', 'GitHub', 'Vercel',
  'Airtable', 'Jira', 'Loom', 'Miro', 'Slack', 'Gmail',
]

const DISTRACTION_OPTIONS = [
  'Social media', 'Video', 'News sites', 'Messaging apps', 'Shopping', 'Other',
]

function AboutYouScreen({ data, onUpdate, onNext }: {
  data: OnboardingData
  onUpdate: (d: Partial<OnboardingData>) => void
  onNext: () => void
}) {
  const [installedApps, setInstalledApps] = useState<string[]>([])

  useEffect(() => {
    window.mirrorAgent.scanApps().then(setInstalledApps).catch(() => {})
  }, [])

  const toggle = (key: keyof OnboardingData, value: string, max?: number) => {
    const current = data[key] as string[]
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : max && current.length >= max ? current : [...current, value]
    onUpdate({ [key]: next })
  }

  return (
    <Layout step={3}>
      <div className="space-y-8 pb-2">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">About you</h2>
          <p className="text-zinc-500 text-sm">Helps Claude understand what work looks like for you from day one.</p>
        </div>

        <Section label="What do you do?" hint="Pick up to two">
          <div className="flex flex-wrap gap-2">
            {PROFESSION_OPTIONS.map((o) => (
              <Chip key={o} label={o} selected={data.profession.includes(o)} onClick={() => toggle('profession', o, 2)} />
            ))}
          </div>
        </Section>

        <Section label="How do you work?">
          <div className="flex flex-col gap-2">
            {WORK_STYLE_OPTIONS.map((o) => (
              <Chip key={o} label={o} selected={data.workStyle.includes(o)} onClick={() => toggle('workStyle', o)} />
            ))}
          </div>
        </Section>

        <Section label="Core work apps" hint="Select everything you use for work">
          {installedApps.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {installedApps.map((app) => (
                <Chip key={app} label={app} selected={data.workApps.includes(app)} onClick={() => toggle('workApps', app)} />
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2 mb-3">
            {BROWSER_WORK_TOOLS.map((tool) => (
              <Chip key={tool} label={tool} selected={data.workApps.includes(tool)} onClick={() => toggle('workApps', tool)} />
            ))}
          </div>
          <input
            type="text"
            value={data.workUrls}
            onChange={(e) => onUpdate({ workUrls: e.target.value })}
            placeholder="Other work URLs, e.g. notion.so, figma.com"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-zinc-600 text-zinc-200 placeholder:text-zinc-600 transition-colors"
          />
        </Section>

        <Section label="What pulls you off track?" hint="Always blocked in Focus mode, no AI needed">
          <div className="flex flex-wrap gap-2">
            {DISTRACTION_OPTIONS.map((o) => (
              <Chip key={o} label={o} selected={data.distractions.includes(o)} onClick={() => toggle('distractions', o)} />
            ))}
          </div>
        </Section>

        <Section label="When do you usually work?">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-600">From</label>
              <input
                type="time"
                value={data.workStartTime}
                onChange={(e) => onUpdate({ workStartTime: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-zinc-600 text-zinc-200 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-600">To</label>
              <input
                type="time"
                value={data.workEndTime}
                onChange={(e) => onUpdate({ workEndTime: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-zinc-600 text-zinc-200 transition-colors"
              />
            </div>
          </div>
        </Section>

        <PrimaryButton onClick={onNext} disabled={data.profession.length === 0}>
          Continue
        </PrimaryButton>
      </div>
    </Layout>
  )
}

function Section({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-zinc-200">{label}</p>
        {hint && <p className="text-xs text-zinc-600 mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

// ── Screen 4: Browser Extension ────────────────────────────────────────────

function ExtensionScreen({ onNext }: { onNext: () => void }) {
  const [opened, setOpened] = React.useState(false)

  function openFolder() {
    window.mirrorAgent.openExtensionFolder()
    setOpened(true)
  }

  return (
    <Layout step={4} centered>
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Browser extension</h2>
          <p className="text-zinc-400 text-sm">Enables tab-level blocking in Chrome and Brave. Without it, the whole browser is hidden instead of just the tab.</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Install in Chrome or Brave</p>
          <ol className="space-y-3 text-sm text-zinc-300">
            <li className="flex gap-3">
              <span className="text-zinc-500 font-mono text-xs mt-0.5 shrink-0">1.</span>
              <span>Open <span className="font-medium text-white">chrome://extensions</span> or <span className="font-medium text-white">brave://extensions</span></span>
            </li>
            <li className="flex gap-3">
              <span className="text-zinc-500 font-mono text-xs mt-0.5 shrink-0">2.</span>
              <span>Enable <span className="font-medium text-white">Developer mode</span> (top-right toggle)</span>
            </li>
            <li className="flex gap-3">
              <span className="text-zinc-500 font-mono text-xs mt-0.5 shrink-0">3.</span>
              <span>Click <span className="font-medium text-white">Open folder in Finder</span> below — then drag that folder into the browser window</span>
            </li>
          </ol>

          <button
            onClick={openFolder}
            className="w-full mt-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {opened ? '✓ Folder opened in Finder' : 'Open extension folder in Finder'}
          </button>

          <p className="text-xs text-zinc-600 text-center">
            In the Finder window, drag the folder into your browser's extensions page — or press <span className="font-mono text-zinc-500">⌘⇧G</span> in the browser's file picker to paste a path.
          </p>
        </div>

        <div className="space-y-3 text-center">
          <button
            onClick={onNext}
            className="w-full py-3 bg-white text-black rounded-xl font-semibold text-sm hover:bg-zinc-100 transition-colors"
          >
            Done →
          </button>
          <button
            onClick={onNext}
            className="text-sm text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    </Layout>
  )
}

// ── Screen 5: Ready ────────────────────────────────────────────────────────

function ReadyScreen({ data, onComplete }: { data: OnboardingData; onComplete: () => void }) {
  const [completing, setCompleting] = useState(false)

  const handleComplete = async () => {
    setCompleting(true)
    const permanentBlocklist = data.distractions.flatMap((cat) => DISTRACTION_DOMAINS[cat] ?? [])
    const workUrls = data.workUrls.split(/[,\n]/).map((u) => u.trim()).filter(Boolean)
    await window.mirrorAgent.completeOnboarding({
      apiKey: data.apiKey,
      profession: data.profession,
      workStyle: data.workStyle,
      workApps: data.workApps,
      workUrls,
      permanentBlocklist,
      workStartTime: data.workStartTime,
      workEndTime: data.workEndTime,
    })
    onComplete()
  }

  return (
    <Layout step={5} centered>
      <div className="text-center space-y-10">
        <div className="space-y-5">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-2xl bg-[#c9f97f]/10 border border-[#c9f97f]/20" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-7 h-7 rounded-full bg-[#c9f97f]" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">You're all set</h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Flip to Focus mode whenever you're ready to work.
            </p>
          </div>
        </div>
        <PrimaryButton onClick={handleComplete} disabled={completing}>
          {completing ? 'Starting...' : 'Open MirrorAgent'}
        </PrimaryButton>
      </div>
    </Layout>
  )
}

// ── Root ───────────────────────────────────────────────────────────────────

function OnboardingApp() {
  const [step, setStep] = useState<Step>(0)
  const [data, setData] = useState<OnboardingData>({
    apiKey: '',
    profession: [],
    workStyle: [],
    workApps: [],
    workUrls: '',
    distractions: [],
    workStartTime: '09:00',
    workEndTime: '18:00',
  })

  const update = useCallback((partial: Partial<OnboardingData>) => {
    setData((d) => ({ ...d, ...partial }))
  }, [])

  const next = useCallback(() => setStep((s) => Math.min(s + 1, 5) as Step), [])

  const screens: Record<Step, React.ReactNode> = {
    0: <WelcomeScreen onNext={next} />,
    1: <ApiKeyScreen data={data} onUpdate={update} onNext={next} />,
    2: <PermissionsScreen onNext={next} />,
    3: <AboutYouScreen data={data} onUpdate={update} onNext={next} />,
    4: <ExtensionScreen onNext={next} />,
    5: <ReadyScreen data={data} onComplete={() => {}} />,
  }

  return <>{screens[step]}</>
}

createRoot(document.getElementById('root')!).render(<OnboardingApp />)
