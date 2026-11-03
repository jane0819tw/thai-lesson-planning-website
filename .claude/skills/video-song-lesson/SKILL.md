---
name: video-song-lesson
description: 把一支 YouTube 影片做成「歌詞跟讀」頁（data/songs/<id>.json）或「影片教學」頁（data/videos/<id>.json）：抓泰文字幕、斷詞、填音標與中文、補單字／句型／測驗，交給老師在頁面上校對。當使用者給 YouTube 網址要「做這首歌的歌詞頁」、「新增影片教學」、「把這支廣告做成教材」，或要補完內容待製作的歌曲／影片時使用。聽寫片段（延伸影片挑戰）用 dictation-clips，不是這個。
---

# YouTube → 歌詞頁／影片教學頁 → 等老師校對

兩條**分支**，先判斷是哪一條（使用者沒說就問）：

- **歌曲**：MV、歌曲 → `data/songs/<id>.json`，頁面 `/#/song/<id>`
- **影片**：廣告、短片、對話 → `data/videos/<id>.json`，頁面 `/#/video/<id>`

資料形狀以 `src/song/types.ts`、`src/video/types.ts` 為準；寫之前先讀，欄位說明都在註解裡。
範例：歌曲看 `data/songs/lunar-is-here.json`，影片看 `data/videos/deleaf-thanaka.json`。

## 共同規則

- **id**：英文小寫加連字號（`than-fai-kao`、`deleaf-thanaka`），先跟使用者確認。
- **`createdAt`**：新增時填當天 `YYYY-MM-DD`，放在 `id` 下一行（`song-build.py` 會自動填）。列表靠它排序，舊的在前；沒填的會排到最後。
- **音標**依 thai2english.com 的寫法（ป＝bp、ต＝dt，聲調符號、詞內連字號照網站輸出）。網站查不到的字，參考同網站相近拼法補上，並寫進 `note`。
- **泰文原文以字幕為準**。字幕本身寫錯或少了詞時，原文照字幕不改，在 `note` 記下哪裡和實際唱的／說的不同。
- 中文翻譯用台灣用語、口語自然；品牌名、人名的 `zh` 標「（品牌名）」「（人名）」。
- 「內容尚未製作」的空殼檔（`lines: []`）就是要補的對象：沿用它的 `id`、`createdAt`、`youtubeId`，其餘照下面分支填。

## 歌曲分支

1. **產生草稿**（專案根目錄）：
   ```bash
   python3 scripts/song-build.py <videoId> --id=<id>
   ```
   - 只用 YouTube **官方手動**泰文字幕。沒有手動字幕腳本會停下來：如實告訴使用者，不改用自動字幕。
   - 已有同名檔案會停下來。檔案是內容待製作的空殼時，跟使用者確認後加 `--force`，再把原本的 `createdAt` 改回去。
   - 缺套件：`pip3 install --user -r scripts/requirements.txt`（先問使用者）。
2. **填每一句**：每個字的 `rom`、`zh`，以及整句 `zh`。
   - `words` 的 `th` 接起來必須**完全等於** `th`（含空格，空格跟在前一個字後面）。斷詞只能切開或合併相鄰片段，不能改字。
   - 英文歌詞的 `rom` 留空。
   - 重複的副歌照樣填；要不要隱藏（`hidden`）讓老師決定。
3. **補充區塊**：
   - `notes`：約 6 個 `word` 加 3 個 `pattern`，挑歌裡學生最需要講的口語、方言、流行語與句型。每個都附 `explain` 和一個 `example`（th／rom／zh）。
   - `quiz`：3 題。`q` 寫泰文，`qZh` 是它的中文翻譯，`answer` 是正確選項的索引。
   - `images`：只有使用者提供圖片時才加，檔案放 `public/extras/songs/<id>/`。
4. **完成標準**：每一句的 `zh` 都有內容，每個泰文字都有 `rom` 和 `zh`，`notes` 和 `quiz` 都齊。全部填完才拿掉 `draft: true`；`draft` 還在的話學生列表看不到這首歌。

## 影片分支

沒有產生腳本，JSON 要自己寫。

1. **抓字幕**：用 `youtube_transcript_api` 抓泰文字幕，快取到 `data/dictation/subtitles/<videoId>.json`。
   - 優先用手動字幕。只有自動字幕時，對照影片畫面上的文字校對；拿不準的句子設 `guess: true`，並在 `note` 說明字幕怎麼來的。老師登入時，這些句子會顯示「字幕不確定，請老師確認」，老師確認後自己改回 `false`；回報時也逐句列出來。
   - 字幕和畫面都看不出來的，問使用者，不要自己猜一句填進去當定稿。
2. **切句寫 `lines`**：每句只有 `start`，結束時間＝下一句的 `start`。`duration` 填影片秒數。
   - `words`：每個字的 `th`、`rom`、`zh`。這個字屬於某個句型時，加 `p: "<句型 id>"`。
   - `patterns`：列出這句用到的句型 id。
3. **補充區塊**：
   - `vocab`：只挑真正需要講解的字（約 10 個），不是台詞裡的每個字。每個附 `explain` 和 `example`。
   - `patterns`：3–4 個句型，id 用 `p1`、`p2`…。`th` 寫成「ทำให้ + 受詞 + 狀態」這種公式，各附 2 個例句。
   - `topic`、`level`、`titleZh` 填好；`tips` 可省略。
4. **完成標準**：每一句都有 `zh`，每個字都有 `rom` 和 `zh`。`patterns` 列的 id 都有定義，`p` 也都對得上。

## 驗證並交棒

1. 跑 `npm run build`，要通過。
2. 叫使用者開 `npm run dev`，到這首歌或這支影片的頁面校對：
   - 歌曲：老師模式可以隱藏句子、合併句子，按「編輯斷詞／音標／中文」修改，存檔寫回 JSON。
   - 影片：網址加 `?edit=1` 進校時模式，用「打起點」修正每句起點，再按「儲存回 JSON」。
   - 兩邊都可以看「🖥 投影片模式」和「🖨 列印講義」有沒有跑版。
3. 回報：做了幾句、哪些句子標了 `guess`、`note` 記了哪些字幕問題、哪些音標是網站查不到自己補的。
4. **停在這裡**，等老師校對完。使用者說要 commit 才 commit；commit 只放這支影片或歌曲的 JSON（和圖片）。
