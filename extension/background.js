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

// Connect on startup and keep alive
connect()

// Service workers can be killed — reconnect when woken
chrome.runtime.onStartup.addListener(connect)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg === 'ping') connect()
})
