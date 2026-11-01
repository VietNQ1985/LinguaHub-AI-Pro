import { ipcRenderer } from 'electron'
import { observeVisibleChatChanges } from '../shared/chat-change-observer'

let stopObserving: (() => void) | undefined

ipcRenderer.on('chat:observer-control', (_event, enabled: unknown) => {
  if (enabled === true && !stopObserving) {
    stopObserving = observeVisibleChatChanges(observedAt => {
      ipcRenderer.send('chat:visible-dom-change', observedAt)
    })
  } else if (enabled !== true && stopObserving) {
    stopObserving()
    stopObserving = undefined
  }
})
