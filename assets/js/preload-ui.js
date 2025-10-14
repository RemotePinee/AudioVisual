// preload-ui.js

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('voidAPI', {
  // Updated to accept themeVars
  navigate: (url, isPlatformSwitch = false, themeVars = null) => ipcRenderer.send('navigate', { url, isPlatformSwitch, themeVars }),

  embedVideo: (url) => ipcRenderer.send('embed-video', url),

  goBack: () => ipcRenderer.send('go-back'),
  goForward: () => ipcRenderer.send('go-forward'),
  setViewVisibility: (visible) => ipcRenderer.send('set-view-visibility', visible),

  onUrlUpdate: (callback) => ipcRenderer.on('url-updated', (event, ...args) => callback(...args)),

  onNavStateUpdate: (callback) => ipcRenderer.on('nav-state-updated', (event, ...args) => callback(...args)),
  
  // Channel for the main process to notify when content is ready
  onLoadFinished: (callback) => ipcRenderer.on('load-finished', () => callback()),

  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  openExternalLink: (url) => ipcRenderer.send('open-external-link', url),
  closeWindow: () => ipcRenderer.send('close-window')
});
