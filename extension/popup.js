// Wake up background service worker
chrome.runtime.sendMessage('ping')

chrome.storage.local.get(['connected'], ({ connected }) => {
  const dot = document.getElementById('dot')
  const status = document.getElementById('status')
  const hint = document.getElementById('hint')

  if (connected) {
    dot.className = 'dot connected'
    status.textContent = 'Connected to MirrorAgent'
    hint.textContent = 'Tab blocking is active. Distraction sites will be closed automatically.'
  } else {
    dot.className = 'dot disconnected'
    status.textContent = 'MirrorAgent not running'
    hint.textContent = 'Start MirrorAgent on your Mac to enable tab blocking.'
  }
})
