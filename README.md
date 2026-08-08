# 倾听音乐

<p align="center">
  <img width="100" alt="倾听音乐 icon" src="public/favicon.svg">
</p>
<p align="center"><strong>倾听音乐</strong></p>

<p align="center">
  基于 <a href="https://music-api.gdstudio.xyz/api.php">GD Studio's API</a> 的多音源聚合音乐播放器
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-7.x-646CFF?logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/Capacitor-8-119EFF?logo=capacitor&logoColor=white" />
</p>

<p align="center">
  <img src="https://github.com/user-attachments/assets/a20b5785-c4b3-4f44-86d9-f07350caf873" width="45%" />
  <img src="https://github.com/user-attachments/assets/475cb456-ed0f-40e9-829d-a746dffd2688" width="45%" />
</p>

## 核心功能

- **多音源聚合与回退**：支持多源检索与播放失败回退（本地下载/缓存/直连/代理/下一首）。
- **智能音源自动匹配**：可自动切换到可用免费音源，并同步队列/歌单/喜欢状态。
- **歌单广场与播客**：支持网易云歌单、我的歌单、RSS 播客订阅以及 Alist 站点配置。
- **歌单管理增强**：支持搜索、去重、导出、封面设置、URL 添加歌曲，支持主流音乐平台的歌单导入。
- **下载管理**: 支持选择下载音质、下载目录、是否嵌入歌词或封面
- **播放生态**：支持播放列表、最近播放、个人歌单、歌词显示、音质选择、倍速调节、睡眠定时、主题切换与数据同步配置。
- **移动端体验完整**：支持 PWA 安装、Android 打包与 Media Session 集成，网页端也能接近原生体验。

> 数据同步功能：通过管理员手动分配的 `SYNC_KEY` 接入。存储基于 Cloudflare KV（上限 25 MB），单用户理论可稳定同步 5 万首歌曲

## 音源支持

```
