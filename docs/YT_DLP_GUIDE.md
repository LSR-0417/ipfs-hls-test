# YouTube 素材下載與整理流程

這份文件對應兩支腳本：

- `script/download_youtube_assets.sh`
- `script/package_youtube_assets.sh`

用途分成兩段：

- 從 YouTube 下載原始影片與 sidecar 素材
- 把字幕、精簡版 metadata、封面與頭像整理成固定結構，方便後續播放器或 IPFS 流程使用

## 前置需求

- `yt-dlp`
- `ffmpeg`
- `jq`

其中：

- `download_youtube_assets.sh` 需要 `yt-dlp` 與 `ffmpeg`
- `package_youtube_assets.sh` 需要 `jq`

## 腳本分工

### 1. `download_youtube_assets.sh`

這支腳本會：

- 要求使用者輸入 YouTube 影片網址
- 先解析出影片 ID，再重組成乾淨的 `watch` URL
- 建立 `YYYYMMDD_uploader_title_id` 風格的下載資料夾
- 下載影片、`.info.json`、縮圖、所有可用字幕
- 把 metadata、thumbnail、subtitles 內嵌回影片
- 額外嘗試下載頻道縮圖，輸出為 `channel_avatar.<ext>`

執行方式：

```bash
./script/download_youtube_assets.sh
```

### 2. `package_youtube_assets.sh`

這支腳本假設你目前所在的目錄，就是某一支影片的 yt-dlp 下載目錄。它會：

- 找出目前目錄中的第一個 `.info.json`
- 擷取較適合前端直接使用的欄位，另存為精簡版 `info.json`
- 複製同影片 basename 的字幕檔，並整理成 `en.vtt`、`zh-TW.vtt` 這種乾淨名稱
- 將影片封面複製為 `cover.<ext>`
- 優先把 `channel_avatar.<ext>` 複製為 `avatar.<ext>`
- 保留所有原始檔，不做刪除或覆寫

執行方式：

```bash
cd "<download-folder>"
/Users/iskku/Project/ipfs-hls-test/script/package_youtube_assets.sh
```

## 建議使用流程

```bash
cd /path/to/workdir
/Users/iskku/Project/ipfs-hls-test/script/download_youtube_assets.sh

cd "./YYYYMMDD_uploader_title_id"
/Users/iskku/Project/ipfs-hls-test/script/package_youtube_assets.sh
```

第二步一定要在下載目錄內執行，因為整理腳本是依照目前目錄中的 `.info.json`、`.vtt`、封面圖與頭像圖來判斷輸入來源。

## 整理後的資料結構

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

執行整理腳本後，會額外建立一個以影片 basename 命名的 sidecar 資產資料夾：

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
    ├── en.vtt
    ├── zh-TW.vtt
    ├── cover.webp
    └── avatar.jpg
```

注意：

- `cover` 與 `avatar` 會保留來源副檔名，不一定永遠是 `.webp` 或 `.jpg`
- 這支腳本只複製 sidecar 素材，不會移動或重新命名原始影片
- 如果同一個目錄中有多個 `.info.json`，目前只會處理找到的第一個

## 與本專案播放器的關聯

整理後的字幕會變成 `en.vtt`、`zh-TW.vtt` 這類檔名，這和目前播放器對字幕檔名的偵測方式一致。

如果接下來要把影片轉成 HLS，請另外使用：

```bash
./script/multi_resolution_hls.sh /path/to/video.mp4
```

`multi_resolution_hls.sh` 只負責影片轉檔，不會處理這裡的 metadata、封面或頭像整理。

## 腳本實際使用的 yt-dlp 下載參數

`download_youtube_assets.sh` 核心上等價於下列流程：

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

這樣的組合適合保留最完整的原始素材，同時產出前端較容易再利用的字幕與 JSON。
