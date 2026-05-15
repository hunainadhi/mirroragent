# MirrorAgent

An open-source, self-hostable macOS distraction blocker powered by Claude AI vision. MirrorAgent watches your screen, understands what you're actually doing, and blocks distractions before they pull you off track — without sending your data anywhere.

> Built by [Hunain Adhikari](https://github.com/hunainadhi) · [Reflex Lab](https://github.com/reflexlab)

---

## How it works

Every 60 seconds (or immediately when you switch apps), MirrorAgent takes a screenshot and sends it to Claude along with your last 10 window entries and past corrections. Claude classifies your activity and acts on it.

- **Work** → nothing happens, keep going
- **Unsure** → passive notification: "Is this work?"
- **Distraction** → 30s warning countdown, then hard block

You stay in control: toggle Focus/Free mode from the menu bar, pause for 15/30/60 minutes, or click "This is work" to teach MirrorAgent your context. Every correction is remembered and fed back into future Claude calls.

---

## Features

### Core
- **Claude vision classification** — `claude-haiku-4-5` with screenshot + rolling window context, not just app names
- **Correction memory** — past "this is work" / "block it" responses are injected into the Claude prompt so accuracy improves over time
- **Pre-classification gate** — permanent blocklist and whitelist are checked instantly, no Claude call needed
- **Hard blocking** — hides apps via macOS Accessibility API (no force quit, no data loss), closes specific browser tabs via the companion extension
- **Confidence threshold ramp** — starts at 85% (days 1-3), gradually lowers to 70% by day 7 as the system calibrates to your patterns

### Menu bar & HUD
- **Menu bar only** — no Dock icon, lives in your menu bar
- **Dynamic tray icon** — filled circle ● in Focus mode, hollow ring ○ in Free mode
- **Always-on HUD** — draggable pill in bottom-right corner showing live focus score
- **HUD nudges** — pill auto-expands to show ambient messages ("Two hours clean. You are locked in."), then collapses
- **Multi-monitor aware** — screenshot captures the active display, HUD and notifications follow the cursor

### Work hours & automation
- **Auto focus mode** — switches to Focus automatically when work hours start, Free when they end
- **Sleep/wake handling** — observer and classifier stop on sleep/lock, resume on wake
- **Pause system** — 15/30/60 min options, one 15-min extension allowed, 10-min cooldown after resume
- **Ambient nudges** — timed messages at 30 min, 2 hours, hourly score checks, and 30 min before end of day

### Dashboard & score
- **Daily focus score** — 0–100 across four dimensions: focus ratio (40pts), block resistance (30pts), distraction depth (20pts), consistency (10pts)
- **Local dashboard** — `localhost:1422` with Today, Patterns (7-day chart), and Settings tabs
- **Settings editor** — edit work hours, blocklist, work apps, task label directly from the dashboard

### Browser extension
- **Chrome/Brave companion** — WebSocket on `localhost:1423`, closes specific tabs instead of hiding the whole browser
- **Persistent connection** — uses `chrome.alarms` to keep the service worker alive, reconnects every 3s if dropped

### Manual test suite
- **Tests tab** in the dashboard — 30 tests across 10 groups, auto-checks on load, trigger buttons for every interactive scenario

---

## Install

### From DMG (recommended)

1. Download `MirrorAgent-0.1.0-arm64.dmg` from [Releases](https://github.com/hunainadhi/mirroragent/releases)
2. Drag `MirrorAgent.app` to `/Applications`
3. Remove the quarantine flag (required for unsigned apps):
   ```bash
   xattr -cr /Applications/MirrorAgent.app
   ```
4. Open from Applications — onboarding wizard starts automatically

> **Important:** Grant permissions while running from `/Applications`, not from the DMG. macOS tracks permissions by app path.

### From source

```bash
git clone https://github.com/hunainadhi/mirroragent.git
cd mirroragent
npm install
npm run dev
```

### Build your own DMG

```bash
npm run package
# Output: dist/MirrorAgent-0.1.0-arm64.dmg
```

---

## Requirements

- macOS 12+
- Apple Silicon (arm64) or Intel (x64)
- Node.js 20+ (for building from source)
- An [Anthropic API key](https://console.anthropic.com)
- Accessibility permission + Screen Recording permission (guided during setup)

---

## Onboarding

The 6-screen wizard handles everything on first launch:

1. **Welcome** — overview
2. **API Key** — live test ping to validate your key
3. **Permissions** — Accessibility + Screen Recording with real-time polling; shows a warning if you're running from a DMG instead of Applications
4. **About You** — profession, work style, work apps, distraction categories; pre-populated from apps installed in `/Applications`
5. **Browser Extension** — step-by-step install guide, opens the extension folder in Finder
6. **Ready** — starts the observation loop

---

## Browser extension

The extension is bundled inside `MirrorAgent.app/Contents/Resources/extension/`.

**Install:**
1. Open `brave://extensions` or `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `extension/` folder (use the button in onboarding to open it in Finder)

The popup shows a green dot when connected to MirrorAgent.

---

## Architecture

```
src/
├── main/
│   ├── index.ts        # App lifecycle, IPC handlers
│   ├── observer.ts     # 5s window tracking (osascript → app/title/URL)
│   ├── classifier.ts   # 60s screenshot loop, Claude vision, rate limiter, correction memory
│   ├── blocker.ts      # hideApp() via Accessibility API, writeBlockLog(), writeCorrection()
│   ├── notifications.ts # idle → passive → countdown → block state machine
│   ├── tray.ts         # Native menu bar tray, dynamic icon
│   ├── hud.ts          # Always-on-top HUD window
│   ├── pause.ts        # Pause timer with tick broadcasts
│   ├── score.ts        # 4-component focus score, 5-min recalculation
│   ├── dashboard.ts    # Express server on localhost:1422 + test API
│   ├── lifecycle.ts    # Sleep/wake, work hours auto-switch, nudge scheduler, calibration
│   ├── websocket.ts    # WebSocket server on localhost:1423 for browser extension
│   ├── config.ts       # Config persistence
│   ├── database.ts     # SQLite init (better-sqlite3 + drizzle-orm)
│   └── permissions.ts  # Accessibility + Screen Recording checks
├── renderer/
│   ├── onboarding/     # 6-screen setup wizard
│   ├── hud/            # Focus score pill with nudge animations
│   ├── notification/   # Passive + countdown notification cards
│   └── recovery/       # Shown when permissions are revoked post-setup
├── shared/
│   ├── types.ts        # Shared TypeScript types
│   ├── schema.ts       # Drizzle ORM table definitions
│   ├── ipc-channels.ts # IPC channel constants
│   └── constants.ts    # Timings, thresholds, nudge messages, known apps
extension/
│   ├── manifest.json   # Chrome MV3
│   ├── background.js   # WebSocket client, tab closer, alarms keep-alive
│   └── popup.html/js   # Connection status popup
```

**Stack:** Electron 33 · Vite · React 18 · TypeScript · Tailwind CSS · SQLite · Drizzle ORM · Anthropic SDK · Express · ws

---

## Data schema

| Table | Purpose |
|---|---|
| `window_tracking` | Every 5s observation — app, title, URL, gate result, Claude classification |
| `block_log` | Every block event — confidence, reason, trigger type, user response |
| `correction_profile` | User corrections fed back into future Claude prompts |
| `focus_score_daily` | Daily score with full component breakdown |
| `app_state` | Key-value store for runtime state |

All data stored locally at `~/Library/Application Support/MirrorAgent/`.

---

## Configuration

`~/Library/Application Support/MirrorAgent/config.json`

| Field | Default | Description |
|---|---|---|
| `mode` | `free` | `focus` or `free` — auto-managed by work hours |
| `workApps` | `[]` | Apps classified as work instantly (no Claude call) |
| `whitelist` | `[]` | Apps/URLs that always pass the gate |
| `permanentBlocklist` | `[]` | Apps/URLs blocked immediately on detection |
| `workStartTime` | `09:00` | Work hours start — auto-switches to focus |
| `workEndTime` | `18:00` | Work hours end — auto-switches to free |
| `calibrationDays` | `0` | Days of use — controls confidence threshold ramp |
| `taskLabel` | `""` | Current task — injected into Claude's context |

Editable live from the dashboard Settings tab.

---

## Testing

Open `http://localhost:1422` → **Tests** tab while MirrorAgent is running.

Auto-checks cover: onboarding status, API key, mode, work hours, calibration, DB write frequency, blocklist gate, URL capture, Claude call count, rate limiter state, score persistence, extension connection.

Trigger buttons let you fire every notification type, all 7 HUD nudges, pause start/end, score recalculation, WebSocket close-tab, and simulate sleep/wake.

---

## Privacy

- Screenshots are captured in memory and sent to Anthropic's API. **Never written to disk.**
- No telemetry, no accounts, no cloud sync.
- All session data stays in your local SQLite database.
- Delete everything: `rm -rf ~/Library/Application\ Support/MirrorAgent`

---

## Contributing

Issues and PRs welcome. If you build something useful on top of it, open a PR.

---

## License

MIT
