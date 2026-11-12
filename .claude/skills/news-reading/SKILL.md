---
name: news-reading
description: 製作或修改「短文時事閱讀」的一篇（data/news-reading/<日期>-<主題>.json → /news-reading/<id>）：讀一篇真實的泰文短文（臉書貼文、廣告、短新聞），含原文、逐句解析、單字、句型、閱讀理解，投影片模式與 PDF 講義。當使用者貼一段泰文貼文／短文說「短文時事閱讀」、「做成閱讀課」、「這篇做短文閱讀」時使用。只要單字、句子、金句的節日時事用 news-supplement。
---

# 短文時事閱讀

一篇＝一段真實的泰文短文（第 1 篇：手標泰奶「1 ศูนย์ 2 ต่ำ」臉書貼文）。和時事補充不同：**整篇短文都要讀**，重點是讀懂原文。

## 檔案

- 資料：`data/news-reading/<YYYY-MM-DD>-<英文主題>.json`，檔名就是 id；列表依 `date` 新的在前，編號「第 N 篇」自動算。型別見 `src/newsreading/types.ts`。
- 圖片：`public/news-reading/<YYYY-MM-DD>/cover.jpg`（貼文圖，`sips -Z 720` 縮小）。臉書 CDN 圖片網址會過期，拿到就先下載。
- 頁面：`/news-reading/<id>`、投影片 `/present`、列印 `/handout`（`src/newsreading/ReadPages.tsx`；樣式沿用 `conv.css`＋`news.css`，另加 `newsreading.css`）。
- PDF：dev server 開著時跑 `scripts/gen-handout.sh read:<id> <port>` → `public/handouts/news-reading-<id>.pdf`。

## 內容規格

1. **導言 intro**：1–2 句，說這篇是什麼（品牌、事件）、今天學什麼。泰文寫 `<<泰文|拼音>>`。
2. **圖片文字 image.lines**：貼文圖上的字逐句（th／rom／zh），菜單、價格都放。
3. **原文 original**：照原貼文一行一行，只有泰文（保留 ✅、emoji、引號），讓學生先自己讀。
4. **逐句解析 paragraphs**：照原文分段、切成短句，三行對應；重點單字用 `{{}}` 在 th／rom／zh 都標紅。備註段加 `label`。
5. **單字 words**：從原文挑 10–13 個，列表呈現；每個字附構詞 note（例：น้ำตาล 糖＋ทราย 沙子）和一個生活化例句 ex。
6. **句型 patterns**：2–3 個，第一個例句取自原文，第二個自己造；說明一句話就好。
7. **閱讀理解 questions**：4–5 題，中文問、答案附原文泰文；可以出一題看圖（價格）。講義不印答案、留作答線。
8. **資料來源 source**：附原貼文連結，主圖標 credit。

## 投影片分頁

封面（導言）→ 圖片文字 → 原文 → 逐句解析（一段一頁）→ 單字（一頁 2 個）→ 句型（一個一頁）→ 閱讀理解（一頁 3 題，按「看答案」才顯示）。

## 完成後

`npx tsc --noEmit`，看課程頁、投影片、列印頁，重產 PDF。講義的長卡片可以跨頁（只有每一句、每個字不切開），不然整頁會空白。拼音照 thai2english 寫法，不確定的字列給老師確認。老師校對後把修正寫回這份規格。
