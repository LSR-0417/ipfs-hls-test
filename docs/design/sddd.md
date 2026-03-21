# 軟體設計說明書 (SDDD)

## 1. 系統簡介

本系統為「IPFS HLS 多網關播放器」，前端採 Vue 3 + Vite，整體介面延續深色玻璃風格與影音平台式資訊佈局。

本文以目前程式實作為準，描述目前實際存在的元件責任、狀態流與已知限制。

## 2. 核心架構與組件設計

### 2.1 App.vue

`App.vue` 是目前的全域狀態中心，負責：

- 維護 `currentCid`
- 維護 `currentGateway`
- 維護 `currentM3u8Url`、`currentIpfsBaseUrl`、`currentPosterUrl`
- 維護 `currentVideoInfo` 與 `currentSubtitleTracks`
- 同步分享 URL 中的 `cid` / `t`
- 讀寫 gateway 的 `localStorage`

播放器正下方標題列由 `App.vue` 直接渲染，資料來源是 `currentVideoInfo.title`。

### 2.2 Header.vue

`Header.vue` 目前整合兩個主要功能：

- CID 搜尋輸入
- Header action buttons
- Gateway Settings dialog

目前 gateway configurator 的實作重點如下：

- 內建公開 gateway：`dweb.link`、`ipfs.io`
- 自訂 gateway：只接受公開 `HTTPS` `/ipfs/` base URL
- `Local Node` 設定只在開發模式 (`import.meta.env.DEV`) 顯示
- 右上角 action buttons 目前採用統一系列設計，包含 `Gateway` 與 `Account`
- Gateway 按鈕會顯示目前 gateway 名稱與 probe 狀態 ring
- Dialog 內會顯示背景 probe 排名、`Recommended` 標記與 `Recheck Now`

目前 gateway 切換是立即套用模型，不是交易式切換：

- `Apply` 後 dialog 立即關閉
- `App.vue` 立即更新並持久化 gateway
- 若已有 CID，播放器立即開始重新載入來源
- 沒有額外的 switch overlay、rollback 或 retry UI

### 2.3 VideoPlayer.vue

`VideoPlayer.vue` 是 HLS 載入與播放互動核心，負責：

- 以 `video.js` 載入 `index.m3u8`
- 在來源切換時重設 player
- 在 `loadedmetadata` 後套用 `startTime`
- 在 `canplay` 後依 `shouldAutoplay` 嘗試續播
- 套用字幕軌與字幕偏好
- 在 `window` 上註冊全域鍵盤快捷鍵

鍵盤互動透過 `src/utils/playback.js` 實作，規則如下：

- `ArrowLeft`：`-5` 秒
- `ArrowRight`：`+5` 秒
- `Space`：播放 / 暫停切換
- 焦點在可編輯或互動元素時忽略
- 有 `Ctrl` / `Alt` / `Meta` 或已被 `preventDefault` 時忽略

目前 `VideoPlayer.vue` 對外只發出泛用的 `status-update`，不提供結構化的 gateway switch 生命週期事件。

### 2.4 VideoInfo.vue

`VideoInfo.vue` 目前以 `video-info` prop 消費 `App.vue` 持有的 metadata 狀態，並負責：

- 上傳者資訊列
- 右對齊動作列
- 收合式描述卡
- 分享與下載入口

目前實作細節如下：

- 上方標題不由 `VideoInfo.vue` 渲染，避免與 `App.vue` 分裂狀態
- 上傳者次級說明優先顯示 `channel_id`，其次才是 `categories`
- 動作列固定保留 `Like / Dislike`
- `Share` 會先被收進 overflow menu
- `Download` 永遠位於 overflow menu

說明卡的目前行為如下：

- 摘要列左側顯示相對上傳時間；無法計算時退回格式化日期
- 摘要列右側顯示從描述抽出的前 `3` 個唯一 `#tag`
- 卡片預設收合
- 收合描述透過量測控制為約 `3` 行，並在尾端接上 `... 更多資訊`
- 展開後顯示完整描述、metadata grid、tags 與 `只顯示部分資訊`

目前 metadata grid 實際顯示欄位為：

- `IPFS CID`
- `Video ID`
- `Uploader`
- `Channel ID`
- `Duration`
- `Frame Rate`

目前 `upload_date`、`resolution`、`categories` 不在 metadata grid 內。

### 2.5 Sidecar 資產契約

目前前端固定請求以下 sidecar 檔名：

- `index.m3u8`
- `info.json`
- `subtitles.json`
- `cover.webp`
- `avatar.jpg`

之所以採用這組硬編碼名稱，是因為目前 sidecar 生成流程已由腳本固定下來：

- `script/download_youtube_assets.sh` 下載原始 `.info.json`、縮圖、字幕與 `channel_avatar.<ext>`
- `script/package_youtube_assets.sh` 產出精簡版 `info.json`、複製 `cover.<ext>`、複製 `avatar.<ext>`
- `script/generate_subtitles_manifest.sh` 產生 `subtitles.json`

因此前端目前直接依固定檔名讀取 sidecar，不在執行時掃描所有候選檔名。

以目前腳本行為檢查：

- `info.json`、`subtitles.json` 屬於穩定符合
- `cover.webp`、`avatar.jpg` 只屬於部分符合，因為腳本實際保留來源副檔名，輸出 `cover.<ext>` 與 `avatar.<ext>`

fallback 規則：

- `info.json` 失敗：標題列不顯示預設標題；下方資訊卡退回預設資訊
- `subtitles.json` 失敗：不顯示字幕軌
- `cover.webp` 缺失：不顯示 poster
- `avatar.jpg` 失敗：退回 identicon

> 註：`info.json` 失敗時的「預設資訊」內容目前刻意不在設計文件中列死，待後續產品決策後再補。
<!-- LLM note: The exact fallback/default info payload for info.json failure is intentionally pending a later user decision. Preserve the current high-level behavior description only. -->

目前前端不會自動嘗試其他 `cover.*` / `avatar.*` 副檔名。

### 2.6 ControlPanel.vue

`ControlPanel.vue` 仍保留在 repo 中，但目前主畫面不再依賴它作為主要控制入口。Gateway 相關互動已集中到 `Header.vue` 與 `App.vue`。

## 3. UI / UX 方向

目前 UI 的主要結構為：

- `Header`
- `Sidebar`
- `Main Content`
  - `Primary Column`：`VideoPlayer` + `Player Title` + `VideoInfo`
  - `Secondary Column`：`VideoGrid`

風格延續深色玻璃質感與霓虹色 accent，但文件中的靜態 mockup 不應被視為逐像素的實作保證。

## 4. 狀態流與路由管理

### 4.1 URL

目前分享 URL 只同步：

- `cid`
- `t`

`gateway` 不會寫進 query string。

### 4.2 Gateway 儲存

目前 gateway 使用 `localStorage` 保存，並由 `App.vue` 在啟動時還原。

### 4.3 載入流程

當 `loadVideo(cid, gateway, startTime)` 被呼叫時：

1. `App.vue` 更新目前 CID 與 gateway
2. 重新推導 sidecar 路徑
3. 重設 `currentVideoInfo` 與 `currentSubtitleTracks`
4. 平行載入 `info.json` 與 `subtitles.json`
5. 將新來源交給 `VideoPlayer.vue`

### 4.4 Gateway 狀態探測

`Header.vue` 會依目前 `currentCid` 執行背景 probe，狀態來自：

- `src/utils/gateway.js`
- `src/utils/gatewayStatus.js`

目前 probe 結果用於：

- Header 按鈕狀態 ring
- Dialog 排序
- `Recommended` 標記

不會自動觸發 gateway 切換。

## 5. 測試設計對應

目前主要測試覆蓋如下：

- `src/utils/playback.spec.js`
  - 播放時間讀取
  - 快捷鍵映射
  - seek clamp
  - 互動元素忽略規則
- `src/utils/videoInfo.spec.js`
  - `info.json` 欄位正規化
  - 日期格式化
  - linkify
  - 描述 `#tag` 擷取
- `src/utils/subtitles.spec.js`
  - `subtitles.json` 讀取與字幕偏好
- `src/components/video_layout.spec.js`
  - 標題列 / `VideoInfo` 版面契約
  - 上傳者列與按鈕列布局
  - overflow menu
  - 描述卡收合 / 展開入口
- `src/utils/gateway.spec.js`
  - gateway URL 正規化
  - probe 狀態分類
  - 429 / redirect / degraded / ready 判斷
- `src/utils/gatewayStatus.spec.js`
  - probe state 對應文字文案

## 6. 已知限制

目前系統仍有以下限制：

- gateway 切換沒有交易式狀態機
- 沒有專屬切換 overlay、toast 或 rollback
- 封面與頭像仍依賴固定檔名 `cover.webp` / `avatar.jpg`，與 `cover.<ext>` / `avatar.<ext>` 的腳本輸出存在落差
- `VideoPlayer.vue` 沒有結構化切換事件
- 靜態 mockup 只代表視覺方向，不代表完整行為契約
