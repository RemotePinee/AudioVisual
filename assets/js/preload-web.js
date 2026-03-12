// preload-web.js - 幽灵的职责：只催眠网站
const { ipcRenderer } = require('electron');
// --- Anti-Bot Detection ---
// Overwrite the navigator.webdriver property to prevent detection by services like Cloudflare
Object.defineProperty(navigator, 'webdriver', {
  get: () => false,
});

// --- 样式注入模块 ---

const STYLE_ID = 'void-dynamic-styles';
const BASE_TAG_SELECTOR = 'base[target="_self"]';

/**
 * 在文档头部注入或更新一个<style>标签，并确保<base>标签存在。
 * @param {string} cssContent - 要注入的CSS字符串。
 */
function applyStyles(cssContent) {
  if (!document.head) {
    return; // 如果<head>不存在则提前退出
  }

  // 1. 确保 <base target="_self"> 存在，修正链接跳转行为
  if (!document.head.querySelector(BASE_TAG_SELECTOR)) {
    const base = document.createElement('base');
    base.target = '_self';
    document.head.prepend(base);
  }

  // 2. 查找或创建用于动态样式的<style>标签
  let styleElement = document.getElementById(STYLE_ID);
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = STYLE_ID;
    // 插入到<head>的最前面，以确保我们的样式优先级最高
    document.head.prepend(styleElement);
  }

  // 3. 更新样式内容 - 添加修复导航点击的样式和爱奇艺会员弹窗处理
  const fixedCssContent = cssContent + `
    /* 修复腾讯视频和哔哩哔哩导航点击问题 */
    .site-nav a, .nav-menu a, .header-nav a, .top-nav a, 
    .navigation a, .navbar a, .menu a, .header-menu a,
    .bili-header .nav-link, .bili-header .nav-item,
    .txp_nav a, .txp_header a, .qq-header a {
      pointer-events: auto !important;
      cursor: pointer !important;
    }
    
    /* 确保导航容器不阻止点击事件 */
    .site-nav, .nav-menu, .header-nav, .top-nav, 
    .navigation, .navbar, .menu, .header-menu,
    .bili-header, .txp_nav, .txp_header, .qq-header {
      pointer-events: auto !important;
    }
    
    /* 隐藏所有已知视频网站的牛皮癣弹窗、广告和干扰图层 (通杀黑名单) */
    #playerPopup, 
    #vipCoversBox, 
    div.iqp-player-vipmask, 
    div.iqp-player-paymask,
    div.iqp-player-loginmask, 
    div[class^=qy-header-login-pop],
    .covers_cloudCover__ILy8R,
    #videoContent > div.loading_loading__vzq4j,
    .iqp-player-guide,
    div.m-iqyGuide-layer,
    .loading_loading__vzq4j,
    [class*="XPlayer_defaultCover__"],
    .iqp-controller,
    /* 腾讯视频 */
    .plugin_ctrl_txp_bottom, .txp_progress_bar_container, .txp_progress_list, .txp_progress, 
    .plugin_ctrl_txp_shadow, .plugin_ctrl_txp_gradient_bottom, 
    .txp_full_screen_pause-active, .txp_full_screen_pause-active-mask, .txp_full_screen_pause-active-player, 
    .txp_center_controls, .txp-layer-above-control, .txp-layer-dynamic-above-control--on,
    .txp_btn_play, .txp_btn, .txp_popup-active, .txp_popup_content, .mod_player_vip_ads,
    .playlist-overlay-minipay,
    /* 爱奇艺及通用弹窗拦截 */
    .browser-ver-tip, .videopcg-browser-tips, .qy-player-browser-tip, .iqp-browser-tip, 
    .m-pc-down, .m-pc-client, .qy-dialog-container, .iqp-client-guide, .qy-dialog-wrap,
    [class*="shapedPopup_container"], [class*="notSupportedDrm_drmTipsPopBox"],
    [class*="floatPage_floatPage"], #tvgCashierPage, [class*="popwin_fullCover"],
    /* 其他 */
    .bilibili-player-video-wrap, .bilibili-player-video-control, .bilibili-player-electric-panel
    /* 注意：已移除芒果 TV 容器隐藏，防止 0 宽度无法注入 */
    /* .mgtv-player-wrap, .mgtv-player-control-bar, .mgtv-player-data-panel, .mgtv-player-layers, .mgtv-player-ad, .mgtv-player-overlay, #m-player-ad */
    {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
      width: 0 !important;
      height: 0 !important;
      z-index: -9999 !important;
    }
  `;
  styleElement.textContent = fixedCssContent;
}

// --- 事件监听 ---

// 监听主进程推送的样式更新
ipcRenderer.on('update-styles', (event, cssContent) => {
  applyStyles(cssContent);
});

// --- 主动式解析逻辑 ---
// 监听点击事件，主动发现换集行为
document.addEventListener('click', (event) => {
  // 爱奇艺换集检测
  if (window.location.hostname.includes('iqiyi.com')) {
    const anchor = event.target.closest('a');
    if (anchor && anchor.href && anchor.href.includes('iqiyi.com/v_')) {
      console.log('[preload-web] Detected iQiyi episode click:', anchor.href);
      ipcRenderer.send('proactive-parse-request', anchor.href);
    }
  }
  // 芒果 TV 换集检测
  if (window.location.hostname.includes('mgtv.com')) {
    const anchor = event.target.closest('a');
    if (anchor && anchor.href && anchor.href.includes('mgtv.com/b/')) {
      console.log('[preload-web] Detected Mango TV episode click:', anchor.href);
      ipcRenderer.send('proactive-parse-request', anchor.href);
    }
  }
}, true); // 使用捕获阶段以最快速度拦截事件


// --- DOM 监控 ---

// 使用MutationObserver作为备用方案，确保在DOM动态变化时也能应用样式
const observer = new MutationObserver(() => {
  // 当DOM变化时，我们不主动请求CSS，而是依赖主进程在'dom-ready'时推送。
  // 此处仅用于确保<base>标签在极端情况下也能被添加。
  if (document.head && !document.head.querySelector(BASE_TAG_SELECTOR)) {
    const base = document.createElement('base');
    base.target = '_self';
    document.head.prepend(base);
  }
});

// 启动对整个文档结构的监控
observer.observe(document, { childList: true, subtree: true });

// 页面初始加载时也尝试运行一次，以防万一
applyStyles(''); // 传入空字符串以确保<base>标签被处理

// --- 注入引擎 (Thread-Local Guardian) ---

let currentGuardianInterval = null;
let guardianStartTime = 0;

/**
 * 核心注入逻辑：在页面中寻找合适的容器并嵌入播放器
 * @param {string} url - 播放器 URL
 */
function startInjectionGuardian(url) {
  if (currentGuardianInterval) {
    clearInterval(currentGuardianInterval);
    console.log('[Guardian] Cleared previous guardian interval.');
  }

  const iframeId = 'void-player-iframe';
  const iframeSrc = url;
  guardianStartTime = Date.now();

  // 使用高频 50ms 轮询前 5 秒，解决“瞬时秒入”问题
  currentGuardianInterval = setInterval(() => {
    const elapsed = Date.now() - guardianStartTime;

    // 如果超过 20 秒还没成功或页面已稳定，可以考虑放慢频率，但目前保持固定频率或直到成功
    // 注入成功后我们依然保持监视，防止页面拉回原生播放器（芒果 TV 常见操作）

    // 1. 静音并隐藏原生视频
    document.querySelectorAll('video').forEach(el => {
      try {
        el.muted = true;
        if (!el.paused) el.pause();
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
      } catch (e) { }
    });

    // 2. 清理干扰元素 (仅限非容器元素)
    const nuisanceSelectors = [
      '#playerPopup', '#vipCoversBox', 'div.iqp-player-vipmask',
      'div.iqp-player-paymask', 'div.iqp-player-loginmask',
      'div[class^=qy-header-login-pop]', '.covers_cloudCover__ILy8R',
      '#videoContent > div.loading_loading__vzq4j', '.iqp-player-guide',
      'div.m-iqyGuide-layer', '.loading_loading__vzq4j',
      '[class*="XPlayer_defaultCover__"]', '.iqp-controller',
      '.plugin_ctrl_txp_bottom', '.txp_progress_bar_container', '.txp_progress_list', '.txp_progress',
      '.plugin_ctrl_txp_shadow', '.plugin_ctrl_txp_gradient_bottom',
      '.txp_full_screen_pause-active', '.txp_full_screen_pause-active-mask', '.txp_full_screen_pause-active-player',
      '.txp_center_controls', '.txp-layer-above-control', '.txp-layer-dynamic-above-control--on',
      '.txp_btn_play', '.txp_btn', '.txp_popup-active', '.txp_popup_content', '.mod_player_vip_ads',
      '.playlist-overlay-minipay',
      '.browser-ver-tip', '.videopcg-browser-tips', '.qy-player-browser-tip', '.iqp-browser-tip',
      '.m-pc-down', '.m-pc-client', '.qy-dialog-container', '.iqp-client-guide', '.qy-dialog-wrap',
      '[class*="shapedPopup_container"]', '[class*="notSupportedDrm_drmTipsPopBox"]',
      '[class*="floatPage_floatPage"]', '#tvgCashierPage', '[class*="popwin_fullCover"]'
    ];
    document.querySelectorAll(nuisanceSelectors.join(',')).forEach(el => {
      el.style.display = 'none';
      el.style.zIndex = '-9999';
    });

    // 3. 寻找注入目标 (核心提速点)
    let targetRef = document.querySelector('#mod_player') ||
      document.querySelector('.txp_player') ||
      document.querySelector('.txp_video_container');

    if (!targetRef) {
      const searchList = [
        '#m-player-video-container', '.mgtv-video-container', '.mgtv-player-container', '.mgtv-player-wrap', '#mgtv-player', '.mgtv-player', '.mango-layer', '.mgtv-player-ad', // Mango TV Priority
        '.mgtv-player-layers-container', '.mgtv-player-video-area', '.mgtv-player-video-box', '.mgtv-player-video-content', // Expanded Mango TV selectors
        '.iqp-player', '#flashbox', '.txp_player_video_wrap', '#bilibili-player', '.player-wrap', '#player-container', '#player', '.player-container', '.player-view', '.video-wrapper', 'video'
      ];
      for (let s of searchList) {
        const el = document.querySelector(s);
        // 只要元素存在且宽度超过 10px 即可注入
        if (el && el.getBoundingClientRect().width > 10) {
          targetRef = el;
          break;
        }
      }
    }

    if (targetRef) {
      const isMango = window.location.hostname.includes('mgtv.com');
      const isTencent = window.location.hostname.includes('qq.com');
      const rect = targetRef.getBoundingClientRect();

      // 统一使用漂浮策略，避免由于容器层级导致的显示问题
      if (rect.width > 50 && rect.height > 50) {
        let iframe = document.getElementById(iframeId);
        if (!iframe || iframe.getAttribute('data-src') !== iframeSrc) {
          if (iframe) iframe.remove();
          iframe = document.createElement('iframe');
          iframe.id = iframeId;
          iframe.src = iframeSrc;
          iframe.setAttribute('data-src', iframeSrc);
          iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
          iframe.allowFullscreen = true;
          document.body.appendChild(iframe);
        }

        Object.assign(iframe.style, {
          position: 'fixed',
          top: rect.top + 'px',
          left: rect.left + 'px',
          width: rect.width + 'px',
          height: rect.height + 'px',
          border: 'none',
          zIndex: '2147483647',
          background: '#000'
        });

        // 成功注入后，如果是 Mango/Tencent 的某些顽固页面，5秒内降低频率，5秒后保持 250ms 监控位移
        if (elapsed > 5000) {
          clearInterval(currentGuardianInterval);
          currentGuardianInterval = setInterval(() => startInjectionGuardian(url), 250);
        }
      }
    }
  }, 50); // 50ms 超高频探测
}

// 核心：处理来自主进程的解析指令
ipcRenderer.on('apply-embed-video', (event, url) => {
  console.log('[preload-web] >>> RECEIVED apply-embed-video signal:', url);

  // 显式清理旧的播放器，确保即便 URL 相同，点击“解析”也要有动作（刷新）
  const oldIframe = document.getElementById('void-player-iframe');
  if (oldIframe) {
    oldIframe.remove();
    console.log('[preload-web] Force-cleared old iframe to allow re-parse.');
  }

  startInjectionGuardian(url);
});

// 核心：页面加载的第一时间主动请求解析，解决“第一次注入慢”
(() => {
  const url = window.location.href;
  const isVideoPage = url.includes('iqiyi.com/v_') || url.includes('mgtv.com/b/') || url.includes('v.qq.com/x/cover/');
  if (isVideoPage) {
    ipcRenderer.send('proactive-parse-request', url);
  }
})();
