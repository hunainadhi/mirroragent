const WS_URL = 'ws://127.0.0.1:1423'
const RECONNECT_MS = 3000

let ws = null
let reconnectTimer = null

function connect() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return

  try {
    ws = new WebSocket(WS_URL)
  } catch {
    scheduleReconnect()
    return
  }

  ws.onopen = () => {
    clearTimeout(reconnectTimer)
    chrome.storage.local.set({ connected: true })
  }

  ws.onmessage = (event) => {
    let msg
    try { msg = JSON.parse(event.data) } catch { return }

    if (msg.type === 'close-tab' && msg.url) {
      closeMatchingTabs(msg.url)
    }
  }

  ws.onclose = () => {
    chrome.storage.local.set({ connected: false })
    scheduleReconnect()
  }

  ws.onerror = () => {
    ws?.close()
  }
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer)
  reconnectTimer = setTimeout(connect, RECONNECT_MS)
}

async function closeMatchingTabs(targetUrl) {
  const tabs = await chrome.tabs.query({})
  const toClose = tabs.filter((tab) => {
    if (!tab.url) return false
    try {
      const tabHost = new URL(tab.url).hostname
      const targetHost = new URL(targetUrl).hostname
      return tabHost === targetHost || tab.url === targetUrl
    } catch {
      return tab.url === targetUrl
    }
  })
  const ids = toClose.map((t) => t.id).filter((id) => id != null)
  if (ids.length > 0) chrome.tabs.remove(ids)
}

// Connect on startup
connect()

// Use alarms to keep service worker alive and maintain WebSocket connection
// Alarms fire even after the service worker would normally be killed
chrome.alarms.create('keepAlive', { periodInMinutes: 0.4 }) // every ~24s

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    // Re-connect if socket dropped
    if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      connect()
    }
  }
})

chrome.runtime.onStartup.addListener(connect)
chrome.runtime.onInstalled.addListener(connect)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg === 'ping') connect()
})
