# 🎬 AudioVisual

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.7-blue.svg?style=for-the-badge&logo=semantic-release)
![License](https://img.shields.io/badge/license-UNLICENSED-red.svg?style=for-the-badge)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg?style=for-the-badge)
![Electron](https://img.shields.io/badge/Electron-33+-47848F.svg?style=for-the-badge&logo=electron)

**🔑 解锁所有媒体流的钥匙**

*一个功能强大的视频解析工具，支持多平台视频网站*

</div>

---

## ⚠️ 重要声明

> **本项目仅供学习交流使用，严禁用于任何商业用途。**  
> 对于因使用本项目而产生的任何法律纠纷或责任，本人概不负责。

---

## ✨ 功能特性

- 🎯 **多平台支持** - 支持腾讯视频、爱奇艺、优酷、哔哩哔哩、芒果TV等主流视频平台
- 🔧 **多解析接口** - 内置多个高质量解析接口，确保解析成功率
- 🎨 **现代化界面** - 简洁美观的用户界面，支持主题切换
- 🚀 **自动更新** - 内置自动更新功能，始终保持最新版本
- 💻 **跨平台** - 基于Electron开发，支持Windows、macOS、Linux
- 🛡️ **安全可靠** - 本地运行，保护用户隐私

---

## 🚀 快速开始

### 📋 系统要求

- **Node.js** >= 16.0.0
- **npm** >= 8.0.0
- **操作系统**: Windows 10+, macOS 10.14+, Ubuntu 18.04+


### 📦 安装步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/RemotePinee/AudioVisual.git
   ```

2. **进入目录**
   ```bash
   cd AudioVisual
   ```

3. **安装依赖**
   ```bash
   npm install
   ```

4. **启动应用**
   ```bash
   npm start
   ```

---

## 📖 使用指南

### 🎮 基本操作

1. **选择平台** - 从下拉菜单中选择目标视频平台
2. **点击视频** - 在平台中选择任意视频
3. **选择解析器** - 在左侧选择一个解析接口
4. **开始解析** - 点击 **Parse!** 按钮进行注入解析

### 🎭 美韩日剧模式

- **互联网资源** - 美韩日剧模式下均是互联网搜集来的网站资源
- **直接搜索** - 可以直接搜索剧名进行播放
- **无需解析** - 该模式下无需额外的解析步骤，直接播放

### 🔄 自动更新

- 应用需要手动点击 **检查更新** 按钮来检查更新
- 发现新版本时会提示用户选择是否下载
- 支持后台下载和进度显示
- 下载完成后提示用户安装更新

---

## 🛠️ 开发相关

### 📁 项目结构

```
AudioVisual/
├── 📁 assets/           # 静态资源
│   ├── 📁 css/         # 样式文件
│   ├── 📁 fonts/       # 字体文件
│   ├── 📁 images/      # 图片资源
│   └── 📁 js/          # JavaScript文件
├── 📄 main.js          # 主进程文件
├── 📄 index.html       # 主页面
├── 📄 package.json     # 项目配置
└── 📄 README.md        # 项目文档
```

### 🔧 开发命令

```bash
# 安装依赖
npm install

# 开发模式启动
npm start

# 构建应用
npm run dist
```

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📝 更新日志

### v1.0.7 (最新)
- 🔧 升级Electron到v33.0.0，支持最新Windows 25H2系统
- 🛠️ 更新electron-builder到v25.1.8，提升构建稳定性
- 🐛 修复Windows应用在新版本系统上无法运行的问题
- 🍎 优化macOS构建配置，支持Intel和Apple Silicon双架构
- ⚡ 改进构建流程，提升应用兼容性和性能

### v1.0.6
- 🐛 修复爱奇艺解析失败问题
- 🐛 修复芒果解析失败问题
- 🔧 优化解析逻辑，提升解析成功率
- ✨ 新增自动识别解析功能

### v1.0.5
- 🐛 修复窗口最小化后网站内容消失的问题
- 🔧 优化窗口恢复逻辑，提升用户体验
- 📦 更新构建配置，支持所有平台使用512x512图标

### v1.0.4
- ✨ 优化操作逻辑，提升用户体验
- 🚀 添加缓存机制，提高应用性能
- 🔧 修复更新通道，确保更新功能正常
- 🐛 修复优酷点击不显示解析页面的问题
- 💄 改进用户界面体验

### v1.0.3
- 🔧 修复IPC通信问题
- 📱 增加窗口高度
- 🎨 调整通知位置





## ☕ 赞赏支持

如果这个项目对你有帮助，可以请我喝杯咖啡！

<div align="center">
  <img src="assets/images/zf.jpg" alt="赞赏码" width="300" style="border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);"/>
  
  *扫码支持开发者* ❤️
</div>

---

## 📄 许可证

本项目采用 UNLICENSED 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

---

<div align="center">

**⭐ 如果觉得项目不错，请给个Star支持一下！**

Made with ❤️ by [RemotePinee](https://github.com/RemotePinee)

</div>