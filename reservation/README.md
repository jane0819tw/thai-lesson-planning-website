> **已併入認字網站（2026-10）**：學生預約頁與老師管理頁都改成 React，放在 `src/reservation/`。
> - 學生頁：`#/book?t=<預約代碼>`　老師頁：`#/admin`（加 `?mock=1` 用假資料，不碰真實試算表）。
> - 本資料夾只剩 Apps Script 後端（`src/*.gs`）、測試與開發文件；下方關於 `web/` 的說明是舊版，僅供參考。

# 泰時刻約課系統 — 第一版（功能 A）

AmazingTalker 通知信 → Gmail 標籤 → Apps Script → 試算表 + 行事曆。

## 檔案
- `src/Config.gs` 設定、狀態、欄位
- `src/Parser.gs` 信件解析（純函式）
- `src/Sheet.gs` 試算表存取　`src/Calendar.gs` 行事曆　`src/Sync.gs` 主流程
- `tests/parser.test.js` 解析測試：`node tests/parser.test.js`

## 部署
1. Gmail：篩選寄件者 `amazingtalker@mailer.amazingtalker.com` → 套用標籤「AmazingTalker」。
2. 新增 Google 試算表 → 擴充功能 → Apps Script，把 `src/*.gs` 與 `appsscript.json` 貼入（或用 clasp）。
3. 執行 `setup()` 一次並授權：建立三個分頁、狀態下拉、每 10 分鐘同步、編輯觸發器。
4. 平台按確認／拒絕後，到「預約」分頁把「狀態」改成已確認／已拒絕。

## 已驗證
- 兩封真實樣本（課時請求、取消信）的解析已進測試。
- 尚未驗證：Apps Script 實際執行（Gmail 純文字內文換行可能與 PDF 不同），部署後請先用這兩封信跑一次。

## 第二版：預約頁與管理頁（靜態網站 + Apps Script API，做法同 thaiskr-custom）
- `web/`：純靜態網站（`index.html` 學生預約頁、`admin.html` 老師管理頁、`config.js`、`style.css`、`common.js`、`student.js`、`admin.js`、`mock.js`）。
- `src/Web.gs`：Apps Script 的 JSON API（`doPost` 分派；`admin*` 需管理密鑰）。`src/Slots.gs`：可預約時段計算（`node tests/slots.test.js`）。
- 本機：`cd web && python3 -m http.server 8765`。`config.js` 的 `ENDPOINT` 空白時用假資料（也可加 `?mock=1`）；填入 `/exec` 網址就會讀真資料。
- 部署 Apps Script：貼入 `src/*.gs` 與 `appsscript.json` → 執行 `setup` → 執行 `createAdminKey`（到「執行記錄」複製密鑰）→「部署 → 網頁應用程式」（執行身分：我；存取：任何人）。改程式後要「管理部署作業 → 新版本」。
- 老師頁第一次開會要求輸入管理密鑰，只存在該瀏覽器的 localStorage。學生連結 = `index.html?t=<預約代碼>`（在老師頁複製）。
- 老師頁：「行事曆／固定時間」分頁，點格子或拖曳開放／取消，按儲存寫入「開放時段」分頁（每週＝固定時間；限定／休假＝單日設定）。
- 尚未做：Zoom 會議、確認信與課前提醒、取消／改期。

## 課程記錄表與 Zoom
- 每位學生一份記錄表（分頁：上課記錄／買課紀錄／基本資訊）。在老師頁「學生預約連結」貼上網址綁定（存在「學生」分頁的「課程記錄表」欄）。
- 學生頁顯示「剩餘堂數 ＝ 已收到款項的課程堂數（買課紀錄「N堂」、已收到有標記）− 上課記錄已填日期的堂數」，以及「我的預約」與 Zoom 連結。
- 確認私下預約時（`src/Sync.gs` 的 `confirmPrivate_`）：建立 Zoom（`src/Zoom.gs`）→ 把日期與連結填進記錄表下一個空白堂數（`src/Record.gs`）（不寄信）。取消／拒絕時刪除 Zoom 會議，記錄表那一列不自動清除。
- Zoom 金鑰只放「專案設定 → 指令碼屬性」：`ZOOM_ACCOUNT_ID`、`ZOOM_CLIENT_ID`、`ZOOM_CLIENT_SECRET`。
- 測試：`node tests/record.test.js`

## 老師的 LINE 通知
- 學生送出私下預約時，`src/Line.gs` 的 `notifyTeacher_` 會推 LINE 給老師（失敗只記錄，不影響預約）。
- 設定：LINE Developers 建 Messaging API channel → 發行 Channel access token；老師用自己的 LINE 加該官方帳號為好友；User ID 在 channel 的 Basic settings 最下方「Your user ID」。
- 在「專案設定 → 指令碼屬性」新增 `LINE_CHANNEL_TOKEN`、`LINE_USER_ID`，執行 `testLineNotify` 驗證，再「管理部署作業 → 新版本」。

## 學生可進入的課程（2026-10）
- 「學生」分頁多一欄 **可進入課程**（第 7 欄），值是逗號分隔的課程代號，例如 `reading:1,reading:2,video`。老師在管理頁「學生」分頁勾選後按儲存，會自動寫入（`adminSetCourses`）。
- 開放單位：**認字課程每 5 課一個單位**（`reading:1` ＝ L1–L5、`reading:2` ＝ L6–L10 …，課數增加時自動多出單位）；其他課程整門開放，代號是網站 `src/categories.ts` 的 key（目前有 `video`）。
- 學生頁（`getStudentView`）回傳 `courses`，「我的課程」卡片只列出已開放的單位與其課程連結。
- 部署：貼入新的 `src/Courses.gs`、`Config.gs`、`Web.gs` → 執行一次 `setup`（補上第 7 欄標題）→「管理部署作業 → 新版本」。**既有學生的這欄是空的＝沒有開放任何課程**，要到管理頁逐一勾選。
- 注意：這只控制「學生頁顯示哪些入口」。課程頁本身是公開的靜態網頁，沒有登入保護。
- 測試：`node tests/courses.test.js`
