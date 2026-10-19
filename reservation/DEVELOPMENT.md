> **注意（2026-10）**：前端 `web/` 已搬到認字網站的 `src/reservation/`（React）：學生頁 `#/book`、老師頁 `#/admin`，原 `student.js`／`admin.js` 的邏輯對應 `BookingPage.tsx`／`AdminPage.tsx`／`schedule.ts`。下文提到 `web/` 的地方是舊版說明；Apps Script 後端不變。

# 泰時刻約課系統 — 開發文件

> 依 2026-10-13 的程式碼整理。部署步驟見 [README.md](README.md)，這份文件說明「目前有哪些功能、怎麼運作、改哪裡」。

## 1. 系統概觀

兩條資料來源，共用同一份 Google 試算表（「預約」分頁）與 Google 行事曆：

```
AmazingTalker 通知信 ─▶ Gmail 標籤 ─▶ Apps Script（每 10 分鐘 syncNow）─┐
                                                                        ├▶ 試算表「預約」 ◀▶ Google 行事曆
學生預約頁 (web/index.html) ─▶ Apps Script Web App (doPost) ────────────┘        │
老師管理頁 (web/admin.html) ─▶ Apps Script Web App (admin* 需密鑰)               ├▶ Zoom（建立／刪除會議）
                                                                                  └▶ 學生課程記錄表（讀堂數、寫下一堂）
```

| 層 | 技術 | 位置 |
|---|---|---|
| 後端 | Google Apps Script（V8，時區 Asia/Taipei） | `src/*.gs` |
| 資料庫 | Google 試算表（分頁＝資料表） | 綁定在 Apps Script 的那份試算表 |
| 前端 | 純靜態 HTML/JS，無建置工具、無框架 | `web/` |
| 測試 | Node 直接跑，不依賴 Google 服務 | `tests/*.test.js` |

沒有資料庫伺服器、沒有 npm 套件。前端以 `fetch` POST 呼叫 Apps Script 的 `/exec` 網址。

## 2. 功能清單

### A. AmazingTalker 信件同步（第一版）
- 每 10 分鐘（`CONFIG.SYNC_EVERY_MINUTES`）讀 Gmail 標籤「AmazingTalker」下最近 50 個對話，已處理過的信件編號記在「信件紀錄」分頁，不會重複處理。
- 解析兩種信（`Parser.gs`）：
  - **課時請求**：標題 `課時請求 yyyy/M/d 下午hh:mm - 下午hh:mm`，內文取學生名與過期時間。
  - **取消信**：標題 `您的學生 X 取消了與您的預約課程`，內文取原課程時間與取消原因。
- 課時請求 → 新增預約，**預設直接視為「已確認」**並寫入行事曆；課長不是 25／50 分鐘 → 狀態「請人工確認」，不寫行事曆。
- 取消信 → 用「平台顯示名稱＋開始時間」找到原預約，改為「已取消」並釋放行事曆；找不到則記入問題清單。
- 重複請求（同名同開始時間且仍有效）略過。
- `CONFIG.IMPORT_AFTER`：早於該日期的信一律略過（目前 `2026-10-13`），避免舊信變成新請求。
- 平台顯示名稱 → 學生姓名的對照來自「學生」分頁（姓名／平台顯示名稱欄），查不到就沿用平台名稱。
- 「待確認」且有過期時間的預約，過期後自動改「已過期」並釋放行事曆（`expireAndRemind_`）。

### B. 學生預約頁（`web/index.html` + `student.js`）
- 兩種進入方式：
  - **專屬連結** `index.html?t=<預約代碼>`：顯示學生姓名、剩餘堂數、「我的預約」與 Zoom 連結，送出時不必填資料。
  - **通用連結**（無 `t`）：學生自己填姓名與 Email。
  - 代碼無效 → 顯示「預約連結已失效」。
- 選課長（25／50 分鐘）→ 選日期（未來 `BOOKING_DAYS_AHEAD`＝21 天）→ 選 30 分鐘時段 → 送出。
- 50 分鐘的課佔兩格，選一格時下一格一併反白。
- 課程記錄表的「買課紀錄」若只有單一課長的課程包，課長按鈕被鎖定為該長度；後端也會驗證。
- 剩餘堂數 ≤ 0 時顯示警語（不阻擋送出）。
- 「重新整理時段」按鈕重抓時段；送出後自動重抓。
- 私下預約送出後狀態為「待確認」，並在行事曆建立【待確認】佔位。

### C. 可預約時段計算（`Slots.gs`，純函式）
規則來自「開放時段」分頁，類型四種：

| 類型 | 意義 |
|---|---|
| 每週 | 每個星期 N 的固定開放時間（週一=1…週日=7） |
| 單次 | 單日額外加開 |
| 限定 | 該日**只**開放這一段（忽略當天的每週規則） |
| 休假 | 整天不開放（說明會顯示給學生） |

- 以 30 分鐘為一格；格子在以下情況不可約：早於「現在＋`MIN_NOTICE_HOURS`(12h)」、與行事曆已有行程重疊。
- 行事曆有整天行程的日子視同休假。
- `can25`＝該格空；`can50`＝該格與下一格都空。已被占用的格子仍回傳（前端灰色顯示）。
- 預設每週時間（`DEFAULT_WEEKLY`）只在「開放時段」分頁完全空白時於 `setup` 寫入一次。

### D. 老師管理頁（`web/admin.html` + `admin.js`）
- 首次開啟要求輸入管理密鑰，存在該瀏覽器 localStorage（`thaiskr_admin_key`）。
- **行事曆分頁**：看某一週實際狀況（課、行事曆其他行程、開放格），點擊／拖曳格子開放或取消，只產生「單日設定」。
- **固定時間分頁**：編輯每週固定開放時段。
- 儲存時寫回「開放時段」分頁（每週＝固定時間；其餘＝單日設定）。
- **待確認的私下預約**：確認／拒絕。
- **所有預約**：列出尚未結束（或一天內剛結束）的預約，可「取消這堂課」或下拉改成任何狀態（會先 confirm）。可勾選「只看有效預約」。
- **學生預約連結**：新增學生、複製連結、換新連結（舊連結立刻失效）、綁定課程記錄表網址。
- **新預約提醒**：每 45 秒輪詢 `adminGetState`，有新的待確認私下預約時彈出提示條、瀏覽器通知與分頁標題計數。
- 所有 API 呼叫經 `run()`，自動顯示全螢幕載入遮罩（`BUSY_TEXT`）。

### E. 預約狀態與行事曆
狀態（`STATUS`）：待確認、已確認、已拒絕、已過期、已取消、請人工確認。

| 狀態 | 行事曆 |
|---|---|
| 待確認 | 灰色事件，標題前綴【待確認】 |
| 已確認 | 綠色事件 |
| 其他 | 刪除事件 |

事件佔用時間＝「佔用結束」（實際長度向上取整到 30 分鐘），事件說明含來源、編號、Zoom 連結。`syncCalendarEvent_` 可重複呼叫（冪等）。

狀態改變有兩個入口，都走 `applyStatusChange_`：
1. 試算表「預約」分頁的「狀態」下拉（安裝式 `onStatusEdit` 觸發器）。
2. 老師頁 `adminSetStatus`。

### F. 私下預約確認流程（`confirmPrivate_`）
狀態改成「已確認」且來源為「私下」時依序：
1. `ensureStudent_`：學生表沒有此人就建檔並產生預約代碼。
2. 建立 Zoom 會議（沒有連結才建；重複確認不會重建）。
3. 若學生已綁定課程記錄表 → 把「日期＋Zoom 連結」寫進「上課記錄」下一個空白堂數（`writeBookingToRecord_`；同連結不重寫）。

每一步失敗只寫入預約的「備註」，不會讓確認整個失敗。改成已取消／已拒絕等狀態時會刪除 Zoom 會議並清空連結，**記錄表那一列不自動清除**（避免誤刪手寫內容）。

### G. 課程記錄表整合（`Record.gs`）
每位學生一份記錄表，分頁：「上課記錄」／「買課紀錄」／「基本資訊」（有繁簡寫法容錯）。
- 已購堂數：「買課紀錄」中「已收到」欄有標記的列，從「課程類型」抓 `N堂` 相加；類型含 `25分`／`50分` 且一致時，限定課長。
- 已上堂數：「上課記錄」中第幾堂 ≥ 1 且「上課日期」有填的列數。
- 剩餘＝已購 − 已上。記錄表打不開或格式不符 → 回傳 null，學生頁不顯示課程卡，其他功能不受影響。
- 寫入格式：`2026/09/29 20:30-21:30`。

### H. Zoom 整合（`Zoom.gs`）
Server-to-Server OAuth，token 以 CacheService 快取約 50 分鐘。會議類型 2（排定），可在開始前加入、無等候室，時長＝實際上課長度。`testZoom()` 可手動驗證設定。

### I. 通知
`notify_()` 目前是**空函式**（確認信、老師通知都已停用），所有異常只留在「備註」欄、「信件紀錄」分頁與老師頁。需要寄信時只要實作這個函式，呼叫點都已就位。

## 3. 檔案導覽

### 後端 `src/`
| 檔案 | 職責 |
|---|---|
| `Config.gs` | `CONFIG`、`STATUS`、各分頁欄位（`*_HEADERS`）、`DEFAULT_WEEKLY` |
| `Parser.gs` | AmazingTalker 信件解析（純函式）、時間字串工具（`addMinutesStr_`、`occupiedMinutes_`） |
| `Slots.gs` | 可預約時段計算 `computeOpenSlots_`（純函式） |
| `Record.gs` | 課程記錄表：純函式 `summarizeLessons_`／`nextLessonIndex_`／`recordDateText_` ＋ 試算表存取 |
| `Sheet.gs` | 試算表存取層：`readBookings_`、`writeBooking_`、`setupSheets_`、信件紀錄 |
| `Calendar.gs` | `syncCalendarEvent_` |
| `Zoom.gs` | Zoom API |
| `Sync.gs` | 觸發器、`setup`、信件匯入、過期處理、`applyStatusChange_`、`confirmPrivate_`、`migrateAtToConfirmed`（一次性遷移） |
| `Web.gs` | `doGet`／`doPost` 分派、管理密鑰、學生與老師 API |
| `appsscript.json` | 時區、Web App 設定（以部署者身分執行、允許匿名）、OAuth scopes |

純函式檔（Parser／Slots／Record 的純函式部分）不碰 Google 服務，測試時用 Node 載入。

### 前端 `web/`
| 檔案 | 職責 |
|---|---|
| `config.js` | `SITE_CONFIG.ENDPOINT`（Apps Script `/exec` 網址；空白＝假資料模式） |
| `common.js` | `run()`／`runCall()` API 呼叫、載入遮罩、`esc()` 轉義、日期標籤 |
| `student.js`／`index.html` | 學生預約頁 |
| `admin.js`／`admin.html` | 老師管理頁（`noindex`） |
| `mock.js` | 假資料（`ENDPOINT` 空白或 `?mock=1` 時啟用） |
| `style.css` | 樣式 |

## 4. 資料模型（試算表分頁）

| 分頁 | 欄位 |
|---|---|
| 預約 | 編號、來源（`AmazingTalker`／`私下`）、學生、平台顯示名稱、開始、實際結束、佔用結束、課長、狀態、Zoom連結、行事曆事件編號、信件編號、請求過期時間、提醒已寄、取消原因、備註、建立時間、會議編號、確認信已寄 |
| 學生 | 姓名、平台顯示名稱、Email、備註、預約代碼、課程記錄表 |
| 開放時段 | 類型、星期、日期、開始、結束、說明 |
| 信件紀錄 | 信件編號、處理時間、類型、結果、標題 |

- 程式用**欄名**取值（`rowToObj_`），不寫死欄號；新增欄位只要加進 `BOOKING_HEADERS` 末端。
- 編號為 `B0001` 起算，以目前列數＋1 產生（見 §8 已知限制）。
- 預約代碼為兩個 UUID 去除連字號（64 字元），等同學生的免登入憑證。

## 5. API（`Web.gs`）

請求：`POST <ENDPOINT>`，`Content-Type: text/plain;charset=utf-8`（避開 CORS 預檢），body `{"fn": "...", "args": [...], "key": "..."}`。
回應：`{ok:true, data}` 或 `{ok:false, error}`。`doGet` 回 `{ok:true, service:'thaiskr-reservation'}` 作健康檢查。

**公開**

| fn | 參數 | 說明 |
|---|---|---|
| `getStudentView` | token | 回傳 `mode`（`known`／`generic`／`invalid`）、可預約日期與格子、剩餘堂數、我的預約 |
| `submitBooking` | token, name, email, startStr(`yyyy-MM-dd HH:mm`), length | 驗證 → ScriptLock → 再檢查一次該格仍空 → 寫入「待確認」＋行事曆 |

**管理**（`fn` 以 `admin` 開頭，需 `key` ＝ 指令碼屬性 `ADMIN_KEY`；錯誤時延遲 1 秒再回應）

| fn | 說明 |
|---|---|
| `adminGetState` | 規則、待確認私下預約、學生、近期預約 |
| `adminGetWeek(date)` | 該週（週一起）的課、行事曆其他行程、開放格 |
| `adminSaveRules(rules)` | 驗證並整份覆寫「開放時段」 |
| `adminSetStatus(id, status)` | 改預約狀態（待確認／已確認／已拒絕／已過期／已取消） |
| `adminCreateStudent(name, email)` | 新增學生並產生代碼 |
| `adminRenewLink(name)` | 換新預約代碼 |
| `adminSetRecord(name, url)` | 綁定／解除課程記錄表（只驗證網址格式） |

新增 API：在 `Web.gs` 寫函式，加進 `PUBLIC_API_` 或 `ADMIN_API_`，前端用 `run('fnName', ...)`，必要時在 `common.js` 的 `BUSY_TEXT` 加載入文字。

## 6. 設定與機密

| 項目 | 位置 |
|---|---|
| 一般設定 | `src/Config.gs` 的 `CONFIG` |
| 管理密鑰 `ADMIN_KEY` | 指令碼屬性；執行 `createAdminKey()` 產生，重跑即換新 |
| Zoom 金鑰 `ZOOM_ACCOUNT_ID`／`ZOOM_CLIENT_ID`／`ZOOM_CLIENT_SECRET` | 指令碼屬性 |
| 前端 `ENDPOINT` | `web/config.js`（公開網址，不是密碼） |

常用 `CONFIG`：`GMAIL_LABEL`、`IMPORT_AFTER`、`SLOT_MINUTES`(30)、`ALLOWED_LENGTHS`([25,50])、`BOOKING_DAYS_AHEAD`(21)、`MIN_NOTICE_HOURS`(12)、`CALENDAR_ID`（空＝預設行事曆）。

OAuth scopes 見 `appsscript.json`（Gmail 唯讀、行事曆、試算表、寄信、觸發器、外部請求）。

## 7. 開發與測試

```bash
# 單元測試（純函式）
node tests/parser.test.js     # 信件解析
node tests/slots.test.js      # 可預約時段
node tests/record.test.js     # 堂數統計、下一堂、日期格式

# 前端本機預覽（ENDPOINT 空白或 ?mock=1 時用假資料）
cd web && python3 -m http.server 8765
```

- 測試涵蓋純函式；`Sync`／`Web`／`Calendar`／`Zoom`／`Record` 的 Google 服務部分**沒有自動化測試**，需部署後手動驗證。
- 部署：貼入 `src/*.gs` 與 `appsscript.json`（或 clasp）→ `setup`（建分頁、觸發器）→ `createAdminKey` →「部署 → 網頁應用程式」（執行身分：我；存取：任何人）。**改程式後要「管理部署作業 → 新版本」**，`/exec` 網址才會更新。
- 前端是靜態檔，任何靜態主機皆可；每次改 `ENDPOINT` 以外的前端不需動後端。

## 8. 已知限制與待辦

**尚未實作**
- 確認信與課前提醒（`notify_` 為空）。
- 學生自助取消／改期。
- `zoomPatchMeeting_` 已寫好但沒有任何呼叫處（改期時用）。
- 私下預約成立後，仍需老師**手動**到 AmazingTalker 關閉同一時段（反向無自動同步）。

**程式面風險**
- `nextBookingId_` 以「列數＋1」產生編號；刪除試算表列會造成編號重複，建議不要刪列，改用狀態。
- `onStatusEdit` 在試算表改狀態時，狀態改回「已確認」才會重試 Zoom／記錄表。
- 取消／拒絕時記錄表不回填清除，需人工整理。
- `adminSetRecord` 只驗證網址格式，不確認權限；打不開時學生頁靜默不顯示課程卡。
- Gmail 純文字內文換行是否與 PDF 範本一致，尚未用真實 Apps Script 環境驗證（README 亦註明）。
- 管理密鑰存在瀏覽器 localStorage；任何持有 `/exec` 網址與密鑰的人皆為完整管理者，沒有多人／權限分級。
- 學生預約代碼即憑證，連結外流需用「換新連結」作廢。
- `syncNow` 一次只看最近 50 個對話；長期離線後可能漏信。
- `migrateAtToConfirmed` 是一次性遷移，可在確認不再需要後移除。
