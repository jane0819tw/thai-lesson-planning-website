# 泰語認字課網站（最小版本）

Vite + React + TypeScript。課程內容全在 `data/lessons/*.json`（目前的「資料庫」）。

## 本機執行
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # 輸出到 dist/
npm run inventory  # 產生 docs/curriculum-inventory.md（全部課程內容清單）
```

## 新增一課
複製 `data/lessons/lesson-10.json` 為 `lesson-11.json`，改內容，儲存即自動出現在首頁。

## 部署到 GitHub Pages
1. 在 GitHub 建立 repo，推上 `main`。
2. Repo → Settings → Pages → Source 選 **GitHub Actions**。
3. 每次 push 到 `main` 自動建置並發佈（`.github/workflows/deploy.yml`）。

## 之後上 GCP
- `Dockerfile` + `nginx.conf` 已備好，可直接 Cloud Run 部署靜態站。
- 要有後端資料庫時：實作 `src/data/repository.ts` 的 `LessonRepository`（呼叫 API），結構見 `docs/schema.sql`。
- 發音：`src/audio/speak.ts`。現在用瀏覽器 Web Speech（th-TH）；換 AI 語音時，把 mp3 路徑填進 JSON 的 `audioUrl` 即可，不用改程式。

## 網站結構
- `/`：所有課程（泰文認字課程、影片教學、歌詞、文教、會話、藝術字）；分類設定在 `src/categories.ts`，有 `to` 的才開放。
- `/reading`：認字課程列表（L1–L10）；`/reading/chart`：子音總表對照。
- 課程內容來源：認字講義 L1–L10（拼音、解釋、單元規劃皆依講義）。講義沒有提供拼音的單字，欄位 `roman` 留空。
- 例字圖示：`data/icons.json` 對應 `public/icons/*.svg`，圖片為 [Twemoji](https://github.com/jdecked/twemoji)（CC-BY 4.0，需標示來源）。部分單字（如 ฉิ่ง、ปฏัก、ฐาน 等）沒有完全對應的圖，先用相近圖示，可自行替換。
