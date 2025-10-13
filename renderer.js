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

        window.voidAPI.navigate(finalUrl, false);

        youkuCustomPage.style.display = 'none';
        window.voidAPI.setViewVisibility(true);
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
        urlInput.value = ''; // **[FIX]** 切换到优酷模式时清空地址栏
    } else {
        youkuCustomPage.style.display = 'none';
        window.voidAPI.setViewVisibility(true);
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
    const homeUrl = platformSelect.value;
    if (homeUrl === 'https://www.youku.com') {
        youkuCustomPage.style.display = 'flex';
        window.voidAPI.setViewVisibility(false);
        urlInput.value = ''; // **[FIX]** 点击首页返回优酷模式时也清空地址栏
    } else {
        window.voidAPI.navigate(homeUrl, true);
    }
});

minimizeButton.addEventListener('click', () => window.voidAPI.minimizeWindow());
maximizeButton.addEventListener('click', () => window.voidAPI.maximizeWindow());
closeButton.addEventListener('click', () => window.voidAPI.closeWindow());

window.voidAPI.onUrlUpdate((url) => {
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

function initialize() {
    if (platforms.length > 0) {
        window.voidAPI.navigate(platforms[0].value, true);
    }
}
initialize();
