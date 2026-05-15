import { WebSocketServer, WebSocket } from 'ws'
import { WEBSOCKET_PORT } from '../shared/constants'

let wss: WebSocketServer | null = null
const clients = new Set<WebSocket>()

export function startWebSocketServer(): void {
  if (wss) return

  wss = new WebSocketServer({ port: WEBSOCKET_PORT, host: '127.0.0.1' })

  wss.on('connection', (ws) => {
    clients.add(ws)
    ws.on('close', () => clients.delete(ws))
    ws.on('error', () => clients.delete(ws))
  })

  wss.on('error', () => {
    // Port already in use or other error — fail silently
  })
}

export function closeTab(url: string): void {
  if (clients.size === 0) return
  const msg = JSON.stringify({ type: 'close-tab', url })
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg)
  })
}

export function isExtensionConnected(): boolean {
  return clients.size > 0
}

export function stopWebSocketServer(): void {
  wss?.close()
  wss = null
  clients.clear()
}
