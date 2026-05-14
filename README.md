# MirrorAgent

An open-source, self-hostable macOS distraction blocker powered by Claude AI vision. MirrorAgent watches your screen, understands what you're actually doing, and blocks distractions before they pull you off track — without sending your data anywhere.

> Built by [Reflex Lab](https://github.com/reflexlab)

---

## How it works

Every 30 seconds, MirrorAgent takes a screenshot and sends it to Claude along with the last 10 windows you visited. Claude classifies your activity as work, unsure, or distraction — and acts on it.

- **Work** → nothing happens, keep going
- **Unsure** → passive notification asking you to confirm
- **Distraction** → warning countdown, then hard block (app hidden, browser tab closed)

You stay in control: toggle Focus/Free mode from the menu bar, pause for 15/30/60 minutes, or tell MirrorAgent "this is work" to teach it your context.

---

## Features

- **Claude vision classification** — understands context, not just app names
- **Hard blocking** — hides apps via macOS Accessibility API (no force quit, no data loss), closes browser tabs via a companion extension
- **Learns your patterns** — correction profile improves accuracy over time
- **Menu bar only** — no Dock icon, stays out of your way
- **Always-on HUD** — draggable 60×30px dot showing live focus score
- **Daily focus score** — 0–100 score across focus ratio, block resistance, distraction depth, and consistency
- **Local dashboard** — full stats at `localhost:1422`, no cloud required
- **Privacy first** — screenshots never written to disk, all data stays on your machine

---

## Requirements

- macOS 12+
- Node.js 20+
- An [Anthropic API key](https://console.anthropic.com)
- Accessibility permission + Screen Recording permission (prompted during setup)

---

## Getting started

```bash
git clone https://github.com/yourusername/mirroragent.git
cd mirroragent
npm install
npm run dev
```

On first launch, the onboarding wizard will:
1. Validate your Anthropic API key (live test ping)
2. Guide you through granting Accessibility + Screen Recording permissions
3. Ask about your work style to calibrate the classifier
4. Start the observation loop

---

## Architecture

```
src/
├── main/           # Electron main process
│   ├── index.ts    # App lifecycle, IPC handlers
│   ├── observer.ts # 5s window tracking loop (Accessibility API)
│   ├── config.ts   # Config persistence (~/.../MirrorAgent/config.json)
│   ├── database.ts # SQLite init (better-sqlite3 + drizzle-orm)
│   └── permissions.ts  # Accessibility + Screen Recording checks
├── renderer/       # React UIs
│   ├── onboarding/ # 6-screen setup wizard
│   ├── hud/        # Always-on-top focus score dot
│   ├── notification/ # Passive + warning notifications
│   ├── recovery/   # Shown when permissions are revoked
│   └── tray/       # Menu bar dropdown
└── shared/
    ├── types.ts        # Shared TypeScript types
    ├── schema.ts       # Drizzle ORM table definitions
    ├── ipc-channels.ts # IPC channel constants
    └── constants.ts    # Timings, thresholds, known apps
```

**Stack:** Electron 33 · Vite · React 18 · TypeScript · Tailwind CSS · SQLite (better-sqlite3) · Drizzle ORM · Anthropic SDK

---

## Data schema

| Table | Purpose |
|---|---|
| `window_tracking` | Every 5s observation — app, title, URL, classification result |
| `block_log` | Every block event with confidence, reason, user response |
| `correction_profile` | "This is work" corrections for classifier tuning |
| `focus_score_daily` | Daily score with breakdown across 4 dimensions |
| `app_state` | Key-value store for runtime state |

All data is stored locally at `~/Library/Application Support/MirrorAgent/mirror.db`.

---

## Configuration

Config lives at `~/Library/Application Support/MirrorAgent/config.json`. Key fields:

| Field | Default | Description |
|---|---|---|
| `mode` | `free` | `focus` or `free` |
| `workApps` | `[]` | Apps always treated as work |
| `whitelist` | `[]` | Apps/URLs that skip classification |
| `permanentBlocklist` | `[]` | Apps/URLs always blocked immediately |
| `workStartTime` | `09:00` | Working hours start |
| `workEndTime` | `18:00` | Working hours end |

---

## Roadmap

- [x] Onboarding wizard
- [x] API key validation
- [x] Permission checks + recovery
- [x] Window observation loop (5s, Accessibility API)
- [x] Pre-classification gate (whitelist / blocklist)
- [ ] Screenshot capture + Claude vision classification
- [ ] System tray + HUD
- [ ] Hard block execution (app hide + tab close)
- [ ] Browser companion extension (Chrome)
- [ ] Daily focus score + local dashboard
- [ ] Sleep/wake handling + working hours nudges

---

## Privacy

- Screenshots are captured in memory and sent directly to Anthropic's API. They are **never written to disk**.
- No telemetry, no accounts, no cloud sync.
- All session data stays in your local SQLite database.
- You can delete everything at any time: remove `~/Library/Application Support/MirrorAgent/`.

---

## Contributing

Issues and PRs welcome. This is an early-stage project — if you build something useful on top of it, open a PR.

---

## License

MIT
