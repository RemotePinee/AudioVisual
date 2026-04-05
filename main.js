// main.js

const { app, screen, BrowserWindow, BrowserView, ipcMain, session, shell, dialog } = require('electron');

const path = require('path');
const fs = require('fs');
const os = require('os');

// --- Debounce Utility ---
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// --- Environment & Security Configuration ---

// 1. Environment Detection
const isDev = false; // Forced to false to disable auto DevTools

// 2. Hardware Acceleration (Re-enabled for performance)
// app.disableHardwareAcceleration(); // Commented out to fix resize flickering issue.

// 3. Command Line Switches
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
app.commandLine.appendSwitch('no-proxy-server');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion'); // Fixes some white flashes on Windows

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
let isSidebarCollapsed = false;
let currentThemeCss = `:root { --av-primary-bg: #1e1e2f; --av-accent-color: #3a3d5b; --av-highlight-color: #ff6768; }`;
const scrollbarCss = fs.readFileSync(path.join(__dirname, 'assets', 'css', 'view-style.css'), 'utf8');

// --- Pre-rendering Logic ---
const viewPool = new Map(); // Stores fully rendered BrowserViews persistently
const dramaSites = [
  'https://monkey-flix.com/',
  'https://www.movie1080.xyz/',
  'https://www.letu.me/',
  'https://www.ncat21.com/'
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
      ghostView.setBackgroundColor('#1e1e2f');
      attachViewEvents(ghostView);

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
      viewPool.set(url, ghostView); // Store the fully rendered view
      console.log(`Finished pre-rendering ${url}`);
    } catch (error) {
      console.error(`Failed to pre-render ${url}:`, error);
    }
    await delay(500);
  }
  console.log('Pre-rendering complete.');
}

function injectThemeCss(targetView) {
  if (targetView && targetView.webContents && !targetView.webContents.isDestroyed()) {
    const nuisanceCss = `
      /* 强制隐藏已知顽固弹窗 */
      [class*="popwin_fullCover"], 
      [class*="shapedPopup_container"], 
      [class*="notSupportedDrm_drmTipsPopBox"],
      [class*="floatPage_floatPage"], 
      #tvgCashierPage,
      .browser-ver-tip, 
      .qy-dialog-container,
      .iqp-player-guide,
      .mgtv-player-layers, .mgtv-player-ad, .mgtv-player-overlay, #m-player-ad {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        width: 0 !important;
        height: 0 !important;
        z-index: -9999 !important;
      }
    `;
    const combinedCss = currentThemeCss + '\n' + scrollbarCss + '\n' + nuisanceCss;
    targetView.webContents.insertCSS(combinedCss).catch(console.error);
  }
}

function attachViewEvents(targetView) {
  if (!targetView || !targetView.webContents || targetView.webContents.isDestroyed()) {
    return;
  }

  targetView.webContents.on('dom-ready', () => {
    if (targetView && targetView.webContents && !targetView.webContents.isDestroyed()) {
      injectThemeCss(targetView);
      if (view === targetView) {
        updateViewBounds(true);
        updateZoomFactor(targetView); // Set initial zoom
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('load-finished');
        }
      }
    }
  });

  targetView.webContents.on('did-start-navigation', (event, url, isInPlace, isMainFrame) => {
    if (isMainFrame && mainWindow && !mainWindow.isDestroyed() && view === targetView) {
      mainWindow.webContents.send('url-updated', url);
      // 核心：页面加载的第一时间主动请求解析，解决“第一次注入慢”
      targetView.webContents.executeJavaScript(`
        (() => {
          const url = window.location.href;
          const isVideoPage = url.includes('iqiyi.com/v_') || url.includes('mgtv.com/b/') || url.includes('v.qq.com/x/cover/');
          if (isVideoPage) {
            ipcRenderer.send('proactive-parse-request', url);
          }
        })();
      `);
    }
  });

  targetView.webContents.on('did-navigate', (event, url) => {
    if (view !== targetView) return;
    console.log('Page navigated to:', url);
    if ((url.includes('iqiyi.com/v_') || url.includes('mgtv.com/b/') || url.includes('v.qq.com/x/cover/')) && mainWindow) {
      console.log('[Main] Auto-triggering fast-parse for navigation to video page:', url);
      mainWindow.webContents.send('fast-parse-url', url);
    }
    // 附加保障：did-navigate 时也补一次脉冲
    if ((url.includes('iqiyi.com/v_') || url.includes('mgtv.com/b/') || url.includes('v.qq.com/x/cover/')) && mainWindow) {
      mainWindow.webContents.send('fast-parse-url', url);
    }
    if (url.includes('iqiyi.com/v_') && url.includes('.html')) {
      console.log('iQiyi redirected to correct video page:', url);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('url-updated', url);
      }
    }
  });

  targetView.webContents.on('did-navigate-in-page', (event, url) => {
    if (view !== targetView) return;
    console.log('Page navigated in-page to:', url);
  });

  targetView.webContents.setWindowOpenHandler(({ url }) => {
    if (view !== targetView) return { action: 'deny' };
    if (targetView && targetView.webContents && !targetView.webContents.isDestroyed()) {
      console.log(`[WindowOpenHandler] Intercepted new window for URL: ${url}. Loading in current view and forcing re-parse.`);
      targetView.webContents.loadURL(url);
      updateViewBounds(true);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('fast-parse-url', url);
      }
    }
    return { action: 'deny' };
  });

  const updateNavigationState = () => {
    if (view !== targetView) return;
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
    const contentBounds = mainWindow.getContentBounds();
    // 响应式布局计算逻辑，需与 style.css 保持一致
    // 侧边栏宽度：clamp(200px, 18vw, 280px)
    let sidebarWidth = Math.max(200, Math.min(Math.floor(contentBounds.width * 0.18), 280));
    if (isSidebarCollapsed) {
      sidebarWidth = 0;
    }
    console.log(`[Main] updateViewBounds. isCollapsed: ${isSidebarCollapsed}, sidebarWidth: ${sidebarWidth}`);

    // 顶部工具栏高度：clamp(50px, 7vh, 65px)
    const topBarHeight = Math.max(50, Math.min(Math.floor(contentBounds.height * 0.07), 65));

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

function updateZoomFactor(targetView) {
  if (!targetView || !targetView.webContents || targetView.webContents.isDestroyed()) {
    return;
  }
  const viewBounds = targetView.getBounds();
  const viewWidth = viewBounds.width;
  if (viewWidth > 0) {
    const idealWidth = 1400; // Assumed ideal width for video websites
    const zoomFactor = viewWidth / idealWidth;
    targetView.webContents.setZoomFactor(zoomFactor);
    console.log(`[Zoom] View width is ${viewWidth}, setting zoom to ${zoomFactor.toFixed(2)}`);
  }
}

function createNewBrowserView() {
  const newView = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'assets', 'js', 'preload-web.js'),
      plugins: true
    }
  });
  attachViewEvents(newView);

  // Anti-debugging trap: Many parser sites have aggressive `debugger;` loops that completely freeze 
  // their JavaScript execution if they detect DevTools are open. 
  // 自动调试已根据用户要求关闭
  if (isDev) {
    newView.webContents.openDevTools({ mode: 'detach' });
  }

  newView.setBackgroundColor('#1e1e2f');
  return newView;
}

// --- Window State Persistence ---
function getWindowState() {
  try {
    const stateFile = path.join(app.getPath('userData'), 'window-state.json');
    if (fs.existsSync(stateFile)) {
      return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to read window state:', e);
  }
  return null;
}

function saveWindowState() {
  if (mainWindow) {
    try {
      const stateFile = path.join(app.getPath('userData'), 'window-state.json');
      const state = {
        bounds: mainWindow.getBounds(),
        isMaximized: mainWindow.isMaximized(),
        isSidebarCollapsed: isSidebarCollapsed
      };
      fs.writeFileSync(stateFile, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save window state:', e);
    }
  }
}

function createWindow() {
  const windowState = getWindowState();
  if (windowState && windowState.isSidebarCollapsed !== undefined) {
    isSidebarCollapsed = windowState.isSidebarCollapsed;
  }
  const { workAreaSize } = screen.getPrimaryDisplay();
  const initialWidth = Math.min(1440, Math.round(workAreaSize.width * 0.8));
  const initialHeight = Math.min(1000, Math.round(workAreaSize.height * 0.85));

  let windowOptions = {
    width: windowState?.bounds?.width || initialWidth,
    height: windowState?.bounds?.height || initialHeight,
    x: windowState?.bounds?.x,
    y: windowState?.bounds?.y,
    minWidth: 940,
    minHeight: 620,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#11111a', // Solid base color matching our CSS
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'assets', 'js', 'preload-ui.js')
    },
    title: "AudioVisual",
    icon: path.join(__dirname, 'assets', 'images', 'icon.png'),
    show: false
  };

  const { nativeTheme } = require('electron');
  // Removed forced dark mode to allow following system theme

  mainWindow = new BrowserWindow(windowOptions);

  if (windowState?.isMaximized) {
    mainWindow.maximize();
  }

  const saveStateDebounced = debounce(saveWindowState, 500);
  mainWindow.on('resize', saveStateDebounced);
  mainWindow.on('move', saveStateDebounced);
  mainWindow.on('close', saveWindowState);

  ipcMain.once('show-window', () => {
    mainWindow.show();
    mainWindow.webContents.send('init-sidebar-state', isSidebarCollapsed);

    // Attach view right away since we no longer have a manual fade-in
    if (view) {
      mainWindow.setBrowserView(view);
      updateViewBounds(true);
    }

    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.setMenu(null);

  view = createNewBrowserView();
  // mainWindow.setBrowserView(view); // Deferred to ready-to-show
  // updateViewBounds(false); // Deferred to ready-to-show

  ipcMain.on('minimize-window', () => mainWindow.minimize());
  ipcMain.on('maximize-window', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on('close-window', () => mainWindow.close());

  ipcMain.on('sidebar-toggle', (event, collapsed) => {
    isSidebarCollapsed = collapsed;
    updateViewBounds(true);
  });

  ipcMain.on('set-view-visibility', (event, visible) => {
    if (visible) {
      if (view && mainWindow) {
        mainWindow.setBrowserView(view);
        view.webContents.setAudioMuted(false);
        updateViewBounds(true);
      }
    } else {
      if (view && mainWindow) {
        console.log('[Visibility] Hiding view by detaching and muting it.');
        view.webContents.setAudioMuted(true);
        mainWindow.removeBrowserView(view);
      }
    }
  });

  ipcMain.on('navigate', async (event, { url, isPlatformSwitch, themeVars }) => {
    if (themeVars) {
      currentThemeCss = `:root { ${Object.entries(themeVars).map(([key, value]) => `${key}: ${value}`).join('; ')} }`;
    }
    console.log(`[Navigate] Received request for ${url}.`);
    if (view) {
      mainWindow.removeBrowserView(view);
      // Detach and persist in pool instead of destroying
      console.log('[Navigate] Old BrowserView detached and kept in pool.');
    }

    let isFromCache = false;
    if (viewPool.has(url)) {
      console.log(`[Navigate] Using cached view for ${url}.`);
      view = viewPool.get(url);
      isFromCache = true;
    } else {
      console.log(`[Navigate] Creating a fresh BrowserView for ${url}.`);
      view = createNewBrowserView();
      viewPool.set(url, view);
    }

    mainWindow.setBrowserView(view);
    updateViewBounds(true); // Must be true, setting it to 0x0 destroys frame buffer and causes layout flash

    /* // User reported slow platform switching, removing cookie clearing for now
    if (isPlatformSwitch) {
      await view.webContents.session.clearStorageData({ storages: ['cookies'] });
    }
    */

    if (!isFromCache) {
      view.webContents.loadURL(url);
      console.log(`[Navigate] Loading URL: ${url}`);
      // 核心提速：立即通知解析引擎开始工作，不等 BrowserView 的各种事件。解决“第一次加载慢”
      if ((url.includes('iqiyi.com/v_') || url.includes('mgtv.com/b/') || url.includes('v.qq.com/x/cover/')) && mainWindow) {
        console.log('[Navigate] Extreme Speed: Early pulse for initial load:', url);
        mainWindow.webContents.send('fast-parse-url', url);
      }
    } else {
      console.log(`[Navigate] Activating cached URL: ${url}`);
      injectThemeCss(view);
      updateZoomFactor(view);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('url-updated', url);
        mainWindow.webContents.send('load-finished');
      }
    }
  });

  ipcMain.on('go-back', () => {
    if (view && view.webContents.canGoBack()) view.webContents.goBack();
  });
  ipcMain.on('go-forward', () => {
    if (view && view.webContents.canGoForward()) view.webContents.goForward();
  });

  ipcMain.on('proactive-parse-request', (event, url) => {
    console.log('[main.js] Received proactive parse request for:', url);
    updateViewBounds(true);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('fast-parse-url', url);
    }
  });

  ipcMain.on('embed-video', (event, url) => {
    if (view && view.webContents && !view.webContents.isDestroyed()) {
      console.log('[Main] Sending apply-embed-video to view for:', url);
      view.webContents.send('apply-embed-video', url);
    }
  });

  const debouncedUpdateZoom = debounce(updateZoomFactor, 150);

  const handleResize = () => {
    const isVisible = view && view.getBounds().width > 0;
    updateViewBounds(isVisible); // Update bounds immediately
    if (isVisible) {
      debouncedUpdateZoom(view); // Debounce zoom factor updates
    }
  };

  mainWindow.on('resize', handleResize);
  mainWindow.on('enter-full-screen', handleResize);
  mainWindow.on('leave-full-screen', () => setTimeout(handleResize, 50));

  mainWindow.on('minimize', () => {
    if (view) {
      view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    }
  });

  mainWindow.on('restore', () => {
    if (view) {
      updateViewBounds(true);
      setTimeout(() => {
        if (view && view.webContents) {
          view.webContents.focus();
        }
      }, 100);
    }
  });

  mainWindow.on('show', () => {
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
  await session.defaultSession.clearCache();

  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = userAgent;
    callback({ requestHeaders: details.requestHeaders });
  });

  const filter = { urls: ['*://*/*'] };
  session.defaultSession.webRequest.onHeadersReceived(filter, (details, callback) => {
    if (details.responseHeaders) {
      const headersToLower = Object.keys(details.responseHeaders).reduce((acc, key) => {
        acc[key.toLowerCase()] = key;
        return acc;
      }, {});

      if (headersToLower['content-security-policy']) {
        delete details.responseHeaders[headersToLower['content-security-policy']];
      }
      if (headersToLower['x-frame-options']) {
        delete details.responseHeaders[headersToLower['x-frame-options']];
      }
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
    console.log('Cache is missing or stale. Clearing session cache...');
    await session.defaultSession.clearCache();
    try {
      fs.writeFileSync(cacheInfoPath, JSON.stringify({ lastPreloadTimestamp: Date.now() }));
      console.log('Updated session cache timestamp.');
    } catch (error) {
      console.error('Error writing cache info file:', error);
    }
  }

  // Unconditionally preload sites on startup, regardless of session cache validity
  await preloadSites();

  // Initialize auto updater after window is ready
  initializeAutoUpdater();
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

// 检测是否为开发模式（应用未打包）
const isAppPacked = app.isPackaged;

// 配置 autoUpdater
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

// 添加日志以便调试（如果 electron-log 可用）
try {
  autoUpdater.logger = require('electron-log');
  autoUpdater.logger.transports.file.level = 'info';
} catch (e) {
  // electron-log 不可用，使用 console
  autoUpdater.logger = console;
}

let isUpdaterInitialized = false;
let updateCheckTimeout = null;

function initializeAutoUpdater() {
  if (isUpdaterInitialized) {
    return;
  }

  console.log('[AutoUpdater] Initializing auto updater...');
  console.log('[AutoUpdater] Current version:', app.getVersion());
  console.log('[AutoUpdater] Update feed URL:', `https://github.com/${autoUpdater.getFeedURL?.() || 'RemotePinee/AudioVisual'}`);

  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for updates...');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-checking');
    }
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Update available:', info.version);
    if (updateCheckTimeout) {
      clearTimeout(updateCheckTimeout);
      updateCheckTimeout = null;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-available', info);
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('[AutoUpdater] Update not available. Current version:', info.version);
    if (updateCheckTimeout) {
      clearTimeout(updateCheckTimeout);
      updateCheckTimeout = null;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-not-available');
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const logMessage = `Downloaded ${Math.floor(progressObj.percent)}% (${Math.floor(progressObj.transferred / 1024 / 1024)}MB / ${Math.floor(progressObj.total / 1024 / 1024)}MB)`;
    console.log('[AutoUpdater]', logMessage);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-download-progress', progressObj);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Update downloaded:', info.version);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-downloaded');
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Error:', err);
    if (mainWindow && !mainWindow.isDestroyed()) {
      // 提供更友好的错误信息
      const errorMessage = err.message || err.toString();
      mainWindow.webContents.send('update-error', {
        message: errorMessage,
        code: err.code,
        stack: err.stack
      });
    }
  });

  isUpdaterInitialized = true;
  console.log('[AutoUpdater] Initialization complete.');
}

function checkUpdate() {
  if (!isUpdaterInitialized) {
    initializeAutoUpdater();
  }

  // 清除之前的超时定时器
  if (updateCheckTimeout) {
    clearTimeout(updateCheckTimeout);
    updateCheckTimeout = null;
  }

  console.log('[AutoUpdater] Manually checking for updates...');
  console.log('[AutoUpdater] App is packed:', isAppPacked);

  // 开发模式下的特殊处理
  if (!isAppPacked) {
    console.log('[AutoUpdater] Running in development mode, update check is disabled.');
    if (mainWindow && !mainWindow.isDestroyed()) {
      // 延迟一下让用户看到"检查中"状态
      setTimeout(() => {
        mainWindow.webContents.send('update-dev-mode', {
          message: '开发模式下无法检查更新。\n请使用打包后的应用程序进行更新检查。',
          version: app.getVersion()
        });
      }, 500);
    }
    return;
  }

  // 设置30秒超时，防止一直卡住
  updateCheckTimeout = setTimeout(() => {
    console.error('[AutoUpdater] Check timeout after 30 seconds');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-error', {
        message: '检查更新超时，请检查网络连接或稍后重试。',
        code: 'TIMEOUT'
      });
    }
  }, 30000);
  
  try {
    autoUpdater.checkForUpdates()
      .then(result => {
        console.log('[AutoUpdater] Check result:', result);
      })
      .catch(err => {
        console.error('[AutoUpdater] Check failed:', err);
        if (updateCheckTimeout) {
          clearTimeout(updateCheckTimeout);
          updateCheckTimeout = null;
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('update-error', {
            message: err.message || '检查更新失败，请检查网络连接或稍后重试。',
            code: err.code
          });
        }
      });
  } catch (err) {
    console.error('[AutoUpdater] Check failed (sync error):', err);
    if (updateCheckTimeout) {
      clearTimeout(updateCheckTimeout);
      updateCheckTimeout = null;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-error', {
        message: err.message || '检查更新失败，请检查网络连接或稍后重试。',
        code: err.code
      });
    }
  }
}
