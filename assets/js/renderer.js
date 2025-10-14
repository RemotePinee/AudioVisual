// renderer.js
const urlInput = document.getElementById('url-input');
const goButton = document.getElementById('go-button');
const parseButton = document.getElementById('parse-button');
const backButton = document.getElementById('back-button');
const forwardButton = document.getElementById('forward-button');
const homeButton = document.getElementById('home-button');
const minimizeButton = document.getElementById('minimize-button');
const maximizeButton = document.getElementById('maximize-button');
const closeButton = document.getElementById('close-button');
const youkuCustomPage = document.getElementById('youku-custom-page');
const youkuUrlInput = document.getElementById('youku-url-input');
const loadingOverlay = document.getElementById('loading-overlay');

let currentVideoUrl = ''; // 用于存储非优酷平台的原始视频URL
let isCurrentlyParsing = false; // 用于跟踪是否处于嵌入式解析播放状态
let currentYoukuUrl = ''; // 用于存储当前正在解析的优酷URL
let isYoukuParsing = false; // 状态锁：标记是否正在进行优酷解析

const platforms = [
    { value: 'https://v.qq.com', label: '腾讯视频' },
    { value: 'https://www.iqiyi.com', label: '爱奇艺' },
    { value: 'https://www.youku.com', label: '优酷' },
    { value: 'https://www.bilibili.com', label: '哔哩哔哩' },
    { value: 'https://www.mgtv.com', label: '芒果TV' }
];

const apiList = [
    {value: "https://jx.playerjy.com/?url=", label: "Player-JY"},
    {value: "https://jiexi.789jiexi.icu:4433/?url=", label: "789解析"},
    {value: "https://jx.2s0.cn/player/?url=", label: "极速解析"},
    {value: "https://bd.jx.cn/?url=", label: "冰豆解析"},
    {value: "https://jx.973973.xyz/?url=", label: "973解析"},
    {value: "https://jx.xmflv.com/?url=", label: "虾米视频解析"},
    {value: "https://www.ckplayer.vip/jiexi/?url=", label: "CK"},
    {value: "https://jx.nnxv.cn/tv.php?url=", label: "七哥解析"},
    {value: "https://www.yemu.xyz/?url=", label: "夜幕"},
    {value: "https://www.pangujiexi.com/jiexi/?url=", label: "盘古"},
    {value: "https://www.playm3u8.cn/jiexi.php?url=", label: "playm3u8"},
    {value: "https://jx.77flv.cc/?url=", label: "七七云解析"},
    {value: "https://video.isyour.love/player/getplayer?url=", label: "芒果TV1"},
    {value: "https://im1907.top/?jx=", label: "芒果TV2"},
    {value: "https://jx.hls.one/?url=", label: "HLS解析"},
];

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
    if (isCurrentlyParsing && currentVideoUrl) {
        const selectedApiUrl = apiSelect.value;
        const finalUrl = selectedApiUrl + currentVideoUrl;
        window.voidAPI.embedVideo(finalUrl);
    }
}

function parseYoukuUrl() {
    let youkuVideoUrl = youkuUrlInput.value.trim() || currentYoukuUrl;

    if (youkuVideoUrl) {
        isYoukuParsing = true; 
        currentYoukuUrl = youkuVideoUrl; 
        const selectedApiUrl = apiSelect.value;
        const finalUrl = selectedApiUrl + youkuVideoUrl;

        urlInput.value = currentYoukuUrl;
        loadingOverlay.classList.remove('hidden');
        window.voidAPI.navigate(finalUrl, false);

        youkuCustomPage.style.display = 'none';
        // Let main process control visibility
    } else {
        alert('请输入有效的优酷视频链接。');
    }
}

populateSelect(platformSelect, platforms);
populateSelect(apiSelect, apiList);

platformSelect.addEventListener('change', (event) => {
    const selectedPlatform = event.target.value;
    isCurrentlyParsing = false;
    isYoukuParsing = false; 
    currentYoukuUrl = ''; 

    if (selectedPlatform === 'https://www.youku.com') {
        youkuCustomPage.style.display = 'flex';
        window.voidAPI.setViewVisibility(false);
        urlInput.value = '';
    } else {
        youkuCustomPage.style.display = 'none';
        loadingOverlay.classList.remove('hidden');
        window.voidAPI.setViewVisibility(true); // Keep it visible but it will be covered by loader
        window.voidAPI.navigate(selectedPlatform, true);
    }
});

goButton.addEventListener('click', () => {
    let url = urlInput.value.trim();
    if (url) {
        isCurrentlyParsing = false;
        isYoukuParsing = false; 
        if (!url.startsWith('http')) url = 'https' + '://' + url;
        currentVideoUrl = url;
        loadingOverlay.classList.remove('hidden');
        window.voidAPI.navigate(url, false);
    }
});

urlInput.addEventListener('keydown', (e) => e.key === 'Enter' && goButton.click());

parseButton.addEventListener('click', () => {
    if (platformSelect.value === 'https://www.youku.com') {
        parseYoukuUrl();
    } else {
        isYoukuParsing = false; 
        isCurrentlyParsing = true;
        triggerParse();
    }
});

apiSelect.addEventListener('change', () => {
    if (platformSelect.value !== 'https://www.youku.com') {
        triggerParse();
    }
});

backButton.addEventListener('click', () => window.voidAPI.goBack());
forwardButton.addEventListener('click', () => window.voidAPI.goForward());

homeButton.addEventListener('click', () => {
    isCurrentlyParsing = false;
    isYoukuParsing = false;

    const isDramaMode = container.classList.contains('drama-mode');

    if (isDramaMode) {
        // In drama mode, go to the root of the current site
        try {
            const currentUrl = new URL(urlInput.value);
            const rootUrl = `${currentUrl.protocol}//${currentUrl.hostname}`;
            loadingOverlay.classList.remove('hidden');
            window.voidAPI.navigate(rootUrl, false);
        } catch (error) {
            // If the URL is invalid, do nothing or provide feedback
            console.error("Invalid URL in address bar:", urlInput.value);
        }
    } else {
        // In normal mode, use the platform dropdown
        const homeUrl = platformSelect.value;
        if (homeUrl === 'https://www.youku.com') {
            youkuCustomPage.style.display = 'flex';
            window.voidAPI.setViewVisibility(false);
            urlInput.value = '';
        } else {
            loadingOverlay.classList.remove('hidden');
            window.voidAPI.navigate(homeUrl, true);
        }
    }
});

minimizeButton.addEventListener('click', () => window.voidAPI.minimizeWindow());
maximizeButton.addEventListener('click', () => window.voidAPI.maximizeWindow());
closeButton.addEventListener('click', () => window.voidAPI.closeWindow());

window.voidAPI.onUrlUpdate((url) => {
    // The main process now controls visibility on theme-switches, so this is removed.
    if (isYoukuParsing) {
        urlInput.value = currentYoukuUrl;
        return;
    }

    const isApiUrl = apiList.some(api => url.startsWith(api.value));
    if (isApiUrl) {
        urlInput.value = currentVideoUrl;
    } else {
        const oldVideoUrl = currentVideoUrl;
        urlInput.value = url;
        currentVideoUrl = url;
        if (isCurrentlyParsing && oldVideoUrl !== currentVideoUrl) {
            triggerParse();
        }
    }
});

window.voidAPI.onNavStateUpdate(({ canGoBack, canGoForward }) => {
  backButton.disabled = !canGoBack;
  forwardButton.disabled = !canGoForward;
});

// Listen for the main process to signal that loading is finished
window.voidAPI.onLoadFinished(() => {
    loadingOverlay.classList.add('hidden');
});

function initialize() {
    if (platforms.length > 0) {
        loadingOverlay.classList.remove('hidden');
        window.voidAPI.navigate(platforms[0].value, true);
    }
}
initialize();

const dramaModeButton = document.getElementById('drama-mode-button');
const netflixFactoryButton = document.getElementById('netflix-factory-button');
const dramaTheme = document.getElementById('drama-theme');
const container = document.querySelector('.container');
const controlsWrapper = document.querySelector('.controls-wrapper');
const dramaControls = document.querySelector('.drama-controls');
const usageTips = document.querySelector('.usage-tips');
const dramaUsageTips = document.querySelector('.drama-usage-tips');

// Set initial state for drama controls
dramaControls.style.display = 'none';
dramaUsageTips.style.display = 'none';

// Helper function to update the DOM for theme changes
function updateDOMForTheme(isSwitchingToDrama) {
    if (isSwitchingToDrama) {
        dramaModeButton.textContent = '国内解析';
        dramaTheme.disabled = false;
        container.classList.add('drama-mode');
        controlsWrapper.style.display = 'none';
        usageTips.style.display = 'none';
        dramaControls.style.display = 'block';
        dramaUsageTips.style.display = 'block';
        youkuCustomPage.style.display = 'none'; // Ensure youku page is hidden
    } else {
        dramaModeButton.textContent = '美韩日剧';
        dramaTheme.disabled = true;
        container.classList.remove('drama-mode');
        controlsWrapper.style.display = 'block';
        usageTips.style.display = 'block';
        dramaControls.style.display = 'none';
        dramaUsageTips.style.display = 'none';
    }
}

// Helper function to handle navigation and loading indicators
function navigateForTheme(isSwitchingToDrama) {
    window.voidAPI.setViewVisibility(false); // Hide view immediately to prevent flashing
    loadingOverlay.classList.remove('hidden'); // Show loader

    if (isSwitchingToDrama) {
        window.voidAPI.navigate('https://www.netflixgc.com/', false, {
            '--primary-bg': '#000000',
            '--accent-color': '#333333',
            '--highlight-color': '#C0FAA0'
        });
    } else {
        const homeUrl = platformSelect.value;
        if (homeUrl === 'https://www.youku.com') {
            youkuCustomPage.style.display = 'flex';
            loadingOverlay.classList.add('hidden'); // No loading for youku page
        } else {
            window.voidAPI.navigate(homeUrl, true, {
                '--primary-bg': '#1e1e2f',
                '--accent-color': '#3a3d5b',
                '--highlight-color': '#ff6768'
            });
        }
    }
}

dramaModeButton.addEventListener('click', (event) => {
    const isCurrentlyDrama = container.classList.contains('drama-mode');
    const isSwitchingToDrama = !isCurrentlyDrama;

    // Handle navigation and visibility first
    navigateForTheme(isSwitchingToDrama);

    // Check for View Transitions support to animate the theme change
    if (!document.startViewTransition) {
        updateDOMForTheme(isSwitchingToDrama);
        return;
    }

    // Get click coordinates for the reveal animation
    const x = event.clientX;
    const y = event.clientY;
    const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
    );

    const transition = document.startViewTransition(() => {
        updateDOMForTheme(isSwitchingToDrama);
    });

    // Customize the animation
    transition.ready.then(() => {
        document.documentElement.animate(
            {
                clipPath: [
                    `circle(0 at ${x}px ${y}px)`,
                    `circle(${endRadius}px at ${x}px ${y}px)`,
                ],
            },
            {
                duration: 600,
                easing: 'ease-in-out',
                pseudoElement: '::view-transition-new(root)',
            }
        );
    });
});

netflixFactoryButton.addEventListener('click', () => {
    loadingOverlay.classList.remove('hidden');
    window.voidAPI.navigate('https://www.netflixgc.com/', false);
});

// --- External Link Handler ---
document.addEventListener('DOMContentLoaded', () => {
    const externalLink = document.querySelector('.footer a');
    if (externalLink) {
        externalLink.addEventListener('click', (event) => {
            event.preventDefault(); // Prevent the default navigation
            const url = event.currentTarget.href;
            window.voidAPI.openExternalLink(url);
        });
    }
});

const sevenMovieButton = document.getElementById('7-movie-button');
const kanpianButton = document.getElementById('kanpian-button');
const gazfButton = document.getElementById('gazf-button');

sevenMovieButton.addEventListener('click', () => {
    loadingOverlay.classList.remove('hidden');
    window.voidAPI.navigate('https://www.7.movie/', false);
});

kanpianButton.addEventListener('click', () => {
    loadingOverlay.classList.remove('hidden');
    window.voidAPI.navigate('https://kunzejiaoyu.net/', false);
});

gazfButton.addEventListener('click', () => {
    loadingOverlay.classList.remove('hidden');
    window.voidAPI.navigate('https://gaze.run/', false);
});
