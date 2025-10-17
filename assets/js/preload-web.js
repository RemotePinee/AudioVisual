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
    
    /* 隐藏爱奇艺会员弹窗和遮罩层 */
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
    .loading_loading__vzq4j {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
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
