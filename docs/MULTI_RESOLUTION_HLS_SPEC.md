# Multi-Resolution HLS Script 規格書

## 1. 文件目的

本文件定義 [`script/multi_resolution_hls.sh`](/Users/iskku/Project/ipfs-hls-test/script/multi_resolution_hls.sh) 的功能規格、輸入輸出契約、錯誤處理、相依條件與已知限制，作為維護、重構與後續擴充的依據。

本規格描述的是目前腳本已實作的行為，以及少量由現有程式可直接推導出的隱含契約。

此腳本的產品目的，是讓使用者能以單次 `ffmpeg` 執行，將單一來源影片快速轉成多個解析度版本，並直接得到 HLS 可用的輸出結構。

## 2. 適用範圍

此腳本的責任為：

- 接收單一影片檔案作為輸入。
- 根據來源影片高度，自動決定要輸出的 HLS 畫質層級。
- 以單次轉碼流程同時產生多個解析度版本，而非逐個解析度分開執行。
- 產生 HLS master playlist 與各畫質 variant playlist。
- 輸出 `.ts` 分段檔案與對應的目錄結構。
- 將 FFmpeg 預設產生的暫時 playlist 檔名改為專案慣用命名。

此腳本不負責：

- 上傳輸出內容到 IPFS。
- 產生或搬移字幕檔。
- 驗證輸出播放清單是否可於特定播放器成功播放。
- 處理批次影片佇列。
- 提供跨平台相容抽象。

補充說明：

- 本腳本所謂的「拆分成不同解析度檔案」，在技術上屬於多解析度轉碼輸出，不是單純的檔案切割。

## 3. 名詞定義

- `輸入影片`：使用者傳入的單一媒體檔案。
- `BASENAME`：輸入檔案去除副檔名後的完整路徑字串。
- `master playlist`：輸出目錄根層的 `index.m3u8`。
- `variant playlist`：各畫質子目錄中的播放清單檔。
- `畫質層級`：`4k`、`2k`、`1080p`、`720p`、`480p`、`orig` 其中之一。

## 4. 執行環境需求

### 4.1 系統工具

執行環境必須提供：

- `bash`
- `ffmpeg`
- `ffprobe`
- `sed`
- `mkdir`
- `mv`

### 4.2 平台假設

目前腳本依賴 `sed -i ''` 原地修改語法，因此實際目標平台為：

- macOS
- 其他採用 BSD `sed` 介面的環境

Linux 並非目前保證相容的平台。

## 5. 使用介面

### 5.1 指令格式

```bash
./script/multi_resolution_hls.sh <input_video_path>
```

### 5.2 參數規格

僅接受一個必要參數：

- `<input_video_path>`：影片檔案路徑，可為相對路徑或絕對路徑。

### 5.3 非目標介面

目前不支援：

- 多檔輸入
- 命名參數
- 自訂輸出目錄
- 自訂 HLS segment 長度
- 自訂編碼器
- 自訂 bitrate profile

## 6. 功能需求

### 6.1 啟動前檢查

腳本啟動時必須先檢查 `ffmpeg` 是否存在於 `PATH` 中。

若不存在，腳本必須：

- 輸出錯誤訊息。
- 提示 macOS 使用者可透過 Homebrew 安裝。
- 以非零狀態碼結束。

### 6.2 輸入驗證

若未提供第一個參數，腳本必須：

- 輸出錯誤訊息。
- 顯示基本用法範例。
- 以非零狀態碼結束。

目前腳本不會在轉檔前主動驗證以下條件：

- 檔案是否存在
- 檔案是否可讀
- 是否具有音軌
- `ffprobe` 是否存在

這些條件若不成立，會在後續步驟中失敗。

### 6.3 來源影片分析

腳本必須使用 `ffprobe` 讀取第一條影像軌的高度：

- stream selector：`v:0`
- metadata：`height`

若無法取得高度，腳本必須：

- 輸出錯誤訊息。
- 以非零狀態碼結束。

### 6.4 畫質層級決策

腳本必須依來源高度決定要輸出的畫質層級，規則如下：

| 條件 | 新增層級 | 高度 | 目標 bitrate | maxrate | bufsize |
|------|----------|------|---------------|---------|---------|
| `HEIGHT >= 2160` | `4k` | `2160` | `15000k` | `16000k` | `30000k` |
| `HEIGHT >= 1440` | `2k` | `1440` | `8000k` | `8600k` | `16000k` |
| `HEIGHT >= 1080` | `1080p` | `1080` | `5000k` | `5300k` | `10000k` |
| `HEIGHT >= 720` | `720p` | `720` | `2800k` | `3000k` | `5600k` |
| `HEIGHT >= 480` | `480p` | `480` | `1400k` | `1500k` | `2800k` |

若來源高度低於 `480`，腳本必須輸出單一保底層級：

| 條件 | 新增層級 | 高度 | 目標 bitrate | maxrate | bufsize |
|------|----------|------|---------------|---------|---------|
| `HEIGHT < 480` | `orig` | 原始高度 | `1000k` | `1000k` | `2000k` |

### 6.5 輸出目錄建立

腳本必須以 `BASENAME` 作為輸出根目錄名稱。

例如：

- 輸入：`/video/demo.mp4`
- 輸出根目錄：`/video/demo`

每一個選定的畫質層級都必須建立對應子資料夾：

- `/video/demo/4k`
- `/video/demo/2k`
- `/video/demo/1080p`
- `/video/demo/720p`
- `/video/demo/480p`
- `/video/demo/orig`

實際建立哪些子資料夾，取決於解析度決策結果。

### 6.6 FFmpeg 轉檔行為

腳本必須使用單次 FFmpeg 執行完成所有 variant 輸出，具備以下固定條件：

- video codec：`libx264`
- audio codec：`aac`
- output format：`hls`
- HLS segment duration：`5` 秒
- playlist type：`vod`
- master playlist name：`index.m3u8`
- segment filename pattern：`${BASENAME}/%v/segment_%03d.ts`
- variant playlist temporary pattern：`${BASENAME}/%v/temp.m3u8`

`%v` 對應的實際子資料夾名稱，必須由 `var_stream_map` 中的 `name` 屬性決定。

### 6.7 Playlist 重新命名

FFmpeg 執行完成後，腳本必須遍歷輸出根目錄下的各畫質子資料夾。

若發現：

- `${variant_dir}/temp.m3u8`

則必須重新命名為：

- `${variant_dir}/streaminglist-{folder_name}.m3u8`

其中 `{folder_name}` 為子資料夾名稱，例如：

- `1080p/temp.m3u8` -> `1080p/streaminglist-1080p.m3u8`
- `720p/temp.m3u8` -> `720p/streaminglist-720p.m3u8`

### 6.8 Master Playlist 路徑修正

每當 variant playlist 重新命名後，腳本必須同步更新 root `index.m3u8` 中的對應路徑：

- 將 `{folder_name}/temp.m3u8`
- 替換為 `{folder_name}/streaminglist-{folder_name}.m3u8`

此替換必須保留原本的資料夾名稱配對，不能把所有 variant entry 一律替換成同一個檔名。

這項修正是必要條件，否則 master playlist 會保留錯誤引用，或出現資料夾名稱與實際 variant playlist 檔名不一致的問題。

### 6.9 Segment 檔名修正

FFmpeg 產出 variant playlist 後，腳本必須將各畫質子資料夾中的 segment 檔名補上對應畫質名稱。

- 原始 segment 命名：`segment_{NNN}.ts`
- 修正後命名：`segment_{folder_name}_{NNN}.ts`

例如：

- `1080p/segment_000.ts` -> `1080p/segment_1080p_000.ts`
- `720p/segment_001.ts` -> `720p/segment_720p_001.ts`

腳本也必須同步更新各自 variant playlist 內的 segment 路徑引用，避免 playlist 指向舊檔名。

## 7. 輸出契約

### 7.1 輸出檔案結構

若輸入 `demo.mp4` 且解析度判定輸出 `1080p`、`720p`、`480p`，則輸出結構至少應符合：

```text
demo/
├── index.m3u8
├── 1080p/
│   ├── streaminglist-1080p.m3u8
│   ├── segment_1080p_000.ts
│   ├── segment_1080p_001.ts
│   └── ...
├── 720p/
│   ├── streaminglist-720p.m3u8
│   ├── segment_720p_000.ts
│   └── ...
└── 480p/
    ├── streaminglist-480p.m3u8
    ├── segment_480p_000.ts
    └── ...
```

### 7.2 命名規則

- root playlist：固定為 `index.m3u8`
- variant playlist：固定為 `streaminglist-{quality}.m3u8`
- segment：固定為 `segment_{quality}_{NNN}.ts`

### 7.3 路徑位置規則

輸出資料夾建立位置與輸入影片所在位置綁定。

例如：

- 輸入：`./media/demo.mp4`
- 輸出：`./media/demo/`

因此腳本不會把結果固定輸出到專案的 `script/` 或 `docs/` 目錄。

## 8. 錯誤處理

### 8.1 明確處理的錯誤

目前腳本明確處理以下錯誤情境：

- `ffmpeg` 不存在
- 缺少輸入參數
- `ffprobe` 無法取得影片高度

### 8.2 未明確處理的錯誤

以下錯誤目前沒有專屬處理邏輯，通常會以底層工具失敗形式呈現：

- `ffprobe` 指令不存在
- 輸入檔案不存在
- 輸入檔案不可讀
- 來源影片沒有音軌
- `ffmpeg` 轉檔途中失敗
- `sed` 與目標平台語法不相容
- 輸出目錄不可寫

## 9. 非功能需求

### 9.1 可維護性

腳本應維持以下特性：

- 畫質層級設定集中於單一函式 `add_resolution`
- 所有輸出命名規則固定且可預測
- 不依賴專案內其他腳本、設定檔或模板

### 9.2 可移植性

目前規格不保證跨平台可移植性。若要支援 Linux，至少需要調整：

- `sed -i ''` 的使用方式
- 平台差異的相依檢查

### 9.3 使用者可理解性

腳本在主要階段應提供明顯終端輸出，包括：

- 偵測到的來源高度
- 加入的畫質層級
- FFmpeg 開始執行
- 重新命名階段
- 完成訊息

## 10. 相依與整合關係

本腳本與專案其他檔案的關係如下：

- 執行上獨立，不依賴同目錄其他檔案。
- 可作為本專案播放器的 HLS 輸入準備工具。
- 產出的 `index.m3u8` 可作為前端播放器讀取入口。

相關文件：

- [script/README.md](/Users/iskku/Project/ipfs-hls-test/script/README.md)
- [docs/VIDEO_TRANSCODING.md](/Users/iskku/Project/ipfs-hls-test/docs/VIDEO_TRANSCODING.md)

## 11. 已知限制

- 固定假設輸入有 `v:0` 與 `a:0` 可用。
- 固定使用 `libx264` 與 `aac`。
- 不支援字幕搬移或字幕清單寫入。
- 不支援 CMAF/fMP4 segment。
- 不支援輸出參數客製化。
- 不支援批次作業。

## 12. 未來擴充建議

以下項目不屬於目前規格，但可作為後續版本目標：

- 補上 `ffprobe` 存在檢查。
- 支援 Linux 與 macOS 的 `sed` 相容封裝。
- 支援沒有音軌的輸入影片。
- 支援自訂輸出根目錄。
- 支援自訂 profile 與 segment duration。
- 產生字幕或封面圖的輔助流程。
- 增加執行前檔案存在與可讀性檢查。

## 13. 驗收條件

符合以下條件時，可視為此規格達成：

1. 在具備 `ffmpeg`、`ffprobe` 的支援環境中，可接受單一影片參數執行。
2. 能依來源高度自動建立正確畫質子目錄。
3. 能產生 root `index.m3u8` 與各畫質 `streaminglist-{quality}.m3u8`。
4. `index.m3u8` 內引用的 variant playlist 名稱與實際檔名一致。
5. 產物位於輸入影片同層目錄下的同名資料夾中。
