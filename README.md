# IPFS HLS 播放器

一個基於 Vue 3 + Vite 的 IPFS 多網關 HLS 視頻播放器。支援多質量自適應流媒體播放、字幕切換、時間分享等功能。

## 🎯 功能特性

- ✨ **IPFS 多網關支持** - 支援多個公開 IPFS 網關，自動容錯
- 🎬 **HLS 適應性碼率** - 動態切換視頻質量
- 📝 **多語言字幕** - 自動偵測並加載字幕文件
- 🔗 **分享功能** - 生成包含播放時間的分享連結
- 🎨 **現代化播放器 UI** - 基於 Plyr 播放器
- 📱 **響應式設計** - 支援各種裝置尺寸
- ⚡ **快速開發環境** - 基於 Vite 的高效開發體驗

## 📋 快速啟動

### 環境需求
- Node.js 16.x 或更高版本
- npm 或 yarn

### 安裝步驟

```bash
# 1. 克隆或下載項目
cd ipfs-hls-test

# 2. 安裝依賴
npm install

# 3. 啟動開發伺服器
npm run dev
```

開發伺服器將在 `http://localhost:5173` 啟動。

### 使用說明

1. **選擇網關** - 從下拉選單中選擇 IPFS 網關
2. **輸入 CID** - 輸入包含 `index.m3u8` 的 IPFS 文件夾 CID
3. **載入影片** - 點擊「▶️ 載入影片」按鈕
4. **分享片段** - 點擊「🔗 分享片段」複製包含目前播放時間的連結

**示例 CID 格式：** `QmXxxx...` 或 `bafy...`

## 📁 項目結構

```
ipfs-hls-test/
├── .agent/                          # 多角色協作框架
│   └── skills/
│       ├── frontend_architect/      # 架構師角色 (系統規劃、架構設計)
│       ├── ui_engineer/             # UI 工程師角色 (畫面切版、樣式)
│       ├── logic_engineer/          # 邏輯工程師角色 (API、狀態管理)
│       └── qa_engineer/             # QA 工程師角色 (測試、審查)
├── src/
│   ├── main.js                      # Vue 應用入口
│   ├── App.vue                      # 主應用元件
│   │   ├── 網關選擇
│   │   ├── CID 輸入
│   │   ├── 播放狀態管理
│   │   └── 字幕偵測
│   └── components/
│       └── VideoPlayer.vue          # 視頻播放器元件
│           ├── HLS.js 集成
│           ├── Plyr 播放器
│           ├── 質量切換
│           └── 字幕管理
├── index.html                       # HTML 入口
├── vite.config.js                   # Vite 配置
├── package.json                     # 項目配置與依賴
└── README.md                        # 本文件
```

## 🛠 技術棧

| 層級 | 技術 | 版本 |
|------|------|------|
| **框架** | Vue 3 | ^3.3.4 |
| **構建工具** | Vite | ^5.0.0 |
| **HLS 播放** | HLS.js | ^1.4.0 |
| **播放器 UI** | Plyr | ^3.7.2 |
| **開發伺服器** | Vite Dev Server | Built-in |

## 📚 核心組件 API

### App.vue 父元件

**狀態管理：**
```javascript
- cid: String              // 輸入的 IPFS CID
- gateway: String          // 選中的 IPFS 網關 URL
- currentM3u8Url: String   // 構建的 M3U8 播放 URL
- currentSubtitles: Array  // 偵測到的字幕列表
- currentStartTime: Number // 從 URL 參數讀取的開始時間
- status: String           // 當前操作狀態信息
```

**主要方法：**
```javascript
playVideo()              // 構建 M3U8 URL 並開始播放
shareCurrentTime()       // 複製包含播放時間的分享連結
onStatusUpdate(msg)      // 接收播放器狀態更新
onLevelsLoaded(levels)   // 接收視頻質量列表
```

### VideoPlayer.vue 子元件

**Props：**
```javascript
{
  m3u8Url: String,           // HLS 菜單文件 URL
  subtitles: Array,          // 字幕文件列表 [{ lang, src }]
  startTime: Number          // 起始播放時間 (秒)
}
```

**Events：**
```javascript
- status-update         // 播放狀態變化事件
- levels-loaded         // 視頻質量加載完成事件
```

## 🚀 構建與部署

### 構建生產版本

```bash
# 構建優化後的生產版本
npm run build

# 本地預覽生產版本
npm run preview
```

構建輸出將在 `dist/` 目錄下生成。

### 部署到靜態主機

生產版本可直接部署到任何靜態網站託管服務（如 Vercel、Netlify、GitHub Pages 等）。

## 📖 開發工作流程

本項目採用**多角色協作框架**，建議按以下流程進行開發：

### 1️⃣ 架構師 (Frontend-Architect)
- 規劃新功能的系統設計
- 分析需求並生成 `PLAN.md`
- 設計元件樹與資料流
- 拆解任務清單

*文檔位置：* [.agent/skills/frontend_architect/SKILL.md](.agent/skills/frontend_architect/SKILL.md)

### 2️⃣ UI 工程師 (UI-Engineer)
- 根據設計文檔實現 UI 元件
- 編寫樣式與互動效果
- 確保響應式與可訪問性

*文檔位置：* [.agent/skills/ui_engineer/SKILL.md](.agent/skills/ui_engineer/SKILL.md)

### 3️⃣ 邏輯工程師 (Logic-Engineer)
- 實現狀態管理與 API 層
- 連接播放器與 IPFS 網關
- 處理字幕加載與播放時間同步

*文檔位置：* [.agent/skills/logic_engineer/SKILL.md](.agent/skills/logic_engineer/SKILL.md)

### 4️⃣ QA 工程師 (QA-Engineer)
- 撰寫單元測試與整合測試
- 執行程式碼審查
- 性能監控與優化

*文檔位置：* [.agent/skills/qa_engineer/SKILL.md](.agent/skills/qa_engineer/SKILL.md)

## 🔧 IPFS 網關配置

默認支援以下公開網關：

```javascript
{
  label: "dweb.link (Cloudflare)",
  url: "https://dweb.link"
},
{
  label: "ipfs.io",
  url: "https://ipfs.io"
},
{
  label: "gateway.pinata.cloud",
  url: "https://gateway.pinata.cloud"
}
```

可在 `App.vue` 中的 `gateways` 數組修改或新增網關。

## 📝 資料格式

### M3U8 播放列表結構

預期的中 IPFS 文件夾結構：
```
QmXxxx.../
├── index.m3u8          # HLS 主播放列表
├── segment1.ts          # 視頻分片
├── segment2.ts
├── ...
├── zh-TW.vtt            # 繁體中文字幕 (可選)
├── en-US.vtt            # 英文字幕 (可選)
└── ja-JP.vtt            # 日文字幕 (可選)
```

### 分享連結格式

生成的分享連結格式：
```
http://localhost:5173/?cid=QmXxxx...&gateway=https://dweb.link&t=120
```

**參數說明：**
- `cid` - IPFS 文件夾 CID
- `gateway` - 網關 URL (可選)
- `t` - 開始播放時間 (秒)

## ⚠️ 常見問題

### Q: 為什麼視頻無法播放？

**可能原因：**
1. CID 不正確或資料夾不存在
2. `index.m3u8` 文件不在指定 CID 下
3. 選中的網關無法訪問該 CID
4. 跨域(CORS)限制

**解決方案：**
- 確認 CID 格式正確
- 驗證 IPFS 文件夾結構
- 嘗試更換網關
- 檢查瀏覽器控制台的跨域錯誤信息

### Q: 字幕為什麼未顯示？

**可能原因：**
1. 字幕文件命名不符合規範
2. 字幕編碼問題
3. Plyr 播放器未正確加載字幕

**解決方案：**
- 確保字幕文件名格式：`{language-code}.vtt`（如 `zh-TW.vtt`）
- 使用 UTF-8 編碼的 WebVTT 格式
- 檢查瀏覽器開發者工具的網絡標籤

### Q: 如何支援本地 IPFS 節點？

添加本地節點到 `App.vue` 的網關列表：
```javascript
{
  label: "本地節點",
  url: "http://localhost:8080"  // 默認 IPFS HTTP 網關端口
}
```

## 🔐 安全性考慮

- 使用 CORS 安全的 HTTP 網關
- 驗證用戶輸入的 CID 格式
- 避免在瀏覽器中暴露敏感的網關 API 密鑰
- 定期更新依賴以修補安全漏洞

## 📈 性能最佳化

- HLS 自適應碼率選擇最合適的質量
- 瀏覽器緩存 M3U8 播放列表
- 使用 CDN 網關加速內容分發
- 分片傳輸減少單個請求大小

## 🤝 貢獻指南

1. Fork 本宣傳庫
2. 新建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 按角色框架進行開發（見上方工作流程）
4. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
5. 推送到分支 (`git push origin feature/AmazingFeature`)
6. 開啟 Pull Request

## 📄 許可證

本項目採用 MIT 許可證。詳見 [LICENSE](LICENSE) 文件。

## 📞 支持與反饋

如有問題或建議，歡迎通過以下方式聯繫：
- 提交 Issue
- 發起 Pull Request
- 查閱相關文檔

## 🗂️ 相關資源

- [Vue 3 官方文檔](https://vuejs.org/)
- [Vite 文檔](https://vitejs.dev/)
- [HLS.js 文檔](https://github.com/video-dev/hls.js)
- [Plyr 文檔](https://plyr.io/)
- [IPFS 文檔](https://docs.ipfs.io/)
- [WebVTT 格式規範](https://www.w3.org/TR/webvtt1/)
