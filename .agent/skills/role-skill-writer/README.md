# role-skill-writer

這份 README 定義這個 repo 在撰寫與整理 local skills 時的偏好規則。目標不是提供通用技能設計理論，而是明確規範這個專案希望 skill 長什麼樣、怎麼命名、怎麼分層、哪些資訊該放哪裡。

## 1. 命名與分層偏好

- skill name 與資料夾名稱一律使用小寫 ASCII 英文與 `-`，不要使用中文。
- skill id 應簡短、可預測、可被穩定引用。
- 角色型 skill 使用 `role-*`。
- 可跨角色重用的流程型 skill 使用 `sop-*`。
- `README.md` 的 H1 要和 skill name / folder name 一致，不另外發明更口語的標題。

## 2. 語言分工偏好

- `SKILL.md` 用英文撰寫，優先考慮 token 成本與模型穩定性。
- `README.md` 用台灣正體中文撰寫，優先給人類理解，也能給 LLM 補背景。
- `README.md` 是這份 skill 的絕對基準與主要編修來源。
- `README.md` 也可作為參考資料、來源連結與背景脈絡的記錄處。
- `agents/openai.yaml` 的 `display_name` 與 `short_description` 用中文，方便 UI 顯示。
- `default_prompt` 可維持英文。
- 若某個 skill 的輸出語言有明確要求，例如 commit body 必須用台灣正體中文，應直接寫在 `SKILL.md` 裡，不要只放在 README。
- 實際修改 skill 時，先改 `README.md`。
- 只有在編修者明確指示要「轉成 `SKILL.md`」時，才由 LLM 依據 `README.md` 轉成英文版 `SKILL.md`，並在不影響功能性的前提下壓縮以節省 token。
- 轉成 `SKILL.md` 時，要濾掉不影響執行邏輯的 hyper-link、來源追蹤與純參考性資料，避免把參考紀錄原封不動帶進模型上下文。

## 3. 文件責任分工

### `SKILL.md`

- 只放會被模型常載入時真正需要的核心規則。
- 內容應偏短、偏硬規則、偏執行導向。
- 應包含：trigger description、goal、workflow、guardrails、stop conditions 或等價結構。
- 它應視為由 `README.md` 萃取出的英文壓縮版，而不是主要的手工編修來源。
- 當編修者要求從 `README.md` 轉成 `SKILL.md`，或進行 rename、重寫、搬移時，必須檢查 `SKILL.md` frontmatter 仍然有效。
- 這個檢查至少包含：檔案開頭第一行為 `---`、frontmatter 內仍有 `name` 與 `description`、並且用 `---` 正確閉合。
- 若環境可用，應再用驗證工具確認；若工具不可用，至少要人工檢查 `SKILL.md` 開頭幾行，避免結構被改壞。

### `README.md`

- 放人類看的說明、偏好理由、命名考量、範例與脈絡。
- 也可放參考資料、來源連結與背景記錄。
- 可以比 `SKILL.md` 更完整，但不要和 `SKILL.md` 大量逐句重複。
- 重點是補背景，不是再寫一份第二套執行規則。
- 實務上應優先編修這份檔案。
- 是否同步產出 `SKILL.md`，應由編修者明確指示，不預設每次 README 變動都立即轉換。

## 4. Role Skill 撰寫偏好

- role skill 應描述某個專業角色的基本素養與要求，而不只是流程總覽。
- 內容應涵蓋：
  - 角色定位
  - 團隊協作準則
  - 獨自運作準則
  - 角色立場
  - 角色可調整性
  - 基本要求
- 若某個判斷本質上屬於角色責任，例如 kickoff 時如何收斂問題與驗收條件，就應放在 role 裡。
- 與其他角色互動的段落，優先使用 `與 PM 協作準則`、`與 TE 協作準則`、`與 Project Owner / 主管協作準則` 這種寫法，讓它們明確表達成角色原則。

## 5. SOP Skill 撰寫偏好

- sop skill 應代表可跨角色重用的標準流程階段，而不是角色立場。
- 每個 sop skill 都應有清楚的責任邊界，不要把整個開發閉環塞進一個 skill。
- 目前偏好的 SOP 拆法是：
  - `sop-kickoff`
  - `sop-workspace`
  - `sop-development`
  - `sop-commit`
  - `sop-pr`
  - `sop-wrap-up`
- 若某個流程可被多角色共用，就應優先放進 `sop-*`，不要複製到不同角色 skill 內。

## 6. README 結構偏好

- sop skill 的 README 預設使用：
  - `1. 目的`
  - `2. 應作流程`
  - `3. 禁止項目`
- 這個結構的目的是壓縮過細的說明，避免 README 自己變成另一份冗長 SOP。
- role skill 的 README 不必硬套 `目的 / 應作流程 / 禁止項目`，因為 role 本質上描述的是角色標準與立場。

## 7. 更新既有 Skill 的偏好

- 若是在更新既有 skill，預設應往這套偏好收斂。
- 可以重寫結構、改名、拆 role / sop skill 邊界、調整語言分工。
- 但若使用者明確指定要保留某種舊寫法，則以使用者要求為優先。

這份 skill 的用途，就是把這些偏好集中起來，避免之後每次重寫或新增 skill 都要重新口頭定義一次。
