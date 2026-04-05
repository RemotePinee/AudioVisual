// renderer.js
const urlInput = document.getElementById('url-input');
const goButton = document.getElementById('go-button');
const parseButton = document.getElementById('parse-button');
const sidebarToggleButton = document.getElementById('sidebar-toggle-button');
const backButton = document.getElementById('back-button');
const forwardButton = document.getElementById('forward-button');
const homeButton = document.getElementById('home-button');
const minimizeButton = document.getElementById('minimize-button');
const maximizeButton = document.getElementById('maximize-button');
const closeButton = document.getElementById('close-button');
const youkuCustomPage = document.getElementById('youku-custom-page');
const youkuUrlInput = document.getElementById('youku-url-input');
const quickPlatformSelect = document.getElementById('quick-platform-select');
const quickApiSelect = document.getElementById('quick-api-select');
const quickParseButton = document.getElementById('quick-parse-button');
const quickDramaSelect = document.getElementById('quick-drama-select');
const quickModeToggle = document.getElementById('quick-mode-toggle');
const loadingOverlay = document.getElementById('loading-overlay');

const dramaModeButton = document.getElementById('drama-mode-button');
const dramaTheme = document.getElementById('drama-theme');
const container = document.querySelector('.container');
const controlsWrapper = document.querySelector('.controls-wrapper');
const dramaControls = document.querySelector('.drama-controls');
const usageTips = document.querySelector('.usage-tips');
const dramaUsageTips = document.querySelector('.drama-usage-tips');
const sidebarScaler = document.querySelector('.sidebar-scaler');

// Settings Elements
const settingsButton = document.getElementById('settings-button');
const settingsPage = document.getElementById('settings-page');
const closeSettings = document.getElementById('close-settings');
const cancelSettings = document.getElementById('cancel-settings');
const saveSettings = document.getElementById('save-settings');
const resetSettings = document.getElementById('reset-settings');
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
const parsingListInput = document.getElementById('parsing-list-input');
const dramaListInput = document.getElementById('drama-list-input');

let currentVideoUrl = '';
let isCurrentlyParsing = false;
let currentYoukuUrl = '';

// --- UI 工具 ---
function showToast(message, type = 'info') {
    const bgColor = type === 'error' ? '#ff6768' : (type === 'success' ? '#4caf50' : '#3a3d5b');
    Toastify({
        text: message,
        duration: 3000,
        gravity: "top", // `top` or `bottom`
        position: "center", // `left`, `center` or `right`
        offset: {
            y: 70 // 增加偏移量，避开顶部地址栏
        },
        stopOnFocus: true,
        style: {
            background: bgColor,
            borderRadius: "8px",
            boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
            fontSize: "14px",
            fontWeight: "500"
        }
    }).showToast();
}

function showConfirm(message, title = '提示信息') {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-confirm-modal');
        const titleEl = document.getElementById('modal-title');
        const messageEl = document.getElementById('modal-message');
        const confirmBtn = document.getElementById('modal-confirm');
        const cancelBtn = document.getElementById('modal-cancel');

        if (!modal || !titleEl || !messageEl || !confirmBtn || !cancelBtn) {
            resolve(confirm(message)); // Fallback
            return;
        }

        titleEl.textContent = title;
        messageEl.textContent = message;
        modal.style.display = 'flex';

        const cleanup = (result) => {
            modal.style.display = 'none';
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
            resolve(result);
        };

        confirmBtn.onclick = () => cleanup(true);
        cancelBtn.onclick = () => cleanup(false);
    });
}

const platforms = [
    { value: 'https://v.qq.com', label: '腾讯视频' },
    { value: 'https://www.iqiyi.com', label: '爱奇艺' },
    { value: 'https://www.youku.com', label: '优酷' },
    { value: 'https://www.bilibili.com', label: '哔哩哔哩' },
    { value: 'https://www.mgtv.com', label: '芒果TV' }
];

const DEFAULT_API_LIST = [
    { value: "https://jx.xmflv.com/?url=", label: "虾米视频解析" },
    { value: "https://jx.77flv.cc/?url=", label: "七七云解析" },
    { value: "https://jx.playerjy.com/?url=", label: "Player-JY" },
    { value: "https://jiexi.789jiexi.icu:4433/?url=", label: "789解析" },
    { value: "https://jx.2s0.cn/player/?url=", label: "极速解析" },
    { value: "https://bd.jx.cn/?url=", label: "冰豆解析" },
    { value: "https://jx.973973.xyz/?url=", label: "973解析" },
    { value: "https://www.ckplayer.vip/jiexi/?url=", label: "CK" },
    { value: "https://jx.nnxv.cn/tv.php?url=", label: "七哥解析" },
    { value: "https://www.yemu.xyz/?url=", label: "夜幕" },
    { value: "https://www.pangujiexi.com/jiexi/?url=", label: "盘古" },
    { value: "https://www.playm3u8.cn/jiexi.php?url=", label: "playm3u8" },
    { value: "https://video.isyour.love/player/getplayer?url=", label: "芒果TV1" },
    { value: "https://im1907.top/?jx=", label: "芒果TV2" },
    { value: "https://jx.hls.one/?url=", label: "HLS解析" },
];

const DEFAULT_DRAMA_SITES = [
    { value: 'https://www.movie1080.xyz/', label: '影巢movie' },
    { value: 'https://monkey-flix.com/', label: '猴影工坊' },
    { value: 'https://www.letu.me/', label: '茉小影' },
    { value: 'https://www.ncat21.com/', label: '网飞猫' }
];

let apiList = [...DEFAULT_API_LIST];
let dramaSites = [...DEFAULT_DRAMA_SITES];

// --- Settings Persistence ---
const SettingsManager = {
    load() {
        try {
            const savedApis = localStorage.getItem('apiList');
            const savedDramas = localStorage.getItem('dramaSites');

            if (savedApis) apiList = JSON.parse(savedApis);
            if (savedDramas) {
                dramaSites = JSON.parse(savedDramas);
                // Temporary migration to clear old netflixgc cache and apply new defaults
                if (dramaSites.some(d => d.value && d.value.includes('netflixgc.com'))) {
                    console.log('Detected old default drama sites in storage. Resetting to new defaults.');
                    dramaSites = [...DEFAULT_DRAMA_SITES];
                    localStorage.setItem('dramaSites', JSON.stringify(dramaSites));
                }
            }
        } catch (e) {
            console.error('Failed to load settings:', e);
        }
    },
    save(newApis, newDramas) {
        try {
            localStorage.setItem('apiList', JSON.stringify(newApis));
            localStorage.setItem('dramaSites', JSON.stringify(newDramas));
            apiList = newApis;
            dramaSites = newDramas;
            return true;
        } catch (e) {
            console.error('Failed to save settings:', e);
            return false;
        }
    },
    reset() {
        localStorage.removeItem('apiList');
        localStorage.removeItem('dramaSites');
        apiList = [...DEFAULT_API_LIST];
        dramaSites = [...DEFAULT_DRAMA_SITES];
    },
    // Helper to parse textarea into objects
    parseInput(text) {
        return text.split('\n')
            .map(line => line.trim())
            .filter(line => line.includes('|'))
            .map(line => {
                const [label, value] = line.split('|');
                return { label: label.trim(), value: value.trim() };
            });
    },
    // Helper to format objects for textarea
    formatForInput(list) {
        return list.map(item => `${item.label}|${item.value}`).join('\n');
    }
};

SettingsManager.load();

const platformSelect = document.getElementById('platform-select');
const apiSelect = document.getElementById('api-select');

function populateSelect(selectElement, items) {
    items.forEach(item => {
        const option = document.createElement('option');
        option.value = item.value;
        option.textContent = item.label;
        selectElement.appendChild(option);
    });
}

function triggerParse() {
    console.log(`[Renderer] Attempting to trigger parse. isCurrentlyParsing: ${isCurrentlyParsing}, currentVideoUrl: ${currentVideoUrl}`);

    // Detect if the user is trying to parse the platform's homepage
    const isHomepage = platforms.some(p => currentVideoUrl === p.value || currentVideoUrl === p.value + '/');
    if (isHomepage) {
        console.warn('[Renderer] Cannot parse platform homepage.');
        showToast('当前页面为平台首页，请选择具体的视频后再点击解析。', 'error');
        isCurrentlyParsing = false;
        loadingOverlay.classList.add('hidden');
        return;
    }

    if (isCurrentlyParsing && currentVideoUrl) {
        // 立即显示加载状态
        loadingOverlay.classList.remove('hidden');

        const selectedApiUrl = apiSelect.value;
        const finalUrl = selectedApiUrl + currentVideoUrl;
        console.log(`[Renderer] Final Parse URL: ${finalUrl}`);

        // 使用setTimeout确保UI更新后再执行嵌入，避免阻塞
        setTimeout(() => {
            window.voidAPI.embedVideo(finalUrl);
            // 核心修复：1.5秒后强制隐藏加载层，防止遮挡解析结果
            setTimeout(() => {
                loadingOverlay.classList.add('hidden');
            }, 1500);
        }, 50);
    } else {
        console.warn('[Renderer] Cannot trigger parse: missing internal state or URL.');
        loadingOverlay.classList.add('hidden');
    }
}

function parseYoukuUrl() {
    let youkuVideoUrl = youkuUrlInput.value.trim() || currentYoukuUrl;
    if (youkuVideoUrl) {
        currentYoukuUrl = youkuVideoUrl;
        currentVideoUrl = youkuVideoUrl; // 更新currentVideoUrl确保地址栏显示正确
        const selectedApiUrl = apiSelect.value;
        const finalUrl = selectedApiUrl + youkuVideoUrl;
        urlInput.value = currentYoukuUrl;
        loadingOverlay.classList.remove('hidden');
        window.voidAPI.navigate(finalUrl, false);
        youkuCustomPage.style.display = 'none';
    } else {
        // 关键修复：隐藏加载层并使用美观的 Toast 提示
        loadingOverlay.classList.add('hidden');
        showToast('请输入有效的优酷视频链接。', 'error');
    }
}

function navigateTo(url, isPlatformSwitch = false, themeVars = null) {
    loadingOverlay.classList.remove('hidden');
    // Force sync the address bar immediately
    urlInput.value = url;
    currentVideoUrl = url;
    isCurrentlyParsing = false;

    window.voidAPI.navigate(url, isPlatformSwitch, themeVars);

    // Sync quick-drama-select if we are in drama mode
    if (container.classList.contains('drama-mode')) {
        const dramaSite = dramaSites.find(site => url.startsWith(site.value));
        if (dramaSite) {
            quickDramaSelect.value = dramaSite.value;
        }
    }
}

populateSelect(platformSelect, platforms);
populateSelect(apiSelect, apiList);
populateSelect(quickPlatformSelect, platforms);
populateSelect(quickApiSelect, apiList);
populateSelect(quickDramaSelect, dramaSites);

// --- Selector Synchronization ---
function syncSelectors(source, target) {
    target.value = source.value;
}

platformSelect.addEventListener('change', (event) => {
    syncSelectors(platformSelect, quickPlatformSelect);
    const selectedPlatform = event.target.value;
    isCurrentlyParsing = false;
    currentYoukuUrl = '';
    if (selectedPlatform === 'https://www.youku.com') {
        youkuCustomPage.style.display = 'flex';
        urlInput.value = '';
        window.voidAPI.setViewVisibility(false);
    } else {
        youkuCustomPage.style.display = 'none';
        navigateTo(selectedPlatform, true);
    }
});

quickPlatformSelect.addEventListener('change', () => {
    syncSelectors(quickPlatformSelect, platformSelect);
    platformSelect.dispatchEvent(new Event('change'));
});

apiSelect.addEventListener('change', () => {
    syncSelectors(apiSelect, quickApiSelect);
    if (platformSelect.value !== 'https://www.youku.com') {
        triggerParse();
    }
});

quickApiSelect.addEventListener('change', () => {
    syncSelectors(quickApiSelect, apiSelect);
    apiSelect.dispatchEvent(new Event('change'));
});

goButton.addEventListener('click', () => {
    let url = urlInput.value.trim();
    if (url) {
        isCurrentlyParsing = false;
        if (!url.startsWith('http')) url = 'https' + '://' + url;
        currentVideoUrl = url;
        navigateTo(url);
    }
});

urlInput.addEventListener('keydown', (e) => e.key === 'Enter' && goButton.click());

parseButton.addEventListener('click', () => {
    // 立即显示加载状态，提升响应速度
    loadingOverlay.classList.remove('hidden');

    if (platformSelect.value === 'https://www.youku.com') {
        parseYoukuUrl();
    } else {
        isCurrentlyParsing = true;
        // 使用requestAnimationFrame确保UI更新后再执行解析
        requestAnimationFrame(() => {
            triggerParse();
        });
    }
});

apiSelect.addEventListener('change', () => {
    if (platformSelect.value !== 'https://www.youku.com') {
        triggerParse();
    }
});

sidebarToggleButton.addEventListener('click', () => {
    // Force direct class manipulation for robustness
    const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
    console.log('[Renderer] Sidebar toggle. isCollapsed:', isCollapsed);
    requestAnimationFrame(() => window.voidAPI.toggleSidebar(isCollapsed));
});

quickParseButton.addEventListener('click', () => {
    parseButton.click();
});

quickDramaSelect.addEventListener('change', (event) => {
    navigateTo(event.target.value);
});

quickModeToggle.addEventListener('click', (event) => {
    dramaModeButton.click();
});

backButton.addEventListener('click', () => window.voidAPI.goBack());
forwardButton.addEventListener('click', () => window.voidAPI.goForward());

homeButton.addEventListener('click', () => {
    isCurrentlyParsing = false;
    const isDramaMode = container.classList.contains('drama-mode');
    if (isDramaMode) {
        try {
            const currentUrl = new URL(urlInput.value);
            const rootUrl = `${currentUrl.protocol}//${currentUrl.hostname}`;
            navigateTo(rootUrl);
        } catch (error) {
            console.error("Invalid URL in address bar:", urlInput.value);
        }
    } else {
        const homeUrl = platformSelect.value;
        if (homeUrl === 'https://www.youku.com') {
            youkuCustomPage.style.display = 'flex';
            window.voidAPI.setViewVisibility(false);
            urlInput.value = '';
        } else {
            navigateTo(homeUrl, true);
        }
    }
});

minimizeButton.addEventListener('click', () => window.voidAPI.minimizeWindow());
maximizeButton.addEventListener('click', () => window.voidAPI.maximizeWindow());
closeButton.addEventListener('click', () => window.voidAPI.closeWindow());

window.voidAPI.onUrlUpdate((url) => {
    const isApiUrl = apiList.some(api => url.startsWith(api.value));
    if (isApiUrl) {
        // 如果是优酷解析的API URL，显示优酷视频链接
        if (currentYoukuUrl && url.includes(encodeURIComponent(currentYoukuUrl))) {
            urlInput.value = currentYoukuUrl;
        } else {
            urlInput.value = currentVideoUrl;
        }
    } else {
        const previousVideoUrl = currentVideoUrl;
        urlInput.value = url;
        currentVideoUrl = url;

        // 如果是爱奇艺视频页面且URL发生了变化，自动触发解析
        if (url.includes('iqiyi.com/v_') && url.includes('.html') &&
            previousVideoUrl && previousVideoUrl !== url &&
            platformSelect.value === 'https://www.iqiyi.com') {
            console.log('iQiyi episode changed, auto-parsing:', url);
            isCurrentlyParsing = true;
            triggerParse();
        }

        // 如果是腾讯视频页面且URL发生了变化，自动触发解析
        if (url.includes('v.qq.com/x/cover/') &&
            previousVideoUrl && previousVideoUrl !== url &&
            platformSelect.value === 'https://v.qq.com') {
            console.log('Tencent Video episode changed, auto-parsing:', url);
            isCurrentlyParsing = true;
            triggerParse();
        }

        // 如果是芒果TV页面且URL发生了变化，自动触发解析
        if (url.includes('mgtv.com/b/') &&
            previousVideoUrl && previousVideoUrl !== url &&
            platformSelect.value === 'https://www.mgtv.com') {
            console.log('Mango TV episode changed, auto-parsing:', url);
            isCurrentlyParsing = true;
            triggerParse();
        }

        // 如果是哔哩哔哩番剧页面且URL发生了变化，自动触发解析
        if ((url.includes('bilibili.com/bangumi/play/') ||
            url.includes('bilibili.com/video/') && (url.includes('?p=') || url.includes('&p='))) &&
            previousVideoUrl && previousVideoUrl !== url &&
            platformSelect.value === 'https://www.bilibili.com') {
            console.log('Bilibili episode changed, auto-parsing:', url);
            isCurrentlyParsing = true;
            triggerParse();
        }
    }
});

window.voidAPI.onNavStateUpdate(({ canGoBack, canGoForward }) => {
    backButton.disabled = !canGoBack;
    forwardButton.disabled = !canGoForward;
});

window.voidAPI.onLoadFinished(() => {
    loadingOverlay.classList.add('hidden');
});

// 处理主动探测到的视频 URL，实现零延迟注入
window.voidAPI.onFastParseUrl((url) => {
    if (url) {
        currentVideoUrl = url;
        urlInput.value = url;
        isCurrentlyParsing = true;
        triggerParse();
    }
});

window.voidAPI.onInitSidebarState((isCollapsed) => {
    console.log('[Renderer] Received initial sidebar state:', isCollapsed);
    if (isCollapsed) {
        document.body.classList.add('sidebar-collapsed');
    } else {
        document.body.classList.remove('sidebar-collapsed');
    }
});

// --- Initialization ---
function initialize() {
    // Initial UI state setup
    dramaControls.style.display = 'none';
    dramaUsageTips.style.display = 'none';

    // Populate Dynamic UI from settings
    refreshDynamicUI();

    updateDOMForTheme(true);
    // Use setTimeout so the DOM and IPC have time to settle their visual state before navigation triggers
    setTimeout(() => {
        navigateForTheme(true);
    }, 50);
}
// Moved to bottom to ensure all functions are defined

function updateDOMForTheme(isSwitchingToDrama) {
    if (isSwitchingToDrama) {
        dramaModeButton.innerHTML = `
            <div class="button-icon" style="display: flex; align-items: center; justify-content: center; font-size: 16px; line-height: 1;">
                🏠
            </div>
            <div class="button-text">国内解析</div>
        `;
        const modeIcon = quickModeToggle.querySelector('.mode-icon');
        if (modeIcon) modeIcon.textContent = '🏠';
        dramaTheme.disabled = false;
        container.classList.add('drama-mode');
    } else {
        dramaModeButton.innerHTML = `
            <div class="button-icon" style="display: flex; align-items: center; justify-content: center; font-size: 16px; line-height: 1;">
                🌍
            </div>
            <div class="button-text">美韩日剧</div>
        `;
        const modeIcon = quickModeToggle.querySelector('.mode-icon');
        if (modeIcon) modeIcon.textContent = '🌍';
        dramaTheme.disabled = true;
        container.classList.remove('drama-mode');
    }
}

function navigateForTheme(isSwitchingToDrama) {
    const theme = isSwitchingToDrama ? {
        '--av-primary-bg': '#000000',
        '--av-accent-color': '#333333',
        '--av-highlight-color': '#C0FAA0'
    } : {
        '--av-primary-bg': '#1e1e2f',
        '--av-accent-color': '#3a3d5b',
        '--av-highlight-color': '#ff6768'
    };
    const url = isSwitchingToDrama
        ? (dramaSites.length > 0 ? dramaSites[0].value : '')
        : platformSelect.value;

    if (!url) return; // Safety check

    window.voidAPI.setViewVisibility(false);
    if (url === 'https://www.youku.com' && !isSwitchingToDrama) {
        youkuCustomPage.style.display = 'flex';
    } else {
        navigateTo(url, !isSwitchingToDrama, theme);
    }
}

dramaModeButton.addEventListener('click', (event) => {
    const isCurrentlyDrama = container.classList.contains('drama-mode');
    const isSwitchingToDrama = !isCurrentlyDrama;
    navigateForTheme(isSwitchingToDrama);

    if (!document.startViewTransition) {
        updateDOMForTheme(isSwitchingToDrama);
        return;
    }

    const x = event.clientX;
    const y = event.clientY;
    const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const transition = document.startViewTransition(() => updateDOMForTheme(isSwitchingToDrama));
    transition.ready.then(() => {
        document.documentElement.animate(
            { clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`] },
            { duration: 600, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' }
        );
    });
});

// --- Settings Page Logic ---
const tabMetadata = {
    'parsing-tab': { title: '解析接口管理', desc: '配置自定义解析引擎，支持快速切换与负载均衡' },
    'drama-tab': { title: '影视导航管理', desc: '自定义侧边栏影视导航站点，打造您的私人影视库' },
    'appearance-tab': { title: '界面偏好设置', desc: '调整应用视觉风格与交互体验' }
};

const settingsTabTitle = document.getElementById('settings-current-tab-title');
const settingsTabDesc = document.getElementById('settings-current-tab-desc');
const parsingLineCount = document.getElementById('parsing-line-count');
const dramaLineCount = document.getElementById('drama-line-count');

function updateLineCount(textarea, display) {
    const lines = textarea.value.split('\n').filter(l => l.trim() !== '').length;
    display.textContent = lines;
}

function openSettings() {
    parsingListInput.value = SettingsManager.formatForInput(apiList);
    dramaListInput.value = SettingsManager.formatForInput(dramaSites);
    updateLineCount(parsingListInput, parsingLineCount);
    updateLineCount(dramaListInput, dramaLineCount);
    settingsPage.style.display = 'flex';
    window.voidAPI.setViewVisibility(false);
}

function closeSettingsPage() {
    settingsPage.style.display = 'none';
    // Re-show view if we are NOT on youku custom page
    // Using style.display check but falling back to checking if it's explicitly not 'flex'
    // since we use 'flex' for showing it.
    if (youkuCustomPage.style.display !== 'flex') {
        window.voidAPI.setViewVisibility(true);
    }
}

settingsButton.addEventListener('click', openSettings);
closeSettings.addEventListener('click', closeSettingsPage);
cancelSettings.addEventListener('click', async () => {
    if (await showConfirm('确定要恢复默认设置吗？所有自定义列表将被清除。')) {
        SettingsManager.reset();
        refreshDynamicUI();
        parsingListInput.value = SettingsManager.formatForInput(apiList);
        dramaListInput.value = SettingsManager.formatForInput(dramaSites);
        showToast('已恢复默认设置，请点击“应用并保存”使其生效。', 'info');
    }
});

tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const targetTab = btn.dataset.tab;
        document.getElementById(targetTab).classList.add('active');

        // Update header metadata
        if (tabMetadata[targetTab]) {
            settingsTabTitle.textContent = tabMetadata[targetTab].title;
            settingsTabDesc.textContent = tabMetadata[targetTab].desc;
        }
    });
});

[parsingListInput, dramaListInput].forEach(input => {
    const display = input.id === 'parsing-list-input' ? parsingLineCount : dramaLineCount;
    input.addEventListener('input', () => updateLineCount(input, display));
});

saveSettings.addEventListener('click', () => {
    const newApis = SettingsManager.parseInput(parsingListInput.value);
    const newDramas = SettingsManager.parseInput(dramaListInput.value);

    // Enforce 4-site limit for Drama Mode
    if (newDramas.length > 4) {
        showToast('影视导航最多只能添加 4 个网站，请删减后再保存。', 'error');
        return;
    }

    if (SettingsManager.save(newApis, newDramas)) {
        showToast('设置已保存，正在刷新列表...', 'success');
        refreshDynamicUI();
        closeSettingsPage();
    } else {
        showToast('保存失败，请检查输入格式。', 'error');
    }
});

if (resetSettings) {
    resetSettings.addEventListener('click', async () => {
        if (await showConfirm('确定要恢复默认设置吗？所有自定义列表将被清除。')) {
            SettingsManager.reset();
            refreshDynamicUI();
            parsingListInput.value = SettingsManager.formatForInput(apiList);
            dramaListInput.value = SettingsManager.formatForInput(dramaSites);
            showToast('已恢复默认设置', 'info');
        }
    });
}

function refreshDynamicUI() {
    // Clear and re-populate selects
    [apiSelect, quickApiSelect].forEach(sel => {
        sel.innerHTML = '';
        populateSelect(sel, apiList);
    });

    quickDramaSelect.innerHTML = '';
    populateSelect(quickDramaSelect, dramaSites);

    // Refresh sidebar drama site buttons if needed
    refreshDramaSidebar();
}

function refreshDramaSidebar() {
    const dramaControls = document.querySelector('.drama-controls');
    // Keep internal buttons by regenerating them
    dramaControls.innerHTML = dramaSites.map(site => `
        <div class="control-group">
            <button class="action-button custom-drama-btn" data-url="${site.value}">
                <div class="button-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
                    </svg>
                </div>
                <div class="button-text">${site.label}</div>
            </button>
        </div>
    `).join('');

    // Re-attach listeners to new buttons
    dramaControls.querySelectorAll('.custom-drama-btn').forEach(btn => {
        btn.addEventListener('click', () => navigateTo(btn.dataset.url));
    });
}


// Drama buttons are now dynamically generated in refreshDramaSidebar()



document.addEventListener('DOMContentLoaded', () => {
    const externalLink = document.querySelector('.footer a');
    if (externalLink) {
        externalLink.addEventListener('click', (event) => {
            event.preventDefault();
            window.voidAPI.openExternalLink(event.currentTarget.href);
        });
    }

    const checkUpdateButton = document.getElementById('check-update-button');
    const updateNotificationArea = document.getElementById('update-notification-area');
    let currentNotificationTimeout = null;

    function showUpdateNotification(message, type = 'info', persistent = false) {
        if (currentNotificationTimeout) {
            clearTimeout(currentNotificationTimeout);
            currentNotificationTimeout = null;
        }

        updateNotificationArea.innerHTML = `<div style="padding: 8px; border-radius: 4px; font-size: 12px; text-align: center; background: ${type === 'error' ? '#ff6768' : type === 'success' ? 'var(--highlight-color)' : 'var(--accent-color)'}; color: ${type === 'success' ? 'var(--primary-bg)' : 'white'}; word-wrap: break-word; line-height: 1.3;">${message}</div>`;

        if (!persistent && type !== 'success' && type !== 'available') {
            currentNotificationTimeout = setTimeout(() => {
                updateNotificationArea.innerHTML = '';
                currentNotificationTimeout = null;
            }, 8000);
        }
    }

    checkUpdateButton.addEventListener('click', () => {
        checkUpdateButton.disabled = true;
        checkUpdateButton.textContent = '检查中...';
        window.voidAPI.checkForUpdates();
    });

    // 新增：处理开始检查更新的事件
    window.voidAPI.onUpdateChecking(() => {
        console.log('[Renderer] Checking for updates...');
        showUpdateNotification("正在检查更新...", 'info', true);
    });

    window.voidAPI.onUpdateAvailable((info) => {
        console.log('[Renderer] Update available:', info.version);
        checkUpdateButton.disabled = false;
        checkUpdateButton.textContent = '检查更新';
        showUpdateNotification(`🎉 发现新版本 ${info.version}！点击此处开始下载。`, 'available', true);
        const notificationDiv = updateNotificationArea.querySelector('div');
        notificationDiv.style.cursor = 'pointer';
        notificationDiv.onclick = function () {
            showUpdateNotification("⏬ 正在下载更新...", 'info', true);
            window.voidAPI.downloadUpdate();
            const newDiv = updateNotificationArea.querySelector('div');
            if (newDiv) {
                newDiv.onclick = null;
                newDiv.style.cursor = 'default';
            }
        };
    });

    window.voidAPI.onUpdateNotAvailable(() => {
        console.log('[Renderer] Already on latest version');
        checkUpdateButton.disabled = false;
        checkUpdateButton.textContent = '检查更新';
        showUpdateNotification("✅ 已是最新版本", 'success', false);
    });

    window.voidAPI.onUpdateDownloadProgress((progressObj) => {
        const percent = Math.floor(progressObj.percent);
        const downloaded = Math.floor(progressObj.transferred / 1024 / 1024);
        const total = Math.floor(progressObj.total / 1024 / 1024);
        checkUpdateButton.textContent = `下载中 ${percent}%`;
        showUpdateNotification(`⏬ 下载进度: ${percent}% (${downloaded}MB / ${total}MB)`, 'info', true);
    });

    window.voidAPI.onUpdateDownloaded(() => {
        console.log('[Renderer] Update downloaded');
        checkUpdateButton.disabled = false;
        checkUpdateButton.textContent = '检查更新';
        showUpdateNotification("✅ 更新已下载完成！点击此处重启以应用。", 'success', true);
        const notificationDiv = updateNotificationArea.querySelector('div');
        notificationDiv.style.cursor = 'pointer';
        notificationDiv.onclick = function () {
            window.voidAPI.quitAndInstall();
        };
    });

    window.voidAPI.onUpdateError((err) => {
        console.error('[Renderer] Update error:', err);
        checkUpdateButton.disabled = false;
        checkUpdateButton.textContent = '检查更新';
        
        // 提供更友好的错误信息
        let errorMsg = '更新检查失败';
        if (err && err.message) {
            if (err.code === 'TIMEOUT') {
                errorMsg = '⚠️ 检查更新超时，请检查网络连接后重试';
            } else if (err.message.includes('ENOTFOUND') || err.message.includes('ETIMEDOUT')) {
                errorMsg = '⚠️ 网络连接失败，请检查网络后重试';
            } else if (err.message.includes('404')) {
                errorMsg = '⚠️ 未找到更新文件，请稍后重试';
            } else {
                errorMsg = `⚠️ ${err.message}`;
            }
        }
        showUpdateNotification(errorMsg, 'error', false);
    });

    // 处理开发模式提示
    window.voidAPI.onUpdateDevMode((info) => {
        console.log('[Renderer] Update check in dev mode:', info);
        checkUpdateButton.disabled = false;
        checkUpdateButton.textContent = '检查更新';
        showUpdateNotification(`ℹ️ ${info.message}\n当前版本：v${info.version}`, 'info', false);
    });

    // --- Sidebar Auto-Scaling Logic ---
    const sidebar = document.querySelector('.sidebar');
    const sidebarScaler = document.querySelector('.sidebar-scaler');

    if (sidebar && sidebarScaler) {
        const updateSidebarScale = () => {
            const idealHeight = sidebarScaler.scrollHeight;
            const availableHeight = sidebar.clientHeight;

            const verticalPadding = parseFloat(getComputedStyle(sidebarScaler).paddingTop) + parseFloat(getComputedStyle(sidebarScaler).paddingBottom);
            const effectiveAvailableHeight = availableHeight - verticalPadding;

            // Add a small tolerance to prevent scaling for minor pixel differences
            if (idealHeight > effectiveAvailableHeight + 2) {
                const scale = effectiveAvailableHeight / idealHeight;
                sidebarScaler.style.transform = `scale(${scale})`;
            } else {
                sidebarScaler.style.transform = 'scale(1)';
            }
        };

        const resizeObserver = new ResizeObserver(updateSidebarScale);
        resizeObserver.observe(sidebar);

        const mutationObserver = new MutationObserver(updateSidebarScale);
        mutationObserver.observe(sidebarScaler, { childList: true, subtree: true, attributes: true });

        setTimeout(updateSidebarScale, 100);
    }
});

initialize();
