// preload-ui.js

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('voidAPI', {
  navigate: (url, isPlatformSwitch = false) => ipcRenderer.send('navigate', { url, isPlatformSwitch }),

  embedVideo: (url) => ipcRenderer.send('embed-video', url),

  goBack: () => ipcRenderer.send('go-back'),
  goForward: () => ipcRenderer.send('go-forward'),
  setViewVisibility: (visible) => ipcRenderer.send('set-view-visibility', visible),

  onUrlUpdate: (callback) => ipcRenderer.on('url-updated', (event, ...args) => callback(...args)),

  onNavStateUpdate: (callback) => ipcRenderer.on('nav-state-updated', (event, ...args) => callback(...args)),
  
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window')
});
