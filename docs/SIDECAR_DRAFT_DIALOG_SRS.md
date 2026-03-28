# Sidecar 草稿 Dialog 需求規格書 (SRS)

## 1. 文件目的

本文件定義 sidecar 草稿 dialog 的目前需求基準，作為 `#32` 的正式規格依據，涵蓋 metadata、字幕與影片處理三個分頁的版面結構、既有行為與驗收方向。

## 2. 適用範圍

本規格適用於：

- `Header.vue` 開啟的 `InfoJsonDialog.vue`
- metadata / subtitles / video 三個分頁
- metadata 分頁的 `info.json` 下載流程
- 已載入影片資訊帶入 dialog 表單的行為

本規格不涵蓋：

- `info.json` 遠端載入失敗時播放器本體的 fallback 顯示
- 後端影片處理請求資料結構重設計
- 可關閉、可拖曳或可新增的瀏覽器分頁互動

## 3. 功能需求

### FR-DIALOG-1 開啟入口與分頁結構

使用者可從 Header action button 開啟 sidecar 草稿 dialog。

dialog 需包含三個分頁：

- 影片資訊
- 字幕資訊
- 影片處理

分頁列採用瀏覽器式 tab strip 視覺，active tab 需有清楚的前景層次。

### FR-DIALOG-2 目前影片資訊預填

若目前播放器已載入影片資訊，開啟 dialog 時，metadata 分頁表單需以目前影片資訊作為初始值。

預填範圍包含：

- `title`
- `uploader`
- `id`
- `channelId`
- `uploadDate`
- `description`
- `tags`

若使用者已開始編輯且表單不再 pristine，後續外部影片資訊變更不應覆寫使用者正在編輯的內容。

### FR-DIALOG-3 Metadata 分頁

metadata 分頁提供使用者編輯 `info.json` 草稿所需的欄位。

目前保留欄位：

- 標題
- 上傳者
- 影片 ID
- 頻道 ID
- 上傳日期
- 描述
- 標籤

目前不提供 `categories` 編輯欄位。

metadata 分頁不顯示 `info.json` inline JSON 預覽，也不顯示重複標題或額外下載說明區塊；頁面只保留預填說明、欄位表單與單一 `下載 info.json` 按鈕作為輸出入口。

### FR-DIALOG-4 `info.json` 下載行為

當 metadata 表單已有可輸出的有效資料時，使用者可透過 `下載 info.json` 按鈕下載目前內容。

下載內容需符合既有 `info.json` 輸出契約，且：

- 空欄位不得寫入輸出 JSON
- metadata 分頁不再透過本表單輸出 `categories`

### FR-DIALOG-5 字幕分頁

字幕分頁保留本地字幕匯入與 `subtitles.json` 下載能力，但不顯示 inline JSON 預覽。

字幕分頁需符合以下結構：

- 以單一工作區整合字幕說明、local-only 提示、匯入 / 下載 / 清空動作與字幕清單
- 以單一上傳按鈕作為字幕匯入入口，不使用大面積 dropzone / uploader 卡片
- 顯示目前已匯入字幕清單
- 保留 `下載 subtitles.json` 按鈕

### FR-DIALOG-6 影片處理分頁

影片處理分頁不顯示任何 JSON 預覽或重複摘要卡。

影片處理分頁需符合以下結構：

- 僅保留來源影片脈絡與操作列，不重複渲染分頁標題
- 顯示已選影片檔案資訊或空狀態
- 保留解析度選擇區塊
- 保留 sidecar 附加設定區塊

### FR-DIALOG-7 既有能力穩定性

本題不改動以下既有能力：

- 字幕分頁生成與下載 `subtitles.json`
- 是否附加 `info.json` / `subtitles.json` 到影片處理設定的既有邏輯

## 4. 驗收條件

1. 開啟 dialog 時，若目前已有影片資訊，metadata 表單會自動帶入目前資料。
2. metadata 分頁不再顯示 `categories` 欄位。
3. metadata 分頁不再顯示 `info.json` JSON 預覽、重複標題或下載說明文字，只保留預填說明、表單與單一下載按鈕。
4. `下載 info.json` 按鈕在有有效資料時可正常輸出檔案。
5. 由 metadata 分頁產生的 `info.json` 不包含 `categories`。
6. 字幕分頁不再顯示 `subtitles.json` JSON 預覽，且 local-only 提示需以 inline metadata 呈現，而非獨立 banner。
7. 字幕匯入入口為單一按鈕，且不再使用佔滿寬度的 uploader 卡片。
8. 影片處理分頁不再顯示任何 JSON 預覽或重複摘要卡。
9. 內容區保留的每個容器都必須對應到明確的語意區塊、動作群組或狀態展示。
