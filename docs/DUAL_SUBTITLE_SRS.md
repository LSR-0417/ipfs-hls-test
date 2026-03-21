# 雙字幕需求規格書 (SRS)

## 文件狀態

- 狀態：待實作
- 性質：目標規格與實作邊界定義
- 主要影響介面：`src/App.vue`、`src/components/VideoPlayer.vue`、`src/components/SubtitleDialog.vue`、`src/utils/subtitles.js`

## 相關文件

- [`PLAYER_SRS.md`](./PLAYER_SRS.md)
- [`PLAYER_PAGE_DESIGN_GUIDELINES.md`](./PLAYER_PAGE_DESIGN_GUIDELINES.md)

## 1. 文件目的

本文件定義播放器雙字幕功能的目標行為，包含：

- 主字幕與次字幕的責任分工
- 控制列字幕按鈕、`SubtitleDialog` 與上傳字幕流程
- 字幕資源載入、播放器 text track 註冊與渲染之間的狀態關係
- 雙字幕大小、位置與交換規則
- 使用者可見的 loading、empty、error 與 disabled 狀態

本文件的目標是先固定產品與技術契約，再依此重構實作；因此本文以「應有行為」為主，不等同於目前程式實作現況。

## 2. 設計原則

### 2.1 主字幕與次字幕分工

- 播放器控制列上的字幕入口只負責主字幕。
- `SubtitleDialog` 只負責次字幕與字幕資源管理。
- 主字幕與次字幕不得選擇同一語言。
- 畫面上的字幕渲染順序預設為：
  - 主字幕在下
  - 次字幕在上

### 2.2 UI 狀態與播放器狀態分離

UI 是否可操作，不得直接綁定 `player.textTracks()` 的瞬時結果。

系統必須明確區分以下三個層次：

1. 字幕資源是否存在
2. 字幕 track 是否已掛進 player
3. 字幕 cue 是否已實際下載並開始渲染

控制列按鈕是否可用，必須由「字幕資源 catalog 狀態」主導，而不是由 cue 是否已出現主導。

### 2.3 `video.js` 的使用邊界

`video.js` 應只負責：

- 註冊 remote text tracks
- 控制 track `mode`
- 進行字幕 cue 渲染

字幕 UI 的產品語意，例如：

- 這裡只選主字幕
- 哪個是主字幕、哪個是次字幕
- 次字幕不可在這裡切換
- 字幕載入中 / 載入失敗 / 沒有字幕

應由應用程式層自行控制，不應依賴 `video.js` 內建字幕選單的預設語意。

## 3. 適用範圍

本規格適用於：

- sidecar `subtitles.json` 的載入與解析
- 本機字幕匯入、覆蓋、移除與下載
- 主字幕控制列入口
- 次字幕設定視窗
- 雙字幕畫面渲染
- 主次字幕互換按鈕
- 字幕偏好儲存

本規格不涵蓋：

- 自動掃描 sidecar 目錄中的裸 `.vtt` 檔案
- 超過兩條字幕同時顯示
- 內嵌式 SSA/ASS 樣式支援
- OCR 或自動翻譯字幕生成

## 4. 狀態模型

### 4.1 資源層

App 層必須維護字幕資源狀態，建議至少包含：

- `remoteStatus`: `idle | loading | ready | error`
- `remoteTracks`
- `importedTracks`
- `availableTracks = merge(remoteTracks, importedTracks)`

定義如下：

- `remoteStatus = idle`
  - 尚未開始載入 sidecar 字幕
- `remoteStatus = loading`
  - `subtitles.json` 請求進行中
- `remoteStatus = ready`
  - `subtitles.json` 請求已完成，不論結果為空或非空
- `remoteStatus = error`
  - `subtitles.json` 請求失敗，或內容格式無法接受

### 4.2 選擇層

字幕偏好模型固定為：

```js
{
  mode: 'off' | 'showing',
  primaryLang: string,
  secondaryLang: string
}
```

規則如下：

- `mode = 'off'` 時，不顯示任何字幕
- `mode = 'showing'` 時，允許：
  - 只有主字幕
  - 主字幕加次字幕
- `primaryLang` 不得等於 `secondaryLang`
- 若目前主字幕被移除或不可用，必須重新 reconcile
- 本地儲存只保存偏好，不保存字幕內容本身

### 4.3 播放器層

播放器層只反映 `video.js` 內實際狀態，建議至少包含：

- `registeredTrackLangs`
- `trackRegistrationState`: `idle | registering | ready | error`
- `trackLoadStateByLang`

這一層只用來：

- 同步 UI 與 `video.js` 實際狀態
- 對齊主次字幕渲染
- 記錄 track 註冊或渲染錯誤

不得反過來主導「字幕功能是否存在」這件事。

## 5. 功能需求

### FR-SUB-1 sidecar 字幕來源

系統僅透過 `subtitles.json` 載入遠端字幕清單。

- 不直接掃描 sidecar 目錄中的裸 `.vtt` 檔
- `subtitles.json` 缺失時，視為「沒有遠端字幕清單」
- 若 `subtitles.json` 回傳內容無法解析為合法 track 陣列，視為 `error`

### FR-SUB-2 字幕資源 catalog

只要下列任一來源存在可用字幕，系統就視為「有可用字幕資源」：

- sidecar `subtitles.json` 解析出的合法 remote tracks
- 使用者匯入的本機字幕 tracks

換言之：

- `availableTracks.length > 0` 表示 UI 應提供字幕選擇能力
- 不得要求 `player.textTracks()` 已完成註冊後，UI 才顯示為可選

### FR-SUB-3 主字幕控制列按鈕

播放器控制列必須固定顯示一顆主字幕按鈕。

按鈕本體規則：

- 永遠顯示在控制列
- 必須有可見文字或圖示可辨識其為主字幕入口
- 建議可見標示為 `主`

按鈕狀態規則：

- `remoteStatus = loading` 且 `availableTracks.length === 0`
  - 按鈕可見
  - 按鈕可點
  - 選單顯示 `字幕載入中...`
- `availableTracks.length > 0`
  - 按鈕可見
  - 按鈕可點
- `remoteStatus = ready` 且 `availableTracks.length === 0`
  - 按鈕可見
  - 按鈕 disabled
  - 提示 `沒有可用字幕`
- `remoteStatus = error` 且 `availableTracks.length === 0`
  - 按鈕可見
  - 按鈕可點
  - 選單顯示 `字幕載入失敗`

### FR-SUB-4 主字幕選單語意

主字幕按鈕打開的選單必須清楚表達：

- 這裡只切換主字幕
- 次字幕不可在此選單切換

選單固定元素：

- 標題：`主字幕`
- 提示列：`此處只切換主字幕，次字幕請到 Subtitles 視窗設定`

選單項目規則：

- 必須包含 `關閉主字幕`
- 必須列出所有 `availableTracks`
- 目前主字幕項目顯示 `主字幕`
- 目前次字幕項目顯示 `次字幕`
- 標記為 `次字幕` 的項目在此選單中不可點
- 本機匯入字幕可額外標示 `本機`

### FR-SUB-5 次字幕設定入口

`SubtitleDialog` 負責次字幕設定與字幕資源管理。

`SubtitleDialog` 必須提供：

- 次字幕選擇
- 匯入字幕
- 移除本機字幕
- 下載字幕

`SubtitleDialog` 不負責：

- 切換主字幕

### FR-SUB-6 主字幕與次字幕互斥

若使用者選擇與主字幕相同語言作為次字幕，系統必須自動處理，允許的策略為：

- 直接清空次字幕
- 或拒絕該操作並提示

同理，若使用者在主字幕選單改選成目前次字幕語言，系統必須避免主次字幕重複。

### FR-SUB-7 上傳字幕流程

本機匯入字幕後：

- 必須立即進入 `availableTracks`
- 必須立即出現在主字幕選單與次字幕選單中
- 若目前沒有主字幕，系統可自動將新匯入字幕設為主字幕
- 若目前已有主字幕，匯入行為不得強制改寫目前主字幕
- 同語言的本機字幕匯入可覆蓋既有同語言本機字幕

### FR-SUB-8 字幕下載

對任何存在於 `availableTracks` 的字幕，系統應提供下載能力。

- 本機字幕可直接下載原 blob 內容
- 遠端字幕下載不應依賴瀏覽器 HTTP cache

### FR-SUB-9 快捷鍵

`C` 鍵只控制整體字幕開關：

- 當字幕目前為關閉時，切回上次有效的主字幕組合
- 當字幕目前為顯示中時，切換為全部關閉

`C` 鍵不負責切換主字幕語言，也不負責切換次字幕語言。

### FR-SUB-10 主次字幕互換按鈕

控制列上的 `A/B` 按鈕只在以下條件同時成立時顯示：

- `mode = 'showing'`
- `primaryLang` 存在
- `secondaryLang` 存在

按下後：

- 交換 `primaryLang` 與 `secondaryLang`
- 不修改 `availableTracks`
- 不改變字幕總開關狀態

### FR-SUB-11 雙字幕渲染

當主字幕與次字幕同時存在時：

- 主字幕顯示在下
- 次字幕顯示在上
- 次字幕尺寸應小於主字幕
- 次字幕應動態貼齊主字幕上方，不得使用過大的固定間距

建議視覺規則：

- 主字幕：`100%`
- 次字幕：`70%` 到 `80%`，目前建議 `76%`

### FR-SUB-12 雙字幕渲染與資源載入分離

字幕 cue 是否已經開始顯示，不得影響主字幕按鈕是否可點。

以下狀況必須分開處理：

1. `subtitles.json` 尚未完成
2. track 已掛入 player，但 `.vtt` 尚未下載完成
3. cue 已成功渲染

`.vtt` 下載較慢時，允許：

- 主字幕按鈕已可點
- 選單已可切換
- 實際字幕稍後才出現

### FR-SUB-13 錯誤處理

錯誤必須至少區分為：

- manifest 載入失敗
- track 註冊失敗
- cue 載入或渲染失敗

使用者可見回饋至少要能區分：

- `字幕載入中`
- `沒有可用字幕`
- `字幕載入失敗`

### FR-SUB-14 偏好儲存

系統應將字幕偏好儲存在本機儲存中，但僅限：

- `mode`
- `primaryLang`
- `secondaryLang`

不得將：

- 字幕檔內容
- blob URL
- 瞬時 player 狀態

寫入持久化偏好。

## 6. 異步與競態規則

### 6.1 manifest 與 VTT 非同一階段

必須明確區分兩個非同步階段：

1. 字幕清單載入
2. 字幕檔案載入

其中：

- 階段 1 決定 UI 是否有選項可供選擇
- 階段 2 只決定字幕是否已開始渲染

### 6.2 不以 `player.textTracks()` 作為唯一 truth source

`player.textTracks()` 可用於：

- 驗證 track 是否成功掛載
- 驅動字幕渲染同步
- 驗證主次字幕順序

`player.textTracks()` 不應用於：

- 判定主字幕按鈕是否存在
- 判定字幕功能是否對使用者可用

### 6.3 初始化容錯

若字幕 UI 自訂 component 初始化失敗，不得造成整體播放器無法工作。

字幕選單初始化失敗時，至少應保證：

- 主字幕按鈕仍可見
- 錯誤不影響影片播放
- 失敗可由後續重新整理或重新建立控制列恢復

## 7. 非功能需求

### NFR-SUB-1 可存取性

- 主字幕按鈕必須有清楚的 `aria-label`
- Dialog 必須維持焦點管理與鍵盤可操作
- disabled 的次字幕項目應具有可辨識狀態，不可只依賴顏色

### NFR-SUB-2 效能

- 切換主字幕或次字幕不應重建整個 player
- 主字幕與次字幕切換應避免不必要的 track 全量重掛
- 字幕定位修正可以在 resize / fullscreen 時重新量測，但應避免高頻重排

### NFR-SUB-3 相容性

- 舊版單字幕偏好 `lang` 欄位應可安全升級到 `primaryLang`
- 若瀏覽器不支援某些進階字幕 UI，至少保留單字幕播放能力

## 8. 驗收條件

符合以下條件時，可視為本規格落地：

1. 控制列主字幕按鈕永遠可見，不會因 `video.js` 內建自動 hide 規則消失。
2. 主字幕按鈕的 enable/disable 由 `availableTracks` 與 `remoteStatus` 決定，而不是由 cue 是否已渲染決定。
3. 選單中可以明確看出哪個是主字幕、哪個是次字幕。
4. 次字幕項目在主字幕選單中不可選，且有明確說明要去 `SubtitleDialog` 設定。
5. 匯入字幕後，主字幕選單與次字幕選單都能立即看到新字幕。
6. 只開主字幕時，不顯示 `A/B` 按鈕。
7. 同時開主字幕與次字幕時，`A/B` 按鈕可正常交換上下角色。
8. 次字幕尺寸小於主字幕，且位置貼齊主字幕上方，不出現過大固定間距。
9. `subtitles.json` 載入慢時，使用者能看到 loading 狀態，而不是誤判成沒有字幕。
10. `.vtt` 下載較慢時，主字幕按鈕仍可操作，實際字幕可稍後顯示。

## 9. 建議實作順序

建議依以下順序實作：

1. 先重整 App 層字幕資源狀態，補齊 `remoteStatus` 與 `availableTracks`
2. 再重整主字幕按鈕 enable/disable 規則
3. 再實作主字幕選單語意與次字幕禁選規則
4. 再整合 `SubtitleDialog` 的次字幕與上傳流程
5. 最後處理雙字幕渲染校正與 `A/B` 角色互換
