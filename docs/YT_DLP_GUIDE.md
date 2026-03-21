# YouTube 素材下載與整理流程

這份文件對應三支腳本：

- `script/download_youtube_assets.sh`
- `script/package_youtube_assets.sh`
- `script/generate_subtitles_manifest.sh`

本文以目前腳本實作為準，說明下載、整理與播放器相容性的現況。

## 1. 用途

流程分成兩段：

- 從 YouTube 下載原始影片與 sidecar 素材
- 將字幕、精簡 metadata、封面與頭像整理成 sidecar 資產資料夾
- 在需要時，依現有 `*.vtt` 重建 `subtitles.json`

## 2. 前置需求

- `yt-dlp`
- `ffmpeg`
- `jq`

其中：

- `download_youtube_assets.sh` 需要 `yt-dlp` 與 `ffmpeg`
- `package_youtube_assets.sh` 需要 `jq`

## 3. 腳本分工

### 3.1 `download_youtube_assets.sh`

這支腳本會：

- 互動式要求輸入 YouTube 影片網址
- 用 `yt-dlp -O "%(id)s"` 先解析影片 ID
- 重新組成乾淨的 `https://www.youtube.com/watch?v=<video_id>` URL
- 建立 `YYYYMMDD_uploader_title_id` 風格的下載資料夾
- 下載影片、`.info.json`、縮圖與所有可用字幕
- 將 metadata / thumbnail / subtitles 內嵌回影片
- 額外嘗試下載頻道縮圖，輸出為 `channel_avatar.<ext>`

執行方式：

```bash
./script/download_youtube_assets.sh
```

### 3.2 `package_youtube_assets.sh`

這支腳本假設你目前所在目錄，就是某支影片的 yt-dlp 下載資料夾。它會：

- 找出目前目錄中的第一個 `.info.json`
- 以該檔 basename 作為 sidecar 資料夾名稱
- 擷取前端較常用的欄位，輸出為精簡版 `info.json`
- 複製同 basename 的 `*.vtt` 字幕到 sidecar 目錄
- 為 sidecar 目錄生成 `subtitles.json`
- 複製同 basename 的封面圖，輸出為 `cover.<ext>`
- 優先複製 `channel_avatar.<ext>`，輸出為 `avatar.<ext>`
- 保留所有原始檔，不做刪除或覆寫

目前精簡版 `info.json` 會保留的欄位為：

- `id`
- `title`
- `uploader`
- `channel_id`
- `upload_date`
- `duration_string`
- `description`
- `tags`
- `categories`
- `resolution`
- `fps`

執行方式：

```bash
cd "<download-folder>"
/Users/iskku/Project/ipfs-hls-test/script/package_youtube_assets.sh
```

### 3.3 `generate_subtitles_manifest.sh`

這支腳本會讀取目標資料夾中的所有 `*.vtt`，生成：

```json
{
  "version": 1,
  "tracks": [
    { "lang": "en", "path": "en.vtt" }
  ]
}
```

執行方式：

```bash
/Users/iskku/Project/ipfs-hls-test/script/generate_subtitles_manifest.sh /path/to/cid-folder
```

## 4. 建議使用流程

```bash
cd /path/to/workdir
/Users/iskku/Project/ipfs-hls-test/script/download_youtube_assets.sh

cd "./YYYYMMDD_uploader_title_id"
/Users/iskku/Project/ipfs-hls-test/script/package_youtube_assets.sh
```

第二步必須在下載目錄內執行，因為整理腳本是根據目前目錄中的第一個 `.info.json`、同 basename 的字幕與縮圖、以及可用頭像檔來判斷輸入來源。

## 5. 整理後的資料結構

原始下載目錄大致會長這樣：

```text
20240101_Uploader_Some_Title_abc123/
├── Some Title [abc123].mp4
├── Some Title [abc123].info.json
├── Some Title [abc123].en.vtt
├── Some Title [abc123].zh-TW.vtt
├── Some Title [abc123].webp
└── channel_avatar.jpg
```

執行整理腳本後，會額外建立一個以影片 basename 命名的 sidecar 目錄：

```text
20240101_Uploader_Some_Title_abc123/
├── Some Title [abc123].mp4
├── Some Title [abc123].info.json
├── Some Title [abc123].en.vtt
├── Some Title [abc123].zh-TW.vtt
├── Some Title [abc123].webp
├── channel_avatar.jpg
└── Some Title [abc123]/
    ├── info.json
    ├── subtitles.json
    ├── en.vtt
    ├── zh-TW.vtt
    ├── cover.webp        # 也可能是 cover.jpg / cover.png
    └── avatar.jpg        # 也可能是 avatar.webp / avatar.png
```

注意：

- `cover` 與 `avatar` 會保留來源副檔名，不一定永遠是 `.webp` 或 `.jpg`
- 如果同一個目錄中有多個 `.info.json`，目前只會處理找到的第一個
- 如果沒有獨立頭像圖，sidecar 目錄中可能不會產生 `avatar.*`

## 6. 與本專案播放器的關聯

### 6.1 字幕

整理後的字幕會透過 `subtitles.json` 明確列出。播放器目前不會暴力掃描所有可能語系，而是只讀這份 manifest。

### 6.2 `info.json`

前端會直接讀取 sidecar 目錄中的 `info.json`，並映射到：

- 標題
- 上傳者資訊
- 上傳日期
- 描述
- tags / categories
- `resolution` / `fps`

### 6.3 封面與頭像的目前限制

這裡有一個重要的現況差異：

- `package_youtube_assets.sh` 會保留來源副檔名，輸出 `cover.<ext>` 與 `avatar.<ext>`
- 但前端目前固定請求 `cover.webp` 與 `avatar.jpg`

也就是說，若 sidecar 目錄實際產出的是 `cover.png` 或 `avatar.webp`，目前播放器不會自動載入這些圖片。

若你希望目前前端直接吃到圖片，最穩定的做法是讓 sidecar 目錄中實際存在：

- `cover.webp`
- `avatar.jpg`

### 6.4 為什麼前端會用硬編碼檔名

目前前端直接請求 `info.json`、`subtitles.json`、`cover.webp`、`avatar.jpg`，是因為這個專案預期 sidecar 目錄先經過既有腳本整理，再交給播放器使用。

腳本分工如下：

- `download_youtube_assets.sh`：下載原始 `.info.json`、字幕、縮圖與 `channel_avatar.<ext>`
- `package_youtube_assets.sh`：從下載目錄整理出 sidecar 目錄，輸出精簡版 `info.json`、複製字幕、複製 `cover.<ext>` 與 `avatar.<ext>`
- `generate_subtitles_manifest.sh`：在 sidecar 目錄內生成 `subtitles.json`

因此前端目前採用固定檔名契約，而不是在瀏覽器端動態掃描所有可能的 sidecar 檔案。

### 6.5 腳本符合性檢查

| 前端硬編碼名稱 | 負責腳本 | 目前是否符合 | 說明 |
| --- | --- | --- | --- |
| `info.json` | `package_youtube_assets.sh` | 符合 | 腳本會穩定輸出精簡版 `info.json` |
| `subtitles.json` | `generate_subtitles_manifest.sh`，且由 `package_youtube_assets.sh` 呼叫 | 符合 | 只要 sidecar 目錄存在，腳本就會產生 `subtitles.json` |
| `cover.webp` | `package_youtube_assets.sh` | 部分符合 | 腳本實際輸出 `cover.<ext>`，只有來源縮圖本來是 `.webp` 時才會得到 `cover.webp` |
| `avatar.jpg` | `download_youtube_assets.sh` 下載原始頭像，`package_youtube_assets.sh` 複製為 `avatar.<ext>` | 部分符合 | 腳本實際輸出 `avatar.<ext>`，且若沒有獨立頭像檔就不會產生；只有來源本來是 `.jpg` 時才會得到 `avatar.jpg` |

### 6.6 目前檢查依據

本節結論是依下列實作與測試整理：

- `script/download_youtube_assets.sh`：確認會下載 `.info.json`、字幕、縮圖與 `channel_avatar.<ext>`
- `script/package_youtube_assets.sh`：確認會輸出 `info.json`、`cover.<ext>`、`avatar.<ext>`，並呼叫 `generate_subtitles_manifest.sh`
- `script/generate_subtitles_manifest.sh`：確認會生成 `subtitles.json`
- `script/package_youtube_assets.spec.js`：覆蓋典型 `.webp` 封面與 `.jpg` 頭像案例，以及缺少獨立頭像時的行為
- `script/generate_subtitles_manifest.spec.js`：覆蓋 `subtitles.json` 生成與空字幕目錄情境

## 7. 與 HLS 轉檔流程的關係

若接下來要把影片轉成 HLS，請另外使用：

```bash
./script/multi_resolution_hls.sh /path/to/video.mp4
```

`multi_resolution_hls.sh` 只負責影片轉檔，不會處理 metadata、封面、頭像或字幕 manifest。

## 8. `download_youtube_assets.sh` 的核心 `yt-dlp` 參數

此腳本主要等價於：

```bash
yt-dlp \
  --write-info-json \
  --write-thumbnail \
  --write-subs \
  --sub-langs all \
  --convert-subs vtt \
  --no-write-comments \
  --embed-metadata \
  --embed-thumbnail \
  --embed-subs \
  -P "<download-folder>" \
  "https://www.youtube.com/watch?v=<video_id>"
```

這樣的組合適合保留完整原始素材，再交由 `package_youtube_assets.sh` 輸出較方便前端使用的 sidecar 結構。
