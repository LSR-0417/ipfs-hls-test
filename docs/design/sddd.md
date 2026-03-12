# 軟體設計說明書 (SDDD) - 最終版 (V2)

## 1. 系統簡介
本系統為「IPFS HLS 多網關播放器」，主打高質感的 YouTube 風格介面 (Premium UI, Dark Glassmorphism Theme)。近期我們移除了獨立且突兀的控制面板，將操作行為完美融入符合現代影音平台的使用者旅程中，實現了直覺化與高度響應式的全端介面。

## 2. 核心架構與組件設計
專案採用 Vue 3 + Vite，搭配 Vanilla CSS 與 CSS 變數設計統一樣式系統，無額外依賴大型 UI 框架。

### 核心佈局 (App.vue)
- **Top Header**: 提供頂部導覽、全域 IPFS 搜尋框與 Gateway 設定入口。
- **Sidebar**: 提供導覽圖示 (Home, Explore 等)，手機版自動收縮或轉為底部導航。
- **Main Content Layout**: 
  - **Primary Column**: VideoPlayer (播放器) + VideoInfo (影片資訊、社群互動按鈕)。
  - **Secondary Column**: VideoGrid (推薦影片列表)。

### 經過優化的關鍵元件
#### 2.1 Header.vue (整合搜尋與網關設定)
- **Search Bar**: 取代原有的 CID 輸入框，將輸入影片 CID (或未來擴展為關鍵字搜尋) 以及跳轉邏輯集中在 Header 之中。
- **Gateway Configurator**: 在 Header 的右側提供一顆有科技感的 `⚙ Gateway` 按鈕，點開後以 Glassmorphism 浮動視窗 (Dialog) 提供完整的網關 (IPFS Gateway) 選擇與 Local Node 自訂(Host, Port)功能。減少首頁的空間佔用。

#### 2.2 VideoInfo.vue (整合分享功能)
- 承載影片標題外，進一步加入了按讚、倒讚等虛擬按鈕以構築完整平台氛圍。
- **Share Icon (分享按鈕)**: 取代了過去龐大突兀的「複製目前播放連結」按鈕，現已整合進 `VideoInfo` 的動作列中 (`actions`)。點擊時提供 `Copied!` 切換文字與顏色的微互動 (Micro-animation)，整體邏輯乾淨簡潔。
- **CID / Gateway 參數傳遞**: `App.vue` 會在分享時將 Header 當前選中的 gateway 以及播放進度 time (`t`) 作為 Query Parameter (`?cid=&gateway=&t=`) 掛載至網址列。

#### 2.3 ControlPanel.vue (棄用/降級)
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
- 所有關鍵狀態 (CID, Gateway, Time) 皆具備 **URL 雙向綁定能力** (`history.pushState`)。
- 當 URL 載入給定 `?cid=...&t=...&gateway=...` 時，App.vue 負責解析並將狀態派發給子元件 (Header, VideoPlayer)，觸發播放流程。
