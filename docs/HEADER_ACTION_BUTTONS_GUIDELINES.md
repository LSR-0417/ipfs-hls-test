# Header Action Buttons 設計準則

## 1. 文件目的

本文件是 header 右上角 action buttons 的共享規範，給三種角色一起使用：

- UI/UX：確認這組按鈕應該長什麼樣、傳達什麼層級
- 前端：知道該怎麼實作、哪些結構不能改壞
- LLM：知道哪些是硬限制、哪些是可以延伸的設計空間

本文件聚焦於：

- 同系列按鈕的共用結構
- icon、文字、狀態提示之間的責任切分
- hover / focus / responsive 行為
- 未來新增 header actions 時的延伸規則

本文件不描述 gateway 切換流程本身，也不描述 dialog 內的選單卡片設計。

## 2. 快速摘要

先看這段，就能理解這組按鈕的核心：

- 右上角按鈕是 header 工具列，不是資訊卡片
- `Gateway` 與 `Account` 必須共享同一套設計語言
- icon 代表「這是什麼按鈕」，status ring 代表「現在狀態如何」
- 狀態視覺必須留在按鈕內，不可外溢
- 搜尋列的可用性比次要按鈕文案更重要
- 在 `375px` 寬度下，`Gateway` 必須可收斂為 icon-only

## 3. 怎麼閱讀這份文件

### 3.1 UI/UX 先看什麼

先看：

- `4. 共享設計原則`
- `6. 視覺與狀態規範`
- `7. Responsive 契約`
- `9. 驗收檢查表`

UI/UX 主要要抓的是：

- 這組按鈕在視覺上應該像工具列，不像卡片
- 哪些資訊能放進按鈕，哪些不能
- 窄版時哪些資訊必須讓位

### 3.2 前端先看什麼

先看：

- `5. 結構契約`
- `6. 視覺與狀態規範`
- `7. Responsive 契約`
- `8. 延伸與修改規則`

前端主要要抓的是：

- 共用 DOM 結構
- icon chip / text / status ring 的責任切分
- media query 下哪些元素該隱藏、哪些不能消失

### 3.3 LLM 先看什麼

先看：

- `4.4 規則等級`
- `5. 結構契約`
- `7. Responsive 契約`
- `10. LLM 交付清單`

LLM 不應只抽取描述性文字，應把本文件視為實作契約。

若本文件與較舊文件衝突，以本文件與目前 `src/components/Header.vue` 實作為準。

## 4. 共享設計原則

### 4.1 Header Tooling，而非資訊卡

Header action buttons 應被視為工具列的一部分，而不是獨立資訊卡片。

因此：

- 常態應維持輕量、低邊界感
- 不使用厚重外框、大面積 glow 或卡片式陰影
- hover / focus 才浮出淡淡背景與邊界

### 4.2 Icon 與狀態分責

icon 的責任是代表「這顆按鈕是什麼」；狀態視覺的責任是代表「它現在處於什麼狀態」。

因此：

- icon 尺寸必須固定，不應因狀態提示而縮小
- 狀態視覺不得超出按鈕本體邊界
- 狀態視覺不應與 icon 疊到難以辨識的程度

### 4.3 同系列，共通節奏

同系列 action buttons 應共享：

- 相同按鈕高度
- 相同 icon chip 尺寸
- 相同字級層級
- 相同 hover / focus 回饋
- 相同 RWD 收斂策略

### 4.4 規則等級

#### MUST

- Header action buttons 必須共享同一套 `action-btn` 結構
- icon 尺寸必須固定，不得因狀態提示而縮小
- 狀態視覺必須留在按鈕本體內，不得外溢
- 最窄寬度下，`Gateway` 必須允許收斂為 icon-only
- 搜尋列的可用寬度優先於次要 header action 文案

#### SHOULD

- `Gateway` 與 `Account` 應共享相同的 icon chip 尺寸與按鈕高度
- hover / focus 應保持低邊界感
- gateway 名稱應優先安全截斷，而不是壓縮搜尋列到不可用

#### MUST NOT

- 不得回到 card-like 重陰影按鈕
- 不得把 badge、counter、狀態點同時堆在同一顆 header action 上
- 不得讓狀態裝飾超出按鈕邊界
- 不得在最窄寬度下保留會破壞 header 版面的多層文字

## 5. 結構契約

標準結構如下：

```text
button.action-btn
|- span.action-btn-visual
|  |- optional status ring
|  |- svg icon
|- span.action-btn-copy
   |- span.action-btn-label
   |- span.action-btn-title
```

規則：

- `action-btn-visual` 是 icon chip，不可省略
- `action-btn-copy` 是文字區，可依 viewport 收合或隱藏
- 若按鈕需要 live status，狀態視覺必須掛在 `action-btn-visual` 內部

前端與 LLM 的實作要求：

- 優先重用既有 class naming，不要平行新增另一組 header button class
- 若要新增變體，應建立 modifier class，而不是複製整段 base style
- 若同一需求能透過 media query 收斂，不應新增獨立 mobile-only 元件

## 6. 視覺與狀態規範

### 6.1 尺寸

目前 header action 系列的基準如下：

- 按鈕最小高度：`46px`
- icon chip：`34 x 34`
- icon：基準 `18 x 18`
- 窄版 icon chip：`30 x 30`
- 窄版 icon：基準 `16 x 16`

若 icon path 視覺上偏小，可做有限度的 per-icon scale 補償，但應優先確認是否能改用更合適的 path。

前端與 LLM 應優先：

- 保住共用尺寸
- 再微調個別 icon scale

不應先改壞共用尺寸，再用更多例外規則補救。

### 6.2 文字層級

- `action-btn-label`：分類標籤，例如 `Gateway`、`Account`
- `action-btn-title`：目前狀態或主要目的，例如 `Local Node`、`Sign In`

規則：

- `label` 永遠比 `title` 更淡、更小
- `title` 才是主要閱讀焦點
- 不允許額外加入第三層文字，避免 header 過度資訊化

### 6.3 常態與互動態

常態：

- 背景透明或近乎透明
- 外框不可成為主要視覺元素

Hover / focus：

- 允許出現淡背景
- 允許出現細邊界或輕量 focus ring
- 不可變成卡片式發光塊

檢查方法：

- 若 hover 看起來像卡片而不是 toolbar action，表示修改過重
- 若 focus ring 超出按鈕邊界太多，表示不符合本規範

### 6.4 Gateway 類型

Gateway 按鈕的 icon chip 底色可反映 gateway 類型：

- `local`
- `public`
- `custom`

這層顏色用來表示「來源類型」，不是健康狀態。

### 6.5 Gateway 健康狀態

Gateway 的 probe 狀態應以 icon chip 內部的 status ring 表達，不使用超出邊界的小燈號。

狀態對應如下：

- `idle`：中性細 ring
- `probing`：黃色 pulse ring
- `playlist_ready`：黃色穩定 ring
- `ready`：綠色穩定 ring
- `degraded`：橘色 ring
- `rate_limited`：橘黃色 ring
- `redirected`：藍色 ring
- `failed`：紅色 ring

規則：

- ring 必須留在 chip 內部，不可超出整體按鈕邊界
- ring 應低調到不被誤認為第二層按鈕外框
- icon 永遠在 ring 之上，避免被 ring 吃掉視覺重量

LLM 不應：

- 把 ring 寫成外側 outline，導致和鄰近按鈕互相覆蓋
- 把 ring 改回右下角 status dot，除非需求明確要求

### 6.6 非狀態型按鈕

像 `Account` 這類沒有 live system health 的按鈕，不應勉強套用狀態 ring。

這類按鈕只需要：

- 統一尺寸的 icon chip
- 同系列 hover / focus 規則
- 與 gateway 按鈕一致的文字層級

## 7. Responsive 契約

### 7.1 Desktop

桌面寬度下：

- `Gateway` 與 `Account` 皆顯示
- 顯示 `label + title`
- 允許 gateway 名稱被安全截斷，但不應只剩一兩個字元

### 7.2 Tablet / 中窄寬度

中窄寬度下：

- `Account` 可優先隱藏
- `Gateway` 保留 icon 與主要文字
- 搜尋列優先取得足夠可輸入空間

### 7.3 最窄寬度

最窄寬度以 `iPhone 13 mini` 的 `375px` 為驗證下限。

規則如下：

- `Account` 隱藏
- `Gateway` 只保留 icon chip 與 status ring
- 文字完全隱藏
- 搜尋 placeholder 可縮短為 `Search CID`

這是硬性 responsive 契約，不是可選建議。

## 8. 延伸與修改規則

若未來需要新增新的 header action：

- 優先重用 `action-btn` 結構
- 除非它代表 live state，否則不要新增 status ring
- 不要把 badge、counter、live dot 同時堆進一顆按鈕
- 若需要新的狀態語意，應先定義「是類型、是健康狀態，還是未讀數量」
- 同一顆按鈕只能有一種主要狀態通道，避免語意打架

以下元件不應直接套用這套語言：

- Gateway Settings dialog 內的 gateway option cards
- 播放器下方的 like / dislike / follow 等內容動作列
- 側邊欄導覽項目

## 9. 驗收檢查表

在修改或新增 header actions 後，至少應檢查：

1. icon chip 是否仍與同系列按鈕等尺寸
2. 狀態視覺是否超出按鈕外框
3. 文字是否遵守 `label` / `title` 兩層限制
4. `375px` 寬度下搜尋列是否仍可正常使用
5. `hover` / `focus` 是否像工具列按鈕，而不是卡片

## 10. LLM 交付清單

若由 LLM 實作 header actions 相關調整，完成後應明確回報：

1. 改了哪些檔案
2. 是否影響 `src/components/Header.vue`
3. 是否影響 `375px` 寬度行為
4. 是否新增或移除了狀態視覺
5. 是否已執行至少一項驗證

建議驗證方式：

- `npm run build`
- Desktop 截圖檢查
- `375px` 窄版截圖檢查
