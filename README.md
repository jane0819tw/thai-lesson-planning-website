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
