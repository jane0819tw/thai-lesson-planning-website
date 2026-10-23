---
name: dictation-clips
description: 把一支 YouTube 影片變成「延伸影片挑戰」的聽寫片段候選（L1–L5），產生後交給老師在審查頁驗收。當使用者提供 YouTube 影片網址或 videoId，要「做聽寫片段」、「跑字幕比對」、「新增影片到延伸影片挑戰」、「產生 L1–L5 候選」時使用。
---

# 影片 → 聽寫片段候選 → 等老師驗收

目標：使用者給一支有**手動泰文字幕**的 YouTube 影片，產出 L1–L5 每課的聽寫片段候選，
然後停在「等老師驗收」，**不要自己把片段標成已審**。

## 流程

1. **取得 videoId**：從網址抽出（`watch?v=` 後面 11 碼，或 `youtu.be/` 後面）。要加播放清單就問使用者清單網址／ID。
2. **確認環境**：`python3 -c "import youtube_transcript_api, pythainlp"`。缺套件就告訴使用者要裝
   `pip3 install --user -r scripts/requirements.txt`（先問過使用者再裝）。
3. **跑腳本**（在專案根目錄）：
   ```bash
   python3 scripts/dictation-build.py <videoId> 1 2 3 4 5 [--playlist=<清單ID>]
   ```
   - 課次可只給部分，例如只重跑 `4 5`。
   - 重跑安全：已審過的片段、被刪掉的（`rejected`）都會保留；`--reset` 只清這支影片「還沒審過」的片段，除非使用者要求否則不加。
   - 影片沒有**手動**字幕時腳本會失敗或字幕品質差；如實告訴使用者，不要改用自動字幕硬做。
4. **整理結果給使用者**：腳本輸出已列出每課本片的待審／已審／排除數與規則字次數，照它整理；
   影片標題／頻道／字幕分鐘數／句數看 `data/dictation/videos.json` 這支影片的那筆。
   - 標 ⚠ 的高頻規則字 → 請使用者確認是不是人名或口頭禪（常用字如 เขา 也會被標到，屬正常）
   - 規則字太雜（例如語氣詞被當成規則字）→ 建議加到 `data/dictation/exclude.json` 的 `規則字不算`，問過使用者再改，改完重跑（已加進候選的舊句要加 `--reset` 才會清掉，只清未審的；先問使用者）
5. **交棒驗收**：叫使用者開 `npm run dev` 後到 `/#/reading/dictation-review`（admin「🎧 聽寫片段審查」）：
   聽每句、改句子成關鍵字長度、刪錯標的字或整句、調起訖秒數，按儲存（只有本機 dev 能存檔）。
   審完的片段（`reviewed: true` 且有 `hits`）才會自動出現在學生的「延伸影片挑戰」。
6. **停在這裡**。不要替使用者勾 `reviewed`、不要 commit，除非他們明說。驗收完成後可以幫忙 commit
   `data/dictation/candidates/*.json` 與 `videos.json`（`subtitles/` 是快取，已在 .gitignore）。

## 注意

- 影片是第三方著作物：只存字幕快取（不進版本控制）和片段秒數，不下載影片本身。
- 學生頁會標示影片來源並連到 YouTube，所以 `videos.json` 的 `title`、`channel`、`url` 要正確。
- 回報時講清楚：跑了什麼、每課幾句待審、哪些沒驗證。
