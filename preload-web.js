// preload-web.js - 幽灵的职责：只催眠网站
const { ipcRenderer } = require('electron');

// --- 催眠师：注入 <base target="_self"> 和自定义样式 ---
async function hypnotize() {
  if (document.head) {
    // 注入 <base target="_self">
    if (!document.head.querySelector('base[target="_self"]')) {
      const base = document.createElement('base');
      base.target = '_self';
      document.head.prepend(base);
    }

    // 注入自定义滚动条样式
    if (!document.head.querySelector('#custom-scrollbar-style')) {
      const css = await ipcRenderer.invoke('get-scrollbar-css');
      const style = document.createElement('style');
      style.id = 'custom-scrollbar-style';
      style.textContent = css;
      document.head.prepend(style);
    }
  }
}

// 观察DOM变化，以确保<head>元素出现时能够及时催眠
const observer = new MutationObserver(() => {
  hypnotize();
});
observer.observe(document, { childList: true, subtree: true });

hypnotize(); // 初始页面加载时尝试一次
