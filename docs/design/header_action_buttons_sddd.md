# Header Action Buttons 設計說明書 (SDDD)

## 1. 設計背景

本文件記錄目前 `src/components/Header.vue` 右上角 action buttons 的實際設計演進與落地決策。

本文件主要給前端與 LLM 理解背景脈絡：幫助實作者理解「為什麼目前長這樣」，避免只看 CSS 表面數值就回退到舊版做法。

若需要給 UI/UX、前端與 LLM 共用的主規範，應優先閱讀：

- `docs/HEADER_ACTION_BUTTONS_GUIDELINES.md`

這次設計整理的起點是：

- 原本 `Gateway` 使用較重的卡片式按鈕
- 右側搭配一顆獨立圓形 avatar
- 兩者在尺寸、資訊密度、hover 回饋與視覺責任上不一致

後續調整的核心方向為：

- 把兩者整併成同一系列 action button
- 降低卡片感，讓它更像 header tooling
- 保留 gateway 的即時狀態辨識能力
- 在 `iPhone 13 mini` 寬度下仍可穩定顯示

## 2. 設計目標

### 2.1 一致性

`Gateway` 與 `Account` 需要共享同一套按鈕語言，而不是一顆資訊卡搭配一顆頭像。

### 2.2 可擴充性

未來若新增新的 header actions，應能沿用同一組結構與 CSS，而不是再各自長出不同風格。

### 2.3 響應式穩定

設計必須明確支援以下 viewport：

- Desktop
- 一般 tablet / 中窄寬度
- `iPhone 13 mini` (`375 x 812`) 作為最小驗證寬度

## 3. 目前設計決策

### 3.1 外觀定位

目前右上角 action buttons 被定義為：

- header 工具列入口
- 輕量、低邊界感
- 在互動時才浮出背景與 focus 提示

因此目前不採用：

- 大面積卡片陰影
- 常態粗外框
- 超出按鈕邊界的狀態裝飾

### 3.2 結構

目前系列按鈕的實作結構如下：

```text
action button
|- visual chip
|  |- optional gateway status ring
|  |- icon
|- copy
   |- label
   |- title
```

對應實作位於：

- `src/components/Header.vue`

### 3.3 Gateway 狀態

早期版本曾使用右下角狀態點，但在視覺上容易產生兩個問題：

- 讓 gateway icon 看起來比 account icon 更小
- 在未來按鈕密集排列時，可能出現外溢與互相干擾

因此目前改為：

- 使用 icon chip 內部的 status ring
- ring 保持在 chip 邊界內
- icon 疊在 ring 之上

對 LLM 而言，這段是關鍵歷史背景：

- `status dot` 不是目前建議方案
- 內縮 `status ring` 是為了解決 icon 視覺縮小與按鈕擁擠時的外溢風險
- 若未來修改狀態視覺，必須先維持這兩個問題不復發

### 3.4 Icon 平衡

雖然 gateway 與 account icon 都使用相同的 SVG 盒尺寸，但 gateway icon path 的實際幾何範圍較保守。

因此目前實作允許：

- 保持共同的 `18 x 18` SVG 尺寸
- 針對 gateway 類型做輕微 scale 補償

這是為了達成視覺等大，而不是為了強化某種狀態語意。

LLM 不應把這些 scale 補償誤解成狀態效果。

## 4. Responsive 策略

### 4.1 Desktop

桌面寬度下：

- `Gateway` 顯示 `label + title`
- `Account` 顯示 `label + title`
- gateway title 可安全截斷

### 4.2 中窄寬度

中窄寬度下：

- `Account` 優先隱藏
- `Gateway` 保留 icon 與文字
- 搜尋列優先保有輸入寬度

### 4.3 最窄寬度

最窄寬度下：

- `Account` 隱藏
- `Gateway` 收斂為 icon-only
- 搜尋 placeholder 改短
- 仍保留 gateway status ring

此策略可避免 header 在 `375px` 寬度下出現文字擠壓、相互覆蓋或搜尋列過短的問題。

對 LLM 而言：

- 這代表 `375px` 是設計驗證下限
- 若新設計在 desktop 看起來更漂亮，但破壞此寬度，則屬於不合格變更

## 5. 視覺語意切分

目前視覺語意分成三層：

### 5.1 按鈕本體

表示「這是一個可點擊的 header action」。

### 5.2 Icon chip 底色

表示 gateway 類型，例如：

- local
- public
- custom

### 5.3 Status ring

表示目前 probe 狀態，例如：

- idle
- probing
- ready
- degraded
- failed

此設計避免把「類型」與「健康狀態」混成同一層顏色語言。

## 6. 與其他元件的界線

本設計只適用於 header action buttons。

以下元件不應直接套用本設計：

- Gateway Settings dialog 內的 gateway option cards
- 播放器下方的 like / dislike / follow 等內容動作列
- 側邊欄導覽項目

原因是這些元件的資訊密度、互動頻率與版面責任不同。

LLM 若被要求「整體統一風格」，也不應直接把 header action button 語言平移到這些元件上。

## 7. 已知限制

目前仍有以下限制：

- gateway icon scale 補償是基於視覺校正，而不是統一的 icon source system
- `Account` 目前仍是 placeholder action，尚未接真實登入流程
- status ring 只套用於 gateway trigger，其他按鈕沒有通用狀態模型

## 8. 後續建議

若未來要繼續演進，建議優先順序如下：

1. 建立共用 header action component，避免 `Header.vue` 內樣式持續膨脹
2. 釐清 gateway icon source，降低 per-icon scale 補償需求
3. 若接入真實登入流程，再定義 `Account` 的登入 / 已登入雙態規則

## 9. LLM 修改守則

若 LLM 後續要修改 header actions，應優先保住以下不變量：

1. `Gateway` 與 `Account` 屬於同一系列 action buttons
2. icon 與狀態必須分責
3. 狀態視覺不得超出按鈕邊界
4. `375px` 寬度下 gateway 必須可收斂為 icon-only
5. 搜尋列可用性優先於次要文案

若需求與上述不變量衝突，應明確指出衝突，而不是默默選擇其一。
