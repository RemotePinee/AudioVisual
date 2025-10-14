// main.js

const { app, BrowserWindow, BrowserView, ipcMain, session, shell } = require('electron');

const path = require('path');
const fs = require('fs');
const os = require('os');

// --- Environment & Security Configuration ---

// 1. Environment Detection
const isDev = !app.isPackaged;

// 2. Hardware Acceleration (Low Risk)
// Disabled to prevent potential rendering issues and network conflicts.
// This is generally safe for production.
app.disableHardwareAcceleration();

// 3. Command Line Switches
// These are applied before the app is ready.

// Universal switches (safe for production)
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
app.commandLine.appendSwitch('no-proxy-server');

// Development-only switches (HIGH RISK - DO NOT USE IN PRODUCTION)
if (isDev) {
  console.log('Running in development mode. Applying insecure workarounds.');
  // Allows self-signed/invalid certificates.
  app.commandLine.appendSwitch('ignore-certificate-errors');
  // Disables the Chromium sandbox, a core security feature.
  //app.commandLine.appendSwitch('no-sandbox');
}

// 4. Certificate Error Handler (HIGH RISK - DO NOT USE IN PRODUCTION)
// This event handler is a last resort to bypass certificate validation errors.
if (isDev) {
  app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    console.log(`[DEV ONLY] Certificate error for ${url}: ${error}`);
    event.preventDefault();
    callback(true); // Approve the certificate
  });
}

// --- Application Setup ---

// Set custom userData path to solve cache permission issues
app.setPath('userData', path.join(__dirname, 'userData'));

// --- Widevine CDM Injection ---
function getWidevinePath() {
    const platform = os.platform();
    const arch = os.arch();
    let widevinePath = '';

    // Common paths for Widevine CDM
    const paths = {
        'win32': `${os.homedir()}/AppData/Local/Google/Chrome/User Data/WidevineCdm`,
        'darwin': `${os.homedir()}/Library/Application Support/Google/Chrome/WidevineCdm`,
        'linux': `${os.homedir()}/.config/google-chrome/WidevineCdm`
    };

    if (paths[platform]) {
        const fs = require('fs');
        if (!fs.existsSync(paths[platform])) return null;
        const versions = fs.readdirSync(paths[platform]).filter(f => fs.statSync(`${paths[platform]}/${f}`).isDirectory());
        if (versions.length > 0) {
            const latestVersion = versions.sort().pop();
            let cdmPath = '';
            if (platform === 'win32') {
                cdmPath = `${paths[platform]}/${latestVersion}/_platform_specific/win_${arch === 'x64' ? 'x64' : 'x86'}/widevinecdm.dll`;
            } else if (platform === 'darwin') {
                cdmPath = `${paths[platform]}/${latestVersion}/_platform_specific/mac_${arch}/libwidevinecdm.dylib`;
            } else if (platform === 'linux') {
                cdmPath = `${paths[platform]}/${latestVersion}/_platform_specific/linux_${arch}/libwidevinecdm.so`;
            }
            
            if (fs.existsSync(cdmPath)) {
                return { path: cdmPath, version: latestVersion };
            }
        }
    }
    return null;
}

const widevineInfo = getWidevinePath();
if (widevineInfo) {
    app.commandLine.appendSwitch('widevine-cdm-path', widevineInfo.path);
    app.commandLine.appendSwitch('widevine-cdm-version', widevineInfo.version);
} else {
    console.error('Widevine CDM not found. Protected content may not play.');
}

let mainWindow;
let view;
let isViewVisible = true; 
// --- Theme Management ---
let currentThemeCss = `:root { --primary-bg: #1e1e2f; --accent-color: #3a3d5b; --highlight-color: #ff6768; }`;

// Preload the custom scrollbar CSS
const scrollbarCss = fs.readFileSync(path.join(__dirname, 'assets', 'css', 'view-style.css'), 'utf8');

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
    // Open DevTools only in development mode
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

  // Push styles and show the view as soon as the DOM is ready for maximum speed
  view.webContents.on('dom-ready', () => {
    if (view && view.webContents) {
      // 1. Push styles to preload script for injection
      const combinedCss = currentThemeCss + '\n' + scrollbarCss;
      view.webContents.send('update-styles', combinedCss);
    }
  });

  // --- New Event Listener for Instant Feedback ---
  view.webContents.on('did-start-navigation', (event, url, isInPlace, isMainFrame) => {
    if (isMainFrame) {
      // 1. Update URL in the address bar immediately
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('url-updated', url);
      }

      // 2. Ensure the view is visible and has correct bounds
      isViewVisible = true;
      updateViewBounds();

      // 3. Notify the renderer to hide the loading overlay
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('load-finished');
      }
    }
  });

  mainWindow.setBrowserView(view);
  updateViewBounds(); 
  
  view.webContents.setWindowOpenHandler(({ url }) => {
     view.webContents.loadURL(url);
     return { action: 'deny' };
   });
 
  // --- Window Controls ---
  ipcMain.on('minimize-window', () => {
    mainWindow.minimize();
  });

  ipcMain.on('maximize-window', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.on('close-window', () => {
    mainWindow.close();
  });

   // --- 神聆听祈祷，并下达指令 ---
   ipcMain.on('navigate', async (event, { url, isPlatformSwitch, themeVars }) => {
    if (view && view.webContents) {
        if (isPlatformSwitch) {
            await view.webContents.session.clearStorageData({
                storages: ['cookies']
            });
        }
        
        if (themeVars) {
            // Update the current theme CSS string. It will be pushed on 'dom-ready'.
            currentThemeCss = `:root { ${Object.entries(themeVars).map(([key, value]) => `${key}: ${value}`).join('; ')} }`;
        }
        
        // Navigate to the new URL (happens in the background if the view was hidden by the renderer)
        view.webContents.loadURL(url);
    }
});

  ipcMain.handle('get-current-url', () => {
    return view ? view.webContents.getURL() : '';
  });

  ipcMain.on('go-back', () => {
    if (view && view.webContents.canGoBack()) {
      view.webContents.goBack();
    }
  });

  ipcMain.on('go-forward', () => {
    if (view && view.webContents.canGoForward()) {
      view.webContents.goForward();
    }
  });

  ipcMain.on('set-view-visibility', (event, visible) => {
    isViewVisible = visible; 
    updateViewBounds(); 
  });

  ipcMain.on('embed-video', (event, url) => {
    if (view) {
      const script = `
        (() => {
          // --- VoidPlayer Injection Script ---

          // 1. Clear any existing interval to prevent multiple loops
          if (window.voidPlayerInterval) {
            clearInterval(window.voidPlayerInterval);
          }

          // 2. Define selectors for elements that need to be persistently removed or hidden
          const selectorsToRemove = [
            '[class*="XPlayer_defaultCover__"]', // The main iQiyi control container
            '.iqp-controller',
            '.video'
          ];
          const selectorsToHide = [
            'video',
            '.txp_video_container'
          ];

          // 3. Set up an interval to continuously enforce the state
          window.voidPlayerInterval = setInterval(() => {
            // Pause all videos
            document.querySelectorAll('video').forEach(video => {
              if (!video.paused) {
                video.pause();
              }
            });
            // PERMANENTLY REMOVE unwanted elements
            document.querySelectorAll(selectorsToRemove.join(', ')).forEach(el => {
              el.remove();
            });
            // Hide other elements
            document.querySelectorAll(selectorsToHide.join(', ')).forEach(el => {
              if (el.style.display !== 'none') {
                el.style.display = 'none';
              }
            });
          }, 250); // Run this check 4 times a second

          // 4. Remove any existing player iframe to allow for interface switching
          const existingIframe = document.getElementById('void-player-iframe');
          if (existingIframe) {
            existingIframe.remove();
          }

          // 5. Define a list of potential selectors for the video player container
          const selectors = [
            '.iqp-player',            // iQiyi
            '#flashbox',              // iQiyi
            '.txp_player_video_wrap', // Tencent Video
            '#bilibili-player',       // Bilibili
            '#player-container',      // General container
            '#player',                // Common ID
            '.player-container',      // Common class
            '.player-view'            // Youku
          ];

          // 6. Find the player container
          let playerContainer = null;
          for (const selector of selectors) {
            playerContainer = document.querySelector(selector);
            if (playerContainer) break;
          }

          // 7. If a container is found, inject the new player
          if (playerContainer) {
            // Ensure the container can support absolute positioning
            if (window.getComputedStyle(playerContainer).position === 'static') {
              playerContainer.style.position = 'relative';
            }

            // 8. Create and inject the new iframe player
            const iframe = document.createElement('iframe');
            iframe.id = 'void-player-iframe';
            iframe.src = "${url}";
            iframe.style.position = 'absolute';
            iframe.style.top = '0';
            iframe.style.left = '0';
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            iframe.style.zIndex = '9999'; // Ensure it's on top
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
    const updateNavigationState = (url) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const navState = {
          canGoBack: view.webContents.canGoBack(),
          canGoForward: view.webContents.canGoForward()
        };
        mainWindow.webContents.send('nav-state-updated', navState);
        mainWindow.webContents.send('url-updated', url);
      }
    };

    view.webContents.on('did-navigate', (event, url) => updateNavigationState(url));
    view.webContents.on('did-navigate-in-page', (event, url) => updateNavigationState(url));
  }
  
  function updateViewBounds() {
    if (!mainWindow || !view) return;

    const isFullScreen = mainWindow.isFullScreen();
    
    if (isFullScreen) {
      const bounds = mainWindow.getBounds();
      view.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height });
    } else {
      const sidebarWidth = 250;
      const topBarHeight = 56;
      const contentBounds = mainWindow.getContentBounds();
      
      if (isViewVisible) {
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

  mainWindow.on('resize', updateViewBounds);
  mainWindow.on('enter-full-screen', updateViewBounds);
  mainWindow.on('leave-full-screen', () => {
    setTimeout(updateViewBounds, 50);
  });
}

app.whenReady().then(async () => {
  // Clear session data and cache on startup to fix SSL/Cache issues
  await session.defaultSession.clearStorageData();
  // Set a common user-agent to bypass bot detection
  session.defaultSession.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36');
  await session.defaultSession.clearCache();
  createWindow();
});

// App Lifecycle
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// --- External Link Handling ---
ipcMain.on('open-external-link', (event, url) => {
  shell.openExternal(url);
});
