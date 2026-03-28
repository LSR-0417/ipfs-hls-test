# Script 工具總覽

`script/` 目前有 5 支 shell 腳本，分成四條用途：

- YouTube 來源素材下載與 sidecar 資產整理
- 已有 CID / sidecar 目錄的字幕 manifest 生成
- 系列目錄的播放清單 manifest 生成
- 本地影片轉多解析度 HLS

相關文件：

- [YouTube 素材下載與整理流程](../docs/YT_DLP_GUIDE.md)
- [多解析度 HLS 規格書](../docs/MULTI_RESOLUTION_HLS_SPEC.md)

## 1. `download_youtube_assets.sh`

用途：

- 互動式輸入 YouTube 影片網址。
- 用 `yt-dlp` 下載影片、`.info.json`、縮圖與字幕。
- 把 metadata、thumbnail、subtitles 內嵌回下載好的影片檔。
- 額外嘗試下載頻道縮圖，輸出為 `channel_avatar.<ext>`。

前置需求：

- `yt-dlp`
- `ffmpeg`

執行方式：

```bash
./script/download_youtube_assets.sh
```

輸出結果：

- 腳本會在目前工作目錄建立 `YYYYMMDD_uploader_title_id` 風格的資料夾。
- 下載目錄內保留 yt-dlp 原始命名的影片、字幕、縮圖與 `.info.json`。

## 2. `package_youtube_assets.sh`

用途：

- 在 yt-dlp 下載目錄內尋找第一個 `.info.json`。
- 產生精簡版 `info.json`。
- 把同影片 basename 的字幕複製成 `en.vtt`、`zh-TW.vtt` 這類乾淨名稱。
- 根據整理後的 `*.vtt` 自動生成 `subtitles.json`。
- 複製封面為 `cover.<ext>`。
- 優先把 `channel_avatar.<ext>` 複製為 `avatar.<ext>`。

前置需求：

- `jq`

執行方式：

```bash
cd "<download-folder>"
/Users/iskku/Project/ipfs-hls-test/script/package_youtube_assets.sh
```

注意：

- 這支腳本只整理 sidecar 資產，不會刪除或搬動原始影片檔。
- 如果同一個目錄有多支影片，只會處理找到的第一個 `.info.json`。

與前端 sidecar 硬編碼契約的關係：

- 前端目前固定讀取 `info.json`、`subtitles.json`、`cover.webp`、`avatar.jpg`
- `package_youtube_assets.sh` 會穩定產生 `info.json`
- `package_youtube_assets.sh` 會呼叫 `generate_subtitles_manifest.sh` 產生 `subtitles.json`
- `package_youtube_assets.sh` 只會保留來源副檔名，輸出 `cover.<ext>` 與 `avatar.<ext>`，不保證一定是 `cover.webp` / `avatar.jpg`

## 3. `generate_subtitles_manifest.sh`

用途：

- 掃描指定資料夾中的所有 `*.vtt`
- 依檔名生成 `subtitles.json`
- 適合已經有 CID sidecar 目錄，或只想重建字幕 manifest 的情境

執行方式：

```bash
/Users/iskku/Project/ipfs-hls-test/script/generate_subtitles_manifest.sh /path/to/cid-folder
```

例如：

```bash
cd /path/to/cid-folder
/Users/iskku/Project/ipfs-hls-test/script/generate_subtitles_manifest.sh .
```

如果資料夾內有：

- `zh-TW.vtt`
- `zh-CN.vtt`
- `en.vtt`

就會產生：

```json
{
  "version": 1,
  "tracks": [
    { "lang": "en", "path": "en.vtt" },
    { "lang": "zh-CN", "path": "zh-CN.vtt" },
    { "lang": "zh-TW", "path": "zh-TW.vtt" }
  ]
}
```

## 4. `generate_playlist_manifest.sh`

用途：

- 掃描系列根目錄下的集數資料夾
- 產生 root `playlist.json`
- 把每集 `info.json` 的標題、上傳者、時長整合進 `playlist.json`
- 若 `info.json` 內已有 `cid`，或集數資料夾下有 `cid.txt`，會一併寫入該集的 `cid`
- 若某集缺少 `index.m3u8`，仍可列入清單，但會標記為 `playable: false`

執行方式：

```bash
/Users/iskku/Project/ipfs-hls-test/script/generate_playlist_manifest.sh /path/to/show-root
```

例如：

```bash
cd /path/to/show-root
/Users/iskku/Project/ipfs-hls-test/script/generate_playlist_manifest.sh .
```

可選參數：

```bash
/Users/iskku/Project/ipfs-hls-test/script/generate_playlist_manifest.sh /path/to/show-root "My Series Title"
```

腳本會：

- 掃描 root 下一層的子資料夾
- 只納入至少包含 `index.m3u8` 或 `info.json` 的資料夾
- 依資料夾名稱中的數字排序，例如 `ep02` 會排在 `ep10` 前面
- 生成包含 `title`、`uploader`、`durationString` 的 `playlist.json`
- 若找到 `cid`，會優先寫入每集 manifest，讓前端可直接用 episode CID 播放

## 5. `multi_resolution_hls.sh`

用途：

- 用單次 `ffmpeg` 執行，把單一來源影片轉成多個解析度版本的 HLS。
- 會建立主播放清單 `index.m3u8`，並把各畫質的片段與 variant playlist 分到對應資料夾。

前置需求：

- `ffmpeg`
- `ffprobe`
- macOS 或 BSD `sed`

執行方式：

```bash
./script/multi_resolution_hls.sh /path/to/video.mp4
```

畫質輸出規則：

- 原始高度 `>= 2160`：輸出 `4k`
- 原始高度 `>= 1440`：輸出 `2k`
- 原始高度 `>= 1080`：輸出 `1080p`
- 原始高度 `>= 720`：輸出 `720p`
- 原始高度 `>= 480`：輸出 `480p`
- 原始高度 `< 480`：只輸出 `orig`

## 建議流程

1. 如果來源是 YouTube，先執行 `download_youtube_assets.sh`。
2. 需要整理 metadata、字幕、封面與頭像時，在下載目錄執行 `package_youtube_assets.sh`。
3. 如果只是補或重建字幕清單，直接對 sidecar 資料夾執行 `generate_subtitles_manifest.sh`。
4. 若要建立系列清單，對系列根目錄執行 `generate_playlist_manifest.sh`。
5. 需要 HLS 輸出時，對實際影片檔再執行 `multi_resolution_hls.sh`。

`multi_resolution_hls.sh` 的詳細輸出結構、命名規則與限制，請以 [`docs/MULTI_RESOLUTION_HLS_SPEC.md`](../docs/MULTI_RESOLUTION_HLS_SPEC.md) 為準。
