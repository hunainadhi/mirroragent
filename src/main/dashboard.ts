import express from 'express'
import { and, gte, lt, desc } from 'drizzle-orm'
import { getDb } from './database'
import { windowTracking, blockLog, focusScoreDaily } from '../shared/schema'
import { getConfig, saveConfig } from './config'
import { calculateScore } from './score'
import { DASHBOARD_PORT } from '../shared/constants'
import type { Server } from 'http'

let server: Server | null = null

// ── API helpers ────────────────────────────────────────────────────────────

function dayRange(offsetDays = 0) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offsetDays)
  const end = new Date(start.getTime() + 86_400_000)
  return { start: start.toISOString(), end: end.toISOString() }
}

// ── Dashboard HTML ─────────────────────────────────────────────────────────

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>MirrorAgent</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#09090b;color:#e4e4e7;min-height:100vh;padding:32px 24px}
.header{display:flex;align-items:center;justify-content:space-between;margin-bottom:32px}
.logo{font-size:18px;font-weight:700;color:#fff}
.tabs{display:flex;gap:4px;background:#18181b;border-radius:10px;padding:4px}
.tab{padding:6px 16px;border-radius:7px;cursor:pointer;font-size:13px;font-weight:500;color:#71717a;border:none;background:transparent;transition:all .15s}
.tab.active{background:#27272a;color:#e4e4e7}
.page{display:none}.page.active{display:block}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px}
.card{background:#18181b;border-radius:14px;padding:20px;border:1px solid #27272a}
.card-label{font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
.card-value{font-size:32px;font-weight:800;font-variant-numeric:tabular-nums}
.card-sub{font-size:12px;color:#71717a;margin-top:4px}
.score-green{color:#34d399}.score-amber{color:#fbbf24}.score-red{color:#f87171}
.components{background:#18181b;border-radius:14px;padding:20px;border:1px solid #27272a;margin-bottom:24px}
.components h3{font-size:13px;color:#71717a;margin-bottom:16px;text-transform:uppercase;letter-spacing:.5px}
.component{margin-bottom:14px}
.component-row{display:flex;justify-content:space-between;margin-bottom:5px;font-size:12px}
.component-name{color:#a1a1aa}.component-pts{font-weight:700;color:#e4e4e7}
.bar-bg{height:6px;background:#27272a;border-radius:3px;overflow:hidden}
.bar-fill{height:100%;border-radius:3px;transition:width .6s ease}
.bar-green{background:#34d399}.bar-amber{background:#fbbf24}.bar-red{background:#f87171}.bar-blue{background:#60a5fa}
.blocks-table{width:100%;border-collapse:collapse;font-size:12px}
.blocks-table th{text-align:left;color:#71717a;font-weight:500;padding:0 8px 10px;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
.blocks-table td{padding:8px;border-top:1px solid #27272a;color:#a1a1aa;vertical-align:middle}
.blocks-table td:first-child{color:#e4e4e7}
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600}
.badge-distraction{background:#450a0a;color:#fca5a5}
.badge-work{background:#052e16;color:#86efac}
.chart-wrap{background:#18181b;border-radius:14px;padding:20px;border:1px solid #27272a;margin-bottom:24px}
.chart-wrap h3{font-size:13px;color:#71717a;margin-bottom:16px;text-transform:uppercase;letter-spacing:.5px}
.form-group{margin-bottom:16px}
.form-label{display:block;font-size:12px;color:#a1a1aa;margin-bottom:6px}
.form-input{width:100%;background:#27272a;border:1px solid #3f3f46;border-radius:8px;color:#e4e4e7;padding:8px 12px;font-size:13px;outline:none;transition:border .15s}
.form-input:focus{border-color:#71717a}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.btn{padding:8px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:none;transition:opacity .15s}
.btn:hover{opacity:.85}
.btn-primary{background:#3f3f46;color:#e4e4e7}
.btn-save{background:#34d399;color:#052e16}
.saved{font-size:12px;color:#34d399;margin-left:12px;opacity:0;transition:opacity .3s}
section-title{display:block;font-size:13px;font-weight:600;color:#e4e4e7;margin-bottom:12px}
</style>
</head>
<body>
<div class="header">
  <span class="logo">MirrorAgent</span>
  <div class="tabs">
    <button class="tab active" onclick="show('today',this)">Today</button>
    <button class="tab" onclick="show('patterns',this)">Patterns</button>
    <button class="tab" onclick="show('settings',this)">Settings</button>
  </div>
</div>

<!-- TODAY -->
<div id="page-today" class="page active">
  <div class="grid" id="stats-grid"></div>
  <div class="components">
    <h3>Score breakdown</h3>
    <div id="components"></div>
  </div>
  <div class="card">
    <div class="card-label">Recent blocks</div>
    <div style="margin-top:12px" id="blocks-wrap"></div>
  </div>
</div>

<!-- PATTERNS -->
<div id="page-patterns" class="page">
  <div class="chart-wrap">
    <h3>7-day focus score</h3>
    <canvas id="chart" height="80"></canvas>
  </div>
  <div class="grid" id="pattern-stats"></div>
</div>

<!-- SETTINGS -->
<div id="page-settings" class="page">
  <div class="card" style="max-width:560px">
    <div class="card-label" style="margin-bottom:16px">Configuration</div>
    <div class="form-group">
      <label class="form-label">Task label</label>
      <input class="form-input" id="taskLabel" placeholder="What are you working on?"/>
    </div>
    <div class="form-group form-row">
      <div>
        <label class="form-label">Work starts</label>
        <input class="form-input" type="time" id="workStart"/>
      </div>
      <div>
        <label class="form-label">Work ends</label>
        <input class="form-input" type="time" id="workEnd"/>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Permanent blocklist (one per line)</label>
      <textarea class="form-input" id="blocklist" rows="6" style="resize:vertical"></textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Work apps (one per line)</label>
      <textarea class="form-input" id="workApps" rows="4" style="resize:vertical"></textarea>
    </div>
    <button class="btn btn-save" onclick="saveSettings()">Save</button>
    <span class="saved" id="saved-msg">Saved</span>
  </div>
</div>

<script>
function show(page, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'))
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
  document.getElementById('page-' + page).classList.add('active')
  btn.classList.add('active')
  if (page === 'patterns') loadPatterns()
  if (page === 'settings') loadSettings()
}

function colorClass(score) {
  return score >= 70 ? 'score-green' : score >= 40 ? 'score-amber' : 'score-red'
}
function barClass(pct) {
  return pct >= 70 ? 'bar-green' : pct >= 40 ? 'bar-amber' : 'bar-red'
}

async function loadToday() {
  const [today, score] = await Promise.all([
    fetch('/api/today').then(r => r.json()),
    fetch('/api/score').then(r => r.json()),
  ])

  document.getElementById('stats-grid').innerHTML = \`
    <div class="card">
      <div class="card-label">Focus score</div>
      <div class="card-value \${colorClass(score.total)}">\${score.total}</div>
      <div class="card-sub">\${score.summaryLine}</div>
    </div>
    <div class="card">
      <div class="card-label">Focus time</div>
      <div class="card-value">\${today.focusMinutes}m</div>
      <div class="card-sub">of \${today.totalMinutes}m tracked</div>
    </div>
    <div class="card">
      <div class="card-label">Blocks today</div>
      <div class="card-value">\${today.totalBlocks}</div>
      <div class="card-sub">\${today.falsePositives} marked as work</div>
    </div>
  \`

  const components = [
    { name: 'Focus ratio', pts: score.focusRatioPoints, max: 40 },
    { name: 'Block resistance', pts: score.blockResistancePoints, max: 30 },
    { name: 'Distraction depth', pts: score.distractionDepthPoints, max: 20 },
    { name: 'Consistency', pts: score.consistencyPoints, max: 10 },
  ]
  document.getElementById('components').innerHTML = components.map(c => {
    const pct = Math.round((c.pts / c.max) * 100)
    return \`<div class="component">
      <div class="component-row"><span class="component-name">\${c.name}</span><span class="component-pts">\${c.pts} / \${c.max}</span></div>
      <div class="bar-bg"><div class="bar-fill \${barClass(pct)}" style="width:\${pct}%"></div></div>
    </div>\`
  }).join('')

  const blocksHtml = today.recentBlocks.length === 0
    ? '<p style="font-size:12px;color:#52525b">No blocks yet today.</p>'
    : \`<table class="blocks-table">
        <thead><tr><th>App / URL</th><th>Reason</th><th>Result</th></tr></thead>
        <tbody>\${today.recentBlocks.map(b => \`
          <tr>
            <td>\${b.url ? b.url.replace(/^https?:\\/\\//, '').slice(0, 40) : b.appName}</td>
            <td style="color:#71717a">\${b.reason ? b.reason.slice(0, 48) : '—'}</td>
            <td><span class="badge badge-distraction">blocked</span></td>
          </tr>\`).join('')}
        </tbody>
      </table>\`
  document.getElementById('blocks-wrap').innerHTML = blocksHtml
}

let chartInstance = null
async function loadPatterns() {
  const data = await fetch('/api/patterns').then(r => r.json())
  const labels = data.map(d => {
    const date = new Date(d.date)
    return date.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })
  })
  const scores = data.map(d => d.score ?? 0)

  if (chartInstance) chartInstance.destroy()
  const ctx = document.getElementById('chart').getContext('2d')
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: scores,
        backgroundColor: scores.map(s => s >= 70 ? '#34d39966' : s >= 40 ? '#fbbf2466' : '#f8717166'),
        borderColor: scores.map(s => s >= 70 ? '#34d399' : s >= 40 ? '#fbbf24' : '#f87171'),
        borderWidth: 1,
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#71717a' }, grid: { color: '#27272a' } },
        y: { min: 0, max: 100, ticks: { color: '#71717a' }, grid: { color: '#27272a' } }
      }
    }
  })

  const nonZero = scores.filter(s => s > 0)
  const avg = nonZero.length ? Math.round(nonZero.reduce((a,b)=>a+b,0)/nonZero.length) : 0
  const best = nonZero.length ? Math.max(...nonZero) : 0
  document.getElementById('pattern-stats').innerHTML = \`
    <div class="card"><div class="card-label">7-day average</div><div class="card-value \${colorClass(avg)}">\${avg}</div></div>
    <div class="card"><div class="card-label">Best day</div><div class="card-value score-green">\${best}</div></div>
    <div class="card"><div class="card-label">Days tracked</div><div class="card-value">\${nonZero.length}</div></div>
  \`
}

async function loadSettings() {
  const cfg = await fetch('/api/config').then(r => r.json())
  document.getElementById('taskLabel').value = cfg.taskLabel || ''
  document.getElementById('workStart').value = cfg.workStartTime || '09:00'
  document.getElementById('workEnd').value = cfg.workEndTime || '18:00'
  document.getElementById('blocklist').value = (cfg.permanentBlocklist || []).join('\\n')
  document.getElementById('workApps').value = (cfg.workApps || []).join('\\n')
}

async function saveSettings() {
  const body = {
    taskLabel: document.getElementById('taskLabel').value.trim(),
    workStartTime: document.getElementById('workStart').value,
    workEndTime: document.getElementById('workEnd').value,
    permanentBlocklist: document.getElementById('blocklist').value.split('\\n').map(s=>s.trim()).filter(Boolean),
    workApps: document.getElementById('workApps').value.split('\\n').map(s=>s.trim()).filter(Boolean),
  }
  await fetch('/api/config', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) })
  const msg = document.getElementById('saved-msg')
  msg.style.opacity = '1'
  setTimeout(() => msg.style.opacity = '0', 2000)
}

loadToday()
</script>
</body>
</html>`

// ── Express server ─────────────────────────────────────────────────────────

export function startDashboard(): void {
  if (server) return
  const app = express()
  app.use(express.json())

  app.get('/', (_, res) => res.send(HTML))

  app.get('/api/score', (_, res) => {
    res.json(calculateScore())
  })

  app.get('/api/today', (_, res) => {
    const db = getDb()
    const { start, end } = dayRange()

    const entries = db.select().from(windowTracking)
      .where(and(gte(windowTracking.timestamp, start), lt(windowTracking.timestamp, end)))
      .all()

    const classified = entries.filter((e) => e.classificationResult !== null)
    const workEntries = classified.filter((e) => !e.isDistraction)

    const blocks = db.select().from(blockLog)
      .where(and(gte(blockLog.timestamp, start), lt(blockLog.timestamp, end)))
      .orderBy(desc(blockLog.timestamp))
      .all()

    res.json({
      focusMinutes: Math.round((workEntries.length * 5) / 60),
      totalMinutes: Math.round((classified.length * 5) / 60),
      totalBlocks: blocks.length,
      falsePositives: blocks.filter((b) => b.falsePositive).length,
      recentBlocks: blocks.slice(0, 8).map((b) => ({
        appName: b.appName,
        url: b.url,
        reason: b.reason,
        timestamp: b.timestamp,
      })),
    })
  })

  app.get('/api/patterns', (_, res) => {
    const db = getDb()
    const rows = db.select().from(focusScoreDaily)
      .orderBy(desc(focusScoreDaily.date))
      .limit(7)
      .all()
      .reverse()

    // Fill in any missing days with score 0
    const result = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      const row = rows.find((r) => r.date === dateStr)
      result.push({ date: dateStr, score: row?.finalScore ?? 0 })
    }
    res.json(result)
  })

  app.get('/api/config', (_, res) => {
    const config = getConfig()
    res.json({ ...config, apiKey: undefined })
  })

  app.post('/api/config', (req, res) => {
    const allowed = ['taskLabel', 'workStartTime', 'workEndTime', 'permanentBlocklist', 'workApps', 'whitelist']
    const patch: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in req.body) patch[key] = req.body[key]
    }
    saveConfig(patch)
    res.json({ ok: true })
  })

  server = app.listen(DASHBOARD_PORT, '127.0.0.1')
}

export function stopDashboard(): void {
  server?.close()
  server = null
}
