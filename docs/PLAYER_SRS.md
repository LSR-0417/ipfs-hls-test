# 播放器需求規格書 (SRS)

## 1. 文件目的

本文件以目前程式實作為準，說明 IPFS HLS 播放器在播放互動層、播放器下方資訊區與 sidecar 資產載入上的既有行為，作為維護、測試與後續調整的依據。

目前版本的核心重點包含：

- `info.json` 驅動播放器下方標題與資訊卡內容
- 固定檔名 sidecar 資產載入：`cover.webp`、`info.json`、`avatar.jpg`
- `subtitles.json` 驅動字幕清單
- `VideoInfo` 的上傳者列、互動按鈕列與收合式說明卡
- 全域鍵盤快捷鍵：左右鍵 `±5` 秒、空白鍵播放 / 暫停

## 2. 適用範圍

本規格適用於前端播放器介面，範圍包含：

- `VideoPlayer` 元件的 HLS 載入與鍵盤互動
- `App.vue` 的播放 URL / gateway / sidecar 狀態管理
- 播放器下方的影片標題列
- `VideoInfo.vue` 的上傳者資訊、互動按鈕列與說明卡
- `info.json`、`subtitles.json`、`cover.webp`、`avatar.jpg` 的載入規則
- 說明文字的 linkify 與描述 `#tag` 摘要列

本規格不涵蓋：

- 音量快捷鍵
- 全螢幕快捷鍵
- 自動偵測其他副檔名的封面或頭像
- 字幕檔暴力掃描；目前只讀 `subtitles.json`

## 3. 功能需求

### FR-UI-1 固定檔名 sidecar 資產載入

當使用者載入某個影片 CID 時，前端會從與 `index.m3u8` 同層的目錄讀取以下固定檔名：

- `cover.webp` 作為播放器 poster
- `info.json` 作為影片 metadata
- `avatar.jpg` 作為上傳者頭像
- `subtitles.json` 作為字幕 manifest

這個硬編碼決策是配合目前 sidecar 腳本流程而來：

- `script/download_youtube_assets.sh` 會下載原始 `.info.json`、縮圖、字幕與 `channel_avatar.<ext>`
- `script/package_youtube_assets.sh` 會產出精簡版 `info.json`、複製 `cover.<ext>`、複製 `avatar.<ext>`
- `script/generate_subtitles_manifest.sh` 會產生 `subtitles.json`

也就是說，前端目前假設 sidecar 目錄會先經過既有腳本整理完成，因此選擇直接讀固定名稱，而不是在執行時掃描目錄內的所有候選檔案。

目前實作不會自動嘗試其他封面或頭像副檔名。

以目前腳本行為檢查，固定檔名契約的符合性如下：

- `info.json`：符合；由 `package_youtube_assets.sh` 穩定輸出
- `subtitles.json`：符合；由 `generate_subtitles_manifest.sh` 產出，且 `package_youtube_assets.sh` 會呼叫它
- `cover.webp`：部分符合；`package_youtube_assets.sh` 實際輸出 `cover.<ext>`，只有來源封面本來是 `.webp` 時才會剛好符合
- `avatar.jpg`：部分符合；`package_youtube_assets.sh` 實際輸出 `avatar.<ext>`，且只有存在獨立頭像檔時才會產出，若來源本來是 `.jpg` 才會剛好符合

fallback 規則如下：

- `info.json` 載入失敗時，標題列不顯示預設標題；下方資訊卡退回預設資訊，不阻斷播放
- `avatar.jpg` 載入失敗時，退回 identicon 頭像
- `cover.webp` 缺失時，不顯示 poster，但不阻斷播放
- `subtitles.json` 缺失時，不顯示字幕軌

> 註：`info.json` 失敗時「預設資訊」的具體欄位與文案目前刻意保留，待後續產品決策後再補進本文。
<!-- LLM note: The exact fallback/default info shown when info.json fails is intentionally left unspecified for now. Keep the doc at the behavior level (title row hidden, info card falls back) until the user finalizes the canonical default fields/text. -->

### FR-UI-2 標題位置

播放器下方第一個資訊區塊必須顯示影片標題，且標題內容優先來自 `info.json.title`。

- 不在該位置顯示泛用播放狀態訊息
- metadata 尚未就緒時，可暫時不顯示標題
- 標題與下方資訊卡共用同一份 `currentVideoInfo` 狀態

### FR-UI-3 上傳者與互動按鈕列布局

在標題下方，介面呈現一整列內容：

- 左側：頭像、上傳者名稱、次級說明與 `Follow` 按鈕
- 右側：按讚 / 倒讚按鈕群、`Share` 按鈕、`...` 溢出選單

次級說明的來源規則如下：

- 優先顯示 `channel_id`
- 若沒有 `channel_id`，則顯示 `categories.join(' • ')`
- 若仍沒有資料，則顯示預設文案 `Decentralized Network`

按鈕列的收合規則如下：

- `Like / Dislike` 按鈕群固定保留
- `Share` 是第一個會被擠進 overflow menu 的動作
- `Download` 不直接顯示在主列，預設常駐於 overflow menu
- overflow menu 的排序為動態收合項目優先，其後才是 `Download`
- 按鈕列在寬版時靠右對齊；若空間不足可換行到下一列

### FR-UI-4 說明卡片內容

上傳者資訊列下方保留獨立的說明卡片，用於顯示：

- 摘要列：相對上傳時間，若無法計算則退回格式化日期
- 摘要列右側：自 `description` 文字中擷取的前 `3` 個唯一 `#tag`
- 說明文字
- metadata grid
- tags 列表

目前 metadata grid 實際顯示的欄位為：

- `IPFS CID`
- `Video ID`
- `Uploader`
- `Channel ID`
- `Duration`
- `Frame Rate`

目前 `upload_date`、`resolution`、`categories` 不在 metadata grid 內；其中 `categories` 只會在上傳者列的次級說明中顯示。

描述與 tags 的 fallback 規則如下：

- `description` 缺失時，顯示預設說明文案
- `tags` 缺失時，展開區顯示預設 tags：`IPFS`、`Web3`、`Decentralized`
- 摘要列的 `#tag` 只從描述文字擷取，不讀 `info.json.tags`

### FR-UI-5 說明卡片收合與展開

若說明卡片存在可展開內容，例如長描述、多行描述、metadata grid 或 tags，卡片初始狀態預設收合。

收合狀態規則：

- 描述預覽最多 `3` 行
- 最後一行描述寬度會被量測並壓在卡片寬度約一半內
- 同一行尾端接上 `... 更多資訊`

展開狀態規則：

- 顯示完整描述
- 顯示 metadata grid
- 顯示 tags 列表
- 提供 `只顯示部分資訊` 以收回內容

### FR-UI-6 描述文字格式化

說明文字的格式化規則如下：

- 保留原始換行
- `http://`、`https://`、`www.` 會被轉為可點選連結
- 連結尾端的常見標點不會被算入連結範圍
- 摘要列 `#tag` 依描述中出現順序擷取，並做去重

### FR-KEY-1 左右鍵 seek

當播放器已初始化且頁面接收到鍵盤事件時：

- 按下 `ArrowLeft` 將播放時間倒退 `5` 秒
- 按下 `ArrowRight` 將播放時間前進 `5` 秒

### FR-KEY-2 空白鍵播放控制

當播放器已初始化且頁面接收到鍵盤事件時：

- 按下空白鍵會在播放與暫停之間切換
- 若播放器目前為暫停狀態，按下後開始播放
- 若播放器目前為播放狀態，按下後暫停播放

### FR-KEY-3 seek 邊界限制

播放器處理快捷鍵 seek 時，目標播放時間限制在合法範圍：

- 不得小於 `0`
- 若媒體總長度可取得，不得大於影片總長度

### FR-KEY-4 互動控制保護

當焦點位於以下元素或其互動子樹時，播放器不攔截左右鍵或空白鍵：

- `input`
- `textarea`
- `select`
- `button`
- `a[href]`
- `contenteditable`
- 具備 `button`、`slider`、`menuitem`、`textbox` 等 ARIA 角色的元素

### FR-KEY-5 修飾鍵與已攔截事件保護

當鍵盤事件符合任一條件時，播放器不處理播放快捷鍵：

- 事件已被其他邏輯 `preventDefault`
- 使用者同時按住 `Ctrl`
- 使用者同時按住 `Alt`
- 使用者同時按住 `Meta`

### FR-STATE-1 分享 URL 與 gateway 狀態分離

分享 URL 只攜帶：

- `cid`
- `t`

目前不會把 `gateway` 寫進 URL query；gateway 由 `localStorage` 持久化。

## 4. 驗收準則

- 載入 CID 時，前端會向同層路徑請求 `cover.webp`、`info.json`、`avatar.jpg`、`subtitles.json`
- 播放器下方第一行顯示影片標題，而不是播放狀態訊息
- 標題下方顯示上傳者資訊列；互動按鈕列位於同一橫列右側
- `Like / Dislike` 留在主列，`Download` 位於 overflow menu，`Share` 會先被收合
- 說明、metadata 與 tags 位於下一個獨立卡片，而不是與上傳者資訊共框
- 摘要列左側顯示相對上傳時間或格式化日期，右側顯示描述中擷取出的前 `3` 個 `#tag`
- 摘要列 `#tag` 過長時不會撐破卡片，需有截斷保護
- 說明卡片預設收合，並於同一行尾端顯示 `... 更多資訊`
- 點擊 `更多資訊` 後，展開完整描述、metadata grid 與 tags；卡片內出現 `只顯示部分資訊`
- 說明文字中的網址可點擊，段落換行被保留
- `avatar.jpg` 載入失敗時，介面退回 identicon 頭像
- `info.json` 載入失敗時，播放器仍可播放；標題列不顯示預設標題，下方資訊卡退回預設資訊
- `cover.webp` 缺失時，播放器仍可播放，但不顯示 poster
- 當目前播放時間為 `10` 秒且焦點不在互動控制項內，按下 `ArrowRight` 後播放時間變為 `15` 秒
- 當目前播放時間為 `3` 秒且焦點不在互動控制項內，按下 `ArrowLeft` 後播放時間變為 `0` 秒
- 當播放器為暫停狀態且焦點不在互動控制項內，按下空白鍵後播放器開始播放
- 當播放器為播放狀態且焦點不在互動控制項內，按下空白鍵後播放器暫停播放
- 當焦點在搜尋輸入框或其他可編輯區域時，左右鍵與空白鍵不得接手播放器控制

## 5. 對應測試

目前相關行為至少由以下測試覆蓋：

- `src/utils/videoInfo.spec.js`
  - `info.json` 欄位正規化
  - `upload_date` 格式化與相對時間
  - 描述網址 linkify
  - 描述 `#tag` 擷取與去重
- `src/utils/subtitles.spec.js`
  - `subtitles.json` 讀取與字幕軌組裝
- `script/package_youtube_assets.spec.js`
  - `info.json`、`subtitles.json`、`cover.webp`、`avatar.jpg` 的 sidecar 整理流程
  - 無獨立頭像時不會誤產生 `avatar.*`
- `script/generate_subtitles_manifest.spec.js`
  - `subtitles.json` 生成
  - 無字幕時的空 manifest 行為
- `src/components/video_layout.spec.js`
  - 標題列與 `VideoInfo` 的版面順序
  - 上傳者列 / 動作列佈局契約
  - 描述卡片、overflow menu、收合 / 展開入口
- `src/utils/playback.spec.js`
  - 空白鍵播放 / 暫停切換
  - 左右鍵 `±5` 秒 seek
  - seek 邊界 clamp
  - 互動元素忽略規則
  - 修飾鍵 / 已攔截事件忽略規則
