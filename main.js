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

// --- Preload Drama Sites ---
const dramaSites = [
    'https://www.netflixgc.com/',
    'https://www.7.movie/',
    'https://kunzejiaoyu.net/',
    'https://gaze.run/'
];

async function preloadSites() {
    console.log('Starting preload of drama sites...');
    const ghostView = new BrowserView();
    // We don't attach it to any window, it's invisible.
    
    for (const url of dramaSites) {
        try {
            console.log(`Preloading ${url}`);
            await ghostView.webContents.loadURL(url, { cache: 'force-cache' });
            console.log(`Finished preloading ${url}`);
        } catch (error) {
            console.error(`Failed to preload ${url}:`, error);
        }
    }
    
    // Clean up the ghost view
    ghostView.webContents.destroy();
    console.log('Preloading complete.');
}


function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
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
  updateViewBounds(false); // Initially hidden

  view.webContents.on('dom-ready', () => {
    if (view && view.webContents) {
      const combinedCss = currentThemeCss + '\n' + scrollbarCss;
      view.webContents.send('update-styles', combinedCss);
      updateViewBounds(true); // Show the view
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('load-finished');
      }
    }
  });

  view.webContents.on('did-start-navigation', (event, url, isInPlace, isMainFrame) => {
    if (isMainFrame) {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('url-updated', url);
        }
    }
  });
  
  view.webContents.setWindowOpenHandler(({ url }) => {
     view.webContents.loadURL(url, { cache: 'force-cache' });
     return { action: 'deny' };
   });
 
  // --- Window Controls ---
  ipcMain.on('minimize-window', () => mainWindow.minimize());
  ipcMain.on('maximize-window', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on('close-window', () => mainWindow.close());

   // --- Navigation Logic ---
   ipcMain.on('navigate', async (event, { url, isPlatformSwitch, themeVars }) => {
    if (view && view.webContents) {
        updateViewBounds(false); // Hide view before navigation
        if (isPlatformSwitch) {
            await view.webContents.session.clearStorageData({ storages: ['cookies'] });
        }
        if (themeVars) {
            currentThemeCss = `:root { ${Object.entries(themeVars).map(([key, value]) => `${key}: ${value}`).join('; ')} }`;
        }
        view.webContents.loadURL(url, { cache: 'force-cache' });
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

  if (view && view.webContents) {
    const updateNavigationState = () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const navState = {
          canGoBack: view.webContents.canGoBack(),
          canGoForward: view.webContents.canGoForward()
        };
        mainWindow.webContents.send('nav-state-updated', navState);
      }
    };
    view.webContents.on('did-navigate', updateNavigationState);
    view.webContents.on('did-navigate-in-page', updateNavigationState);
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

  mainWindow.on('resize', () => updateViewBounds(view.getBounds().width > 0));
  mainWindow.on('enter-full-screen', () => updateViewBounds(true));
  mainWindow.on('leave-full-screen', () => setTimeout(() => updateViewBounds(true), 50));
}

app.whenReady().then(async () => {
  await session.defaultSession.clearStorageData();
  session.defaultSession.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36');
  await session.defaultSession.clearCache();
  createWindow();
  checkUpdate(); // Check for updates
  preloadSites(); // Start preloading after the main window is created
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.on('open-external-link', (event, url) => {
  shell.openExternal(url);
});

// --- Auto Updater ---
const { autoUpdater } = require('electron-updater');

function checkUpdate() {
  autoUpdater.setFeedURL({
    provider: 'gitee',
    owner: 'sadka',
    repo: 'audio-visual'
  });

  // Event: Found a new version
  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox({
      type: 'info',
      title: '发现新版本',
      message: `检测到新版本 v${info.version}，是否立即更新？`,
      detail: info.releaseNotes.replace(/<[^>]+>/g, ''), // Show release notes from Gitee
      buttons: ['立即更新', '以后再说'],
      defaultId: 0,
      cancelId: 1
    }).then(({ response }) => {
      if (response === 0) {
        // User chose to update, start downloading
        autoUpdater.downloadUpdate();
        mainWindow.webContents.send('update-download-started'); // Optional: notify renderer
      }
    });
  });

  // Event: No new version found
  autoUpdater.on('update-not-available', () => {
    // You can uncomment the line below for testing purposes
    // dialog.showMessageBox({ title: '检查更新', message: '当前已是最新版本。' });
  });

  // Event: Update downloaded
  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: '更新准备就绪',
      message: '新版本已下载完成，是否立即重启以完成安装？',
      buttons: ['立即重启', '稍后重启'],
      defaultId: 0,
      cancelId: 1
    }).then(({ response }) => {
      if (response === 0) {
        // User chose to restart now
        autoUpdater.quitAndInstall();
      }
    });
  });

  // Event: Error during update
  autoUpdater.on('error', (err) => {
    console.error('更新出错:', err);
    // You can uncomment the line below for testing purposes
    // dialog.showErrorBox('更新出错', `检查更新时遇到问题：${err.message}`);
  });

  // Start checking for updates
  autoUpdater.checkForUpdates();
}
