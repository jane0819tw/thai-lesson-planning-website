# 泰語認字課網站（最小版本）

Vite + React + TypeScript。課程內容全在 `data/lessons/*.json`（目前的「資料庫」）。

## 本機執行
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # 輸出到 dist/
npm run inventory  # 產生 docs/lesson-01-inventory.md（內容清單）
```

## 新增一課
複製 `data/lessons/lesson-01.json` 為 `lesson-02.json`，改內容，儲存即自動出現在首頁。

## 部署到 GitHub Pages
1. 在 GitHub 建立 repo，推上 `main`。
2. Repo → Settings → Pages → Source 選 **GitHub Actions**。
3. 每次 push 到 `main` 自動建置並發佈（`.github/workflows/deploy.yml`）。

## 之後上 GCP
- `Dockerfile` + `nginx.conf` 已備好，可直接 Cloud Run 部署靜態站。
- 要有後端資料庫時：實作 `src/data/repository.ts` 的 `LessonRepository`（呼叫 API），結構見 `docs/schema.sql`。
- 發音：`src/audio/speak.ts`。現在用瀏覽器 Web Speech（th-TH）；換 AI 語音時，把 mp3 路徑填進 JSON 的 `audioUrl` 即可，不用改程式。
