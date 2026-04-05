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

  // Used to sync sidebar state on startup from memory
  onInitSidebarState: (callback) => ipcRenderer.on('init-sidebar-state', (event, ...args) => callback(...args)),

  // Proactive parse bridge
  onFastParseUrl: (callback) => ipcRenderer.on('fast-parse-url', (event, ...args) => callback(...args)),

  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  openExternalLink: (url) => ipcRenderer.send('open-external-link', url),

  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  downloadUpdate: () => ipcRenderer.send('download-update'),
  quitAndInstall: () => ipcRenderer.send('quit-and-install'),
  onUpdateChecking: (callback) => ipcRenderer.on('update-checking', (event, ...args) => callback(...args)),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, ...args) => callback(...args)),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', (event, ...args) => callback(...args)),
  onUpdateDownloadProgress: (callback) => ipcRenderer.on('update-download-progress', (event, ...args) => callback(...args)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (event, ...args) => callback(...args)),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (event, ...args) => callback(...args)),
  onUpdateDevMode: (callback) => ipcRenderer.on('update-dev-mode', (event, ...args) => callback(...args)),
  closeWindow: () => ipcRenderer.send('close-window'),
  toggleSidebar: (isCollapsed) => ipcRenderer.send('sidebar-toggle', isCollapsed),
  showWindow: () => ipcRenderer.send('show-window'),
});
