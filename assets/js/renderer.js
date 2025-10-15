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

let currentVideoUrl = '';
let isCurrentlyParsing = false;
let currentYoukuUrl = '';

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
        currentYoukuUrl = youkuVideoUrl;
        const selectedApiUrl = apiSelect.value;
        const finalUrl = selectedApiUrl + youkuVideoUrl;
        urlInput.value = currentYoukuUrl;
        loadingOverlay.classList.remove('hidden');
        window.voidAPI.navigate(finalUrl, false);
        youkuCustomPage.style.display = 'none';
    } else {
        alert('请输入有效的优酷视频链接。');
    }
}

function navigateTo(url, isPlatformSwitch = false, themeVars = null) {
    loadingOverlay.classList.remove('hidden');
    window.voidAPI.navigate(url, isPlatformSwitch, themeVars);
}

populateSelect(platformSelect, platforms);
populateSelect(apiSelect, apiList);

platformSelect.addEventListener('change', (event) => {
    const selectedPlatform = event.target.value;
    isCurrentlyParsing = false;
    currentYoukuUrl = '';
    if (selectedPlatform === 'https://www.youku.com') {
        youkuCustomPage.style.display = 'flex';
        urlInput.value = '';
    } else {
        youkuCustomPage.style.display = 'none';
        navigateTo(selectedPlatform, true);
    }
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
    if (platformSelect.value === 'https://www.youku.com') {
        parseYoukuUrl();
    } else {
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
        urlInput.value = currentVideoUrl;
    } else {
        urlInput.value = url;
        currentVideoUrl = url;
    }
});

window.voidAPI.onNavStateUpdate(({ canGoBack, canGoForward }) => {
  backButton.disabled = !canGoBack;
  forwardButton.disabled = !canGoForward;
});

window.voidAPI.onLoadFinished(() => {
    loadingOverlay.classList.add('hidden');
});

function initialize() {
    if (platforms.length > 0) {
        navigateTo(platforms[0].value, true);
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

dramaControls.style.display = 'none';
dramaUsageTips.style.display = 'none';

function updateDOMForTheme(isSwitchingToDrama) {
    if (isSwitchingToDrama) {
        dramaModeButton.textContent = '国内解析';
        dramaTheme.disabled = false;
        container.classList.add('drama-mode');
        controlsWrapper.style.display = 'none';
        usageTips.style.display = 'none';
        dramaControls.style.display = 'block';
        dramaUsageTips.style.display = 'block';
        youkuCustomPage.style.display = 'none';
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

function navigateForTheme(isSwitchingToDrama) {
    const theme = isSwitchingToDrama ? {
        '--primary-bg': '#000000',
        '--accent-color': '#333333',
        '--highlight-color': '#C0FAA0'
    } : {
        '--primary-bg': '#1e1e2f',
        '--accent-color': '#3a3d5b',
        '--highlight-color': '#ff6768'
    };
    const url = isSwitchingToDrama ? 'https://www.netflixgc.com/' : platformSelect.value;
    
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

netflixFactoryButton.addEventListener('click', () => navigateTo('https://www.netflixgc.com/'));
document.getElementById('7-movie-button').addEventListener('click', () => navigateTo('https://www.7.movie/'));
document.getElementById('kanpian-button').addEventListener('click', () => navigateTo('https://kunzejiaoyu.net/'));
document.getElementById('gazf-button').addEventListener('click', () => navigateTo('https://gaze.run/'));

document.addEventListener('DOMContentLoaded', () => {
    const externalLink = document.querySelector('.footer a');
    if (externalLink) {
        externalLink.addEventListener('click', (event) => {
            event.preventDefault();
            window.voidAPI.openExternalLink(event.currentTarget.href);
        });
    }
});
