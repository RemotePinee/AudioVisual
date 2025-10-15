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
  
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  downloadUpdate: () => ipcRenderer.send('download-update'),
  quitAndInstall: () => ipcRenderer.send('quit-and-install'),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, ...args) => callback(...args)),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', (event, ...args) => callback(...args)),
  onUpdateDownloadProgress: (callback) => ipcRenderer.on('update-download-progress', (event, ...args) => callback(...args)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (event, ...args) => callback(...args)),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (event, ...args) => callback(...args)),
  closeWindow: () => ipcRenderer.send('close-window'),
  
});
