# Multi-Resolution HLS Script

`multi_resolution_hls.sh` 的核心目的，是用單次 `ffmpeg` 執行把單一來源影片快速轉成多個解析度版本，並直接輸出成可播放的 HLS 結構。腳本會建立主播放清單 `index.m3u8`，並把各畫質的片段與子播放清單分到對應資料夾。

這裡的「拆分」不是單純把原始檔案複製或切段成多份，而是依照不同目標解析度進行重新編碼，產生多畫質輸出。

相關文件：

- [正式規格書](/Users/iskku/Project/ipfs-hls-test/docs/MULTI_RESOLUTION_HLS_SPEC.md)

## 這個腳本需不需要和其他檔案放在一起

結論：不需要。

這支腳本本身不依賴同資料夾的設定檔、模板或其他腳本，只要能正確執行：

- `./script/multi_resolution_hls.sh /path/to/video.mp4`
- 或 `/Users/iskku/Project/ipfs-hls-test/script/multi_resolution_hls.sh /path/to/video.mp4`

就可以工作。

把說明文件放在 `script/` 目錄旁邊，是為了讓腳本與文件一起維護，比較容易找；不是執行上的必要條件。

如果之後會新增更多相關工具，例如上傳 IPFS、清理輸出、驗證播放清單，繼續集中放在 `script/` 目錄是合理的。目前只有這一支腳本時，不需要再拆成更深的子資料夾。

## 前置需求

- `ffmpeg`
- `ffprobe`
- macOS 或 BSD `sed`

注意：

- 腳本只檢查了 `ffmpeg` 是否存在，但實際上也有使用 `ffprobe` 讀取影片高度。
- 腳本使用 `sed -i ''`，這是 macOS/BSD `sed` 的寫法；如果在 Linux 執行，這一段需要調整。

## 用法

在專案根目錄執行：

```bash
./script/multi_resolution_hls.sh /path/to/my_video.mp4
```

如果輸入檔案是目前目錄下的影片，也可以這樣跑：

```bash
./script/multi_resolution_hls.sh my_video.mp4
```

## 轉檔流程

1. 檢查 `ffmpeg` 是否可用。
2. 讀取第一個參數作為輸入影片路徑。
3. 用 `ffprobe` 取得原始影片高度。
4. 依照影片高度決定要輸出的畫質層級。
5. 建立和影片同名的輸出資料夾。
6. 以單次 FFmpeg 執行同時產生多解析度 HLS 主播放清單、子播放清單與 `.ts` 分段。
7. 把每個畫質目錄中的 `temp.m3u8` 改名為 `streaminglist-{畫質}.m3u8`。
8. 把每個畫質目錄中的 `.ts` 分段檔改名為 `segment_{畫質}_{序號}.ts`。
9. 依照各畫質資料夾名稱，同步修正主播放清單 `index.m3u8` 與各自 variant playlist 內的對應路徑。

## 畫質輸出規則

- 原始高度 `>= 2160`：輸出 `4k`
- 原始高度 `>= 1440`：輸出 `2k`
- 原始高度 `>= 1080`：輸出 `1080p`
- 原始高度 `>= 720`：輸出 `720p`
- 原始高度 `>= 480`：輸出 `480p`
- 原始高度 `< 480`：只輸出 `orig`

腳本會由高到低補齊所有符合條件的層級。例如來源是 1080p，會輸出 `1080p`、`720p`、`480p`。

## 輸出位置與結構

如果輸入檔案是：

```text
/videos/demo.mp4
```

輸出目錄會是：

```text
/videos/demo/
```

典型結構如下：

```text
demo/
├── index.m3u8
├── 1080p/
│   ├── streaminglist-1080p.m3u8
│   ├── segment_1080p_000.ts
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

## 已知限制

- 輸入影片必須至少有一條影像軌和一條音訊軌，因為腳本固定使用 `-map 0:v:0` 與 `-map 0:a:0`。
- 腳本目前沒有處理沒有音軌的影片。
- 腳本預設使用 `libx264` 與 `aac`，沒有提供編碼器或碼率參數化。
- 如果在 Linux 上使用，`sed -i ''` 需要改成相容 Linux 的寫法。

## 建議的放置方式

目前建議維持這樣的結構即可：

```text
script/
├── multi_resolution_hls.sh
└── README.md
```

這樣最容易維護，也足夠清楚。技術上不需要把腳本和輸出資料夾綁在一起，因為輸出資料夾會依照輸入影片路徑動態建立。
