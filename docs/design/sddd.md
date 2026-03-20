# 軟體設計說明書 (SDDD) - 最終版 (V2)

## 1. 系統簡介
本系統為「IPFS HLS 多網關播放器」，主打高質感的 YouTube 風格介面 (Premium UI, Dark Glassmorphism Theme)。近期我們移除了獨立且突兀的控制面板，將操作行為完美融入符合現代影音平台的使用者旅程中，實現了直覺化與高度響應式的全端介面。

## 2. 核心架構與組件設計
專案採用 Vue 3 + Vite，搭配 Vanilla CSS 與 CSS 變數設計統一樣式系統，無額外依賴大型 UI 框架。

### 核心佈局 (App.vue)
- **Top Header**: 提供頂部導覽、全域 IPFS 搜尋框與 Gateway 設定入口。
- **Sidebar**: 提供導覽圖示 (Home, Explore 等)，手機版自動收縮或轉為底部導航。
- **Main Content Layout**: 
  - **Primary Column**: VideoPlayer (播放器) + Player Title + VideoInfo。
  - **Secondary Column**: VideoGrid (推薦影片列表)。

- **Player Title Row**: `App.vue` 維護 `currentVideoInfo`，在 `loadSidecarAssets()` 成功後直接以 `currentVideoInfo.title` 渲染播放器正下方標題列，取代舊的播放狀態文字列。

### 經過優化的關鍵元件
#### 2.1 Header.vue (整合搜尋與網關設定)
- **Search Bar**: 取代原有的 CID 輸入框，將輸入影片 CID (或未來擴展為關鍵字搜尋) 以及跳轉邏輯集中在 Header 之中。
- **Gateway Configurator**: 在 Header 的右側提供一顆有科技感的 `⚙ Gateway` 按鈕，點開後以 Glassmorphism 浮動視窗 (Dialog) 提供完整的網關 (IPFS Gateway) 選擇與 Local Node 自訂(Host, Port)功能。減少首頁的空間佔用。

#### 2.2 VideoPlayer.vue (播放核心與快捷鍵)
- **video.js 播放核心**: `VideoPlayer.vue` 仍作為 HLS 載入、字幕掛載、起始時間同步與播放器生命週期管理的核心元件。
- **全域鍵盤快捷鍵**: 元件在 `mounted` 時向 `window` 註冊 `keydown` handler，在 `beforeUnmount` 時解除註冊，避免播放器卸載後殘留事件監聽器。
- **播放快捷鍵策略**: 左右方向鍵分別對應 `-5` 秒與 `+5` 秒 seek；空白鍵則負責在播放與暫停之間切換。實作上統一透過 `src/utils/playback.js` 的 `applyPlaybackHotkey()` 進行動作判斷、時間計算與事件過濾。
- **互動衝突避免**: 當焦點位於 `input`、`textarea`、`select`、`button`、`contenteditable` 或 ARIA 互動控制項時，快捷鍵不應觸發，避免干擾搜尋框、設定視窗與播放器控制元件。
- **Seek 邊界控制**: `clampSeekTime()` 會保證 seek 結果不小於 `0`，且在媒體總長度可用時不超過 `duration`。
- **空白鍵事件消耗**: 當空白鍵確實被播放器接手時，需呼叫 `preventDefault()`，避免頁面捲動與播放器控制行為互相競爭。

#### 2.3 VideoInfo.vue (metadata 與互動資訊列)
- **Sidecar Metadata 所有權**: `App.vue` 會在載入影片時讀取 `info.json` 與字幕 manifest，將 metadata 保存於 `currentVideoInfo`、字幕軌保存於 `currentSubtitleTracks`；`VideoInfo.vue` 改以 `video-info` prop 消費這份狀態。頭像則仍由 `VideoInfo.vue` 透過 `avatar.jpg` 路徑渲染，失敗時退回 identicon。
- **標題責任拆分**: `VideoInfo.vue` 不再自行渲染最上方標題；播放器正下方標題列與描述卡片共用 `App.vue` 持有的 metadata 狀態，避免資訊不同步。
- **上傳者列 / 按鈕列**: 標題下方第一列為「左側上傳者資訊、右側互動按鈕」的雙欄結構。按鈕列使用 `margin-left: auto` 與 `justify-content: flex-end` 保持右對齊。
- **Description Card**: 說明、metadata grid 與 tags 置於下一層獨立玻璃卡片，與上傳者列分離，避免資訊區塊過度擁擠。
- **Description Summary Row**: 卡片頂部摘要列左側顯示相對上傳時間，右側顯示從描述文字抽出的前 `3` 個 `#tag`。這些 tag 為純文字樣式，不使用膠囊泡泡；過長時必須以省略號截斷，避免撐爆卡片寬度。
- **Description Collapse Pattern**: 說明卡片在有額外內容時預設收合。收合預覽最多 `3` 行，最後一行文字寬度會壓到卡片寬度一半內，並在同一行尾端接上 `... 更多資訊`。點擊後展開完整描述、metadata grid、tags，並在卡片內底部提供 `只顯示部分資訊`。
- **Description Linkify**: 說明文字保留原始換行，並將 `http://`、`https://`、`www.` 自動轉為可點選超連結。實作採文字片段渲染，不直接注入 HTML。
- **Share Icon (分享按鈕)**: 分享按鈕仍整合於 `VideoInfo` 的動作列。點擊時提供 `Copied!` 微互動，且分享 URL 僅承載 `cid` 與播放進度 `t` (`?cid=&t=`)。
- **Fallback 策略**: `avatar.jpg` 載入失敗時退回 identicon；`info.json` 不可用時退回預設文案，但不影響播放器與分享功能。

#### 2.4 ControlPanel.vue (棄用/降級)
- 原本負責全部參數的 `ControlPanel.vue` 已完成歷史任務。其 Gateway 切換邏輯被提取並融入到 `Header.vue` 或 `App.vue` 全域狀態管理。

## 3. UI/UX 與美學準則 (Aesthetics Guidelines)
- **Color Palette (深色主題)**: 
  - 背景 (`--bg-color`): `#090a10`
  - 霓虹紫 (`--accent-neon`): `#a252ff`
  - 水青色 (`--accent-cyan`): `#00d2ff`
- **Glassmorphism (玻璃質感)**: 
  - 統一使用 `rgba(20, 24, 42, 0.5)` 疊加背景並附帶 `blur(12px)` 的 backdrop-filter。
- **RWD (響應式設計)**: 
  - 針對手機版 (`max-width: 600px/768px`)，隱藏文字按鈕保留 Icon；網關面板自動撐滿版面避免超出邊界；Secondary Column 自動重排至影片下方展現出 Single-column 行動端體驗。

## 4. 狀態流與路由管理 (State & Routing)
- `cid` 與 `time` (`t`) 具備 **URL 雙向綁定能力** (`history.pushState`)，作為可分享、可重放的播放狀態。
- `gateway` 不再作為 URL Query Parameter，而是作為瀏覽器端偏好設定，持久化在 `localStorage`，供 `App.vue` 與 `Header.vue` 還原目前使用中的網關。
- 當 URL 載入給定 `?cid=...&t=...` 時，`App.vue` 會解析並派發狀態給子元件以觸發播放流程。
- `App.vue` 會將同一個 gateway + cid 推導出的 sidecar 路徑分派給各子元件：
  - `index.m3u8`
  - `cover.webp`
  - `info.json`
  - `avatar.jpg`

## 5. 測試設計對應
- 播放時間讀取、seek clamp 與鍵盤快捷鍵事件過濾邏輯集中於 `src/utils/playback.js`，以便使用 Vitest 進行純單元測試。
- 左右鍵 `±5` 秒 seek、空白鍵播放 / 暫停切換、輸入框忽略規則與 seek 邊界條件，皆需在 `src/utils/playback.spec.js` 內有明確案例。
- `src/utils/videoInfo.spec.js` 負責覆蓋 `info.json` 的欄位正規化、日期格式化、描述網址 linkify 與描述 `#tag` 擷取規則。
- `src/components/video_layout.spec.js` 以 SFC template / style regression 測試保護以下契約：
  - 播放器下方標題列由 `App.vue` 控制
  - `VideoInfo` 內部為「上傳者左、按鈕右」的同列布局
  - description / metadata 區塊位於獨立玻璃卡片中
  - 說明卡片的 `更多資訊` / `只顯示部分資訊` 互動入口存在於正確位置
  - 摘要列的描述 `#tag` 與長文字截斷樣式契約存在
