// main.js

const { app, BrowserWindow, BrowserView, ipcMain, session, shell, dialog } = require('electron');

const path = require('path');
const fs = require('fs');
const os = require('os');

// --- Environment & Security Configuration ---

// 1. Environment Detection
const isDev = !app.isPackaged;

// 2. Hardware Acceleration (Low Risk)
app.disableHardwareAcceleration();

// 3. Command Line Switches
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
app.commandLine.appendSwitch('no-proxy-server');

// Development-only switches
if (isDev) {
  console.log('Running in development mode. Applying insecure workarounds.');
  app.commandLine.appendSwitch('ignore-certificate-errors');
}

// 4. Certificate Error Handler
if (isDev) {
  app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    console.log(`[DEV ONLY] Certificate error for ${url}: ${error}`);
    event.preventDefault();
    callback(true);
  });
}

// --- Application Setup ---
app.setPath('userData', path.join(__dirname, 'userData'));

// --- Widevine CDM Injection ---
function getWidevinePath() {
    const platform = os.platform();
    const arch = os.arch();
    let widevinePath = '';
    const paths = {
        'win32': `${os.homedir()}/AppData/Local/Google/Chrome/User Data/WidevineCdm`,
        'darwin': `${os.homedir()}/Library/Application Support/Google/Chrome/WidevineCdm`,
        'linux': `${os.homedir()}/.config/google-chrome/WidevineCdm`
    };
    if (paths[platform]) {
        if (!fs.existsSync(paths[platform])) return null;
        const versions = fs.readdirSync(paths[platform]).filter(f => fs.statSync(`${paths[platform]}/${f}`).isDirectory());
        if (versions.length > 0) {
            const latestVersion = versions.sort().pop();
            let cdmPath = '';
            if (platform === 'win32') cdmPath = `${paths[platform]}/${latestVersion}/_platform_specific/win_${arch === 'x64' ? 'x64' : 'x86'}/widevinecdm.dll`;
            else if (platform === 'darwin') cdmPath = `${paths[platform]}/${latestVersion}/_platform_specific/mac_${arch}/libwidevinecdm.dylib`;
            else if (platform === 'linux') cdmPath = `${paths[platform]}/${latestVersion}/_platform_specific/linux_${arch}/libwidevinecdm.so`;
            if (fs.existsSync(cdmPath)) return { path: cdmPath, version: latestVersion };
        }
    }
    return null;
}
const widevineInfo = getWidevinePath();
if (widevineInfo) {
    app.commandLine.appendSwitch('widevine-cdm-path', widevineInfo.path);
    app.commandLine.appendSwitch('widevine-cdm-version', widevineInfo.version);
} else {
    console.error('Widevine CDM not found.');
}

let mainWindow;
let view;
let currentThemeCss = `:root { --primary-bg: #1e1e2f; --accent-color: #3a3d5b; --highlight-color: #ff6768; }`;
const scrollbarCss = fs.readFileSync(path.join(__dirname, 'assets', 'css', 'view-style.css'), 'utf8');

// --- Pre-rendering Logic ---
const preloadedViews = new Map(); // Stores fully rendered BrowserViews
const dramaSites = [
    'https://www.netflixgc.com/',
    'https://www.7.movie/',
    'https://kunzejiaoyu.net/',
    'https://gaze.run/'
];

async function preloadSites() {
    console.log('Starting pre-rendering of drama sites...');
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    for (const url of dramaSites) {
        try {
            console.log(`Pre-rendering ${url}`);
            const ghostView = new BrowserView({
                webPreferences: {
                    contextIsolation: true,
                    nodeIntegration: false,
                    preload: path.join(__dirname, 'assets', 'js', 'preload-web.js'),
                    plugins: true
                }
            });

            const loadPromise = new Promise((resolve, reject) => {
                const handleFinish = () => {
                    cleanup();
                    resolve();
                };
                const handleFail = (event, errorCode, errorDescription) => {
                    cleanup();
                    if (errorCode !== -3) { // -3 is ABORTED
                       reject(new Error(`ERR_FAILED (${errorCode}) loading '${url}': ${errorDescription}`));
                    } else {
                       resolve();
                    }
                };
                const cleanup = () => {
                    ghostView.webContents.removeListener('did-finish-load', handleFinish);
                    ghostView.webContents.removeListener('did-fail-load', handleFail);
                };

                ghostView.webContents.on('did-finish-load', handleFinish);
                ghostView.webContents.on('did-fail-load', handleFail);
                ghostView.webContents.loadURL(url);
            });

            await loadPromise;
            preloadedViews.set(url, ghostView); // Store the fully rendered view
            console.log(`Finished pre-rendering ${url}`);
        } catch (error) {
            console.error(`Failed to pre-render ${url}:`, error);
        }
        await delay(500);
    }
    console.log('Pre-rendering complete.');
}

function attachViewEvents(targetView) {
  if (!targetView || !targetView.webContents || targetView.webContents.isDestroyed()) {
    return;
  }

  targetView.webContents.on('dom-ready', () => {
    if (targetView && targetView.webContents && !targetView.webContents.isDestroyed()) {
      const combinedCss = currentThemeCss + '\n' + scrollbarCss;
      targetView.webContents.insertCSS(combinedCss); // Use insertCSS for reliability
      updateViewBounds(true);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('load-finished');
      }
    }
  });

  targetView.webContents.on('did-start-navigation', (event, url, isInPlace, isMainFrame) => {
    if (isMainFrame && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('url-updated', url);
    }
  });

  targetView.webContents.setWindowOpenHandler(({ url }) => {
    if (targetView && targetView.webContents && !targetView.webContents.isDestroyed()) {
      targetView.webContents.loadURL(url);
    }
    return { action: 'deny' };
  });

  const updateNavigationState = () => {
    if (mainWindow && !mainWindow.isDestroyed() && targetView && targetView.webContents && !targetView.webContents.isDestroyed()) {
      const navState = {
        canGoBack: targetView.webContents.canGoBack(),
        canGoForward: targetView.webContents.canGoForward()
      };
      mainWindow.webContents.send('nav-state-updated', navState);
    }
  };
  targetView.webContents.on('did-navigate', updateNavigationState);
  targetView.webContents.on('did-navigate-in-page', updateNavigationState);
}

function updateViewBounds(isVisible = true) {
  if (!mainWindow || !view) return;
  const isFullScreen = mainWindow.isFullScreen();
  if (isFullScreen) {
    const bounds = mainWindow.getBounds();
    view.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height });
  } else {
    const sidebarWidth = 250;
    const topBarHeight = 56;
    const contentBounds = mainWindow.getContentBounds();
    if (isVisible) {
      view.setBounds({
        x: sidebarWidth,
        y: topBarHeight,
        width: contentBounds.width - sidebarWidth,
        height: contentBounds.height - topBarHeight
      });
    } else {
      view.setBounds({ x: sidebarWidth, y: topBarHeight, width: 0, height: 0 });
    }
  }
}

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'assets', 'js', 'preload-ui.js')
    },
    title: "AudioVisual",
    icon: path.join(__dirname, 'assets', 'images', 'icon.png')
  });

  mainWindow.loadFile('index.html');
  if (isDev) {
    // mainWindow.webContents.openDevTools();
  }
  mainWindow.setMenu(null);

  view = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'assets', 'js', 'preload-web.js'),
      plugins: true
    }
  });

  mainWindow.setBrowserView(view);
  attachViewEvents(view);
  updateViewBounds(false); // Initially hidden

  // --- Window Controls ---
  ipcMain.on('minimize-window', () => mainWindow.minimize());
  ipcMain.on('maximize-window', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on('close-window', () => mainWindow.close());
  ipcMain.on('set-view-visibility', (event, visible) => {
    updateViewBounds(visible);
  });

   // --- Navigation Logic ---
   ipcMain.on('navigate', async (event, { url, isPlatformSwitch, themeVars }) => {
    if (themeVars) {
        currentThemeCss = `:root { ${Object.entries(themeVars).map(([key, value]) => `${key}: ${value}`).join('; ')} }`;
    }

    if (preloadedViews.has(url)) {
        const newView = preloadedViews.get(url);
        preloadedViews.delete(url); // Use it only once

        if (view) {
            mainWindow.removeBrowserView(view);
            if (view.webContents && !view.webContents.isDestroyed()) {
                view.webContents.destroy();
            }
        }

        view = newView;
        mainWindow.setBrowserView(view);
        attachViewEvents(view);
        updateViewBounds(true);
    } else {
        if (view && view.webContents) {
            updateViewBounds(false);
            if (isPlatformSwitch) {
                await view.webContents.session.clearStorageData({ storages: ['cookies'] });
            }
            view.webContents.loadURL(url);
        }
    }
});

  ipcMain.on('go-back', () => {
    if (view && view.webContents.canGoBack()) view.webContents.goBack();
  });
  ipcMain.on('go-forward', () => {
    if (view && view.webContents.canGoForward()) view.webContents.goForward();
  });

  ipcMain.on('embed-video', (event, url) => {
    if (view) {
      const script = `
        (() => {
          if (window.voidPlayerInterval) clearInterval(window.voidPlayerInterval);
          const selectorsToRemove = ['[class*="XPlayer_defaultCover__"]', '.iqp-controller', '.video'];
          const selectorsToHide = ['video', '.txp_video_container'];
          window.voidPlayerInterval = setInterval(() => {
            document.querySelectorAll('video').forEach(v => { if (!v.paused) v.pause(); });
            document.querySelectorAll(selectorsToRemove.join(',')).forEach(el => el.remove());
            document.querySelectorAll(selectorsToHide.join(',')).forEach(el => { if (el.style.display !== 'none') el.style.display = 'none'; });
          }, 250);
          const existingIframe = document.getElementById('void-player-iframe');
          if (existingIframe) existingIframe.remove();
          const selectors = ['.iqp-player', '#flashbox', '.txp_player_video_wrap', '#bilibili-player', '#player-container', '#player', '.player-container', '.player-view'];
          let playerContainer = null;
          for (const selector of selectors) {
            playerContainer = document.querySelector(selector);
            if (playerContainer) break;
          }
          if (playerContainer) {
            if (window.getComputedStyle(playerContainer).position === 'static') playerContainer.style.position = 'relative';
            const iframe = document.createElement('iframe');
            iframe.id = 'void-player-iframe';
            iframe.src = "${url}";
            Object.assign(iframe.style, { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', border: 'none', zIndex: '9999' });
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
            iframe.allowFullscreen = true;
            playerContainer.appendChild(iframe);
          } else {
            console.error('[VoidPlayer] Could not find a suitable player container.');
          }
        })();
      `;
      view.webContents.executeJavaScript(script).catch(err => console.error('Failed to execute injection script:', err));
    }
  });

  mainWindow.on('resize', () => updateViewBounds(view.getBounds().width > 0));
  mainWindow.on('enter-full-screen', () => updateViewBounds(true));
  mainWindow.on('leave-full-screen', () => setTimeout(() => updateViewBounds(true), 50));
  
  // 处理窗口最小化和恢复事件
  mainWindow.on('minimize', () => {
    // 窗口最小化时隐藏 BrowserView
    if (view) {
      view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    }
  });
  
  mainWindow.on('restore', () => {
    // 窗口恢复时重新显示 BrowserView
    if (view) {
      updateViewBounds(true);
      // 确保 BrowserView 可见
      setTimeout(() => {
        if (view && view.webContents) {
          view.webContents.focus();
        }
      }, 100);
    }
  });
  
  mainWindow.on('show', () => {
    // 窗口显示时确保 BrowserView 正常显示
    if (view) {
      updateViewBounds(true);
      setTimeout(() => {
        if (view && view.webContents) {
          view.webContents.focus();
        }
      }, 100);
    }
  });
}

app.whenReady().then(async () => {
  await session.defaultSession.clearStorageData();
  session.defaultSession.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36');

  const filter = { urls: ['*://*/*'] };
  session.defaultSession.webRequest.onHeadersReceived(filter, (details, callback) => {
    if (details.responseHeaders) {
      details.responseHeaders['Cache-Control'] = ['public, max-age=86400, immutable']; // 24 hours
      delete details.responseHeaders['pragma'];
      delete details.responseHeaders['expires'];
    }
    callback({ responseHeaders: details.responseHeaders });
  });

  const cacheInfoPath = path.join(app.getPath('userData'), 'cache_info.json');
  const twentyFourHours = 24 * 60 * 60 * 1000;
  let cacheIsValid = false;

  if (fs.existsSync(cacheInfoPath)) {
    try {
      const cacheInfo = JSON.parse(fs.readFileSync(cacheInfoPath, 'utf8'));
      if (cacheInfo.lastPreloadTimestamp && (Date.now() - cacheInfo.lastPreloadTimestamp < twentyFourHours)) {
        cacheIsValid = true;
        console.log('Pre-rendering cache is still valid.');
      }
    } catch (error) {
      console.error('Error reading cache info file:', error);
    }
  }

  createWindow();
  

  if (!cacheIsValid) {
    console.log('Pre-rendering cache is stale or missing. Clearing cache and re-rendering.');
    await session.defaultSession.clearCache();
    await preloadSites();
    try {
      fs.writeFileSync(cacheInfoPath, JSON.stringify({ lastPreloadTimestamp: Date.now() }));
      console.log('Updated pre-rendering cache timestamp.');
    } catch (error) {
      console.error('Error writing cache info file:', error);
    }
  } else {
    console.log('Skipping pre-rendering as cache is valid.');
  }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.on('open-external-link', (event, url) => {
  shell.openExternal(url);
});
ipcMain.on('check-for-updates', () => {
  checkUpdate();
});

ipcMain.on('download-update', () => {
  autoUpdater.downloadUpdate();
});

ipcMain.on('quit-and-install', () => {
  autoUpdater.quitAndInstall();
});

// --- Auto Updater ---
const { autoUpdater } = require('electron-updater');

function checkUpdate() {
  //开发模式下禁用强制更新配置，避免开发时的不必要更新检查
  // if (isDev) {
  //   autoUpdater.forceDevUpdateConfig = true;
  // }
  

  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update-available', info);
  });

  autoUpdater.on('update-not-available', () => {
    mainWindow.webContents.send('update-not-available');
  });

  autoUpdater.on('download-progress', (progressObj) => {
    mainWindow.webContents.send('update-download-progress', progressObj);
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update-downloaded');
  });

  autoUpdater.on('error', (err) => {
    mainWindow.webContents.send('update-error', err);
  });

  // Start checking for updates
  autoUpdater.checkForUpdates();
}
