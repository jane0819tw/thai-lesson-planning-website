---
name: lesson-slides
description: 把認字課的一課做成投影片模式（/reading/lesson/lesson-NN/present）：開放這課、補上還沒做成投影片的區塊、調整課程順序、驗證每頁不出界。當使用者要「做第 N 課的投影片」、「這課開投影片模式」、「投影片哪一頁出界／順序不對」時使用。
---

# 認字課投影片模式

投影片是課程頁的另一種排法：讀同一份 `data/lessons/lesson-NN.json`，用同樣的元件，**一張卡一頁**，內容自動縮放到填滿螢幕。程式在 `src/components/PresentPage.tsx`，樣式在 `src/styles.css` 的 `.present`／`.pt-*`。L1 是第一課、也是範本（2026-10-30 和老師一起定的）。

一次做一課。課程內容本身（講義 → 資料）是 reading-lesson skill 的事，這裡只管投影片。

## 流程

1. **列出這課的區塊**：區塊和順序來自 `LessonPage.tsx` 的 `lessonTabs()`，課程頁目錄和投影片共用。看 `PresentPage.tsx` 的 `SUPPORTED`，記下這課有哪些區塊還沒支援。
2. **先確認順序**：投影片的順序＝課程頁的順序。老師說投影片順序不對，就是**課程頁順序要改**（L1 老師：「不是投影片的順序改，L1 講義的順序也要改」），用資料欄位調（見「調整順序」），不在 `PresentPage` 另排一套。順序以 `summary` 的講法和講義為準，不確定就問老師。
3. **補上沒支援的區塊**：每個區塊照「每種區塊怎麼切頁」做進 `buildSlides()`，再加進 `SUPPORTED`。還沒定案的區塊先提一個切法給老師看。完成條件：整份投影片沒有任何一頁顯示「還沒做成投影片」（`.pt-todo`）。
4. **開放這課**：資料加 `"slides": true`，課程頁才會出現「▶ 投影片模式」按鈕。
5. **驗證**：`npx tsc --noEmit` 要過。`npm run dev` 後用 Chrome 開 `http://localhost:5173/#/reading/lesson/lesson-NN/present`（HashRouter，網址要有 `#/`），**每一頁**都跑一次下方「出界檢查」並截圖。完成條件：每頁都沒出界、沒有 `.pt-todo`。看完關掉自己開的分頁。Chrome 連不上時要明講「沒看過畫面」。
6. **回報**：列出投影片頁序（區塊＋頁數）、新切法是自己判斷的哪些、驗證看過哪幾頁。commit 等使用者說再做；commit 前把老師這次的修正寫回這份 skill。

## 已定的規格（L1）

- **封面**：L 幾＋課名＋`summary`，`summary` 用 `\n` 分點（L1：三點，第三點的「**聲調規則**」粗體）。
- **規則、重點字粗體**：說明文字裡講到規則或重點的字用 `**…**`（粗體＋主色），例：「由左至右」「分隔句子」「同音字母」「音節」（L1 老師 2026-11-05）。組成圖的 `intro` 也支援。
- **課程頁顯示、投影片不放**：說明卡設 `noSlide: true`（L1 曾用在「講義的拼音符號」，後來整張拿掉）。
- **說明卡排在某個字母後面**：`at: "consonants"` ＋ `afterLetter: "ก"`，投影片排在 ก 那頁後面、課程頁排在 ก 卡後面佔滿一列（L1：看完 ก 再解釋子音怎麼念，原本兩張說明卡合成一張，第 3 點和它的圖解放 `parts`，每段說明緊接著自己的圖解）。L4 老師：聲調規則接在第一個子音 ผ 後面（看完第一個高子音就講聲調，再繼續其他子音），說明和聲調表合成**一頁**：聲調表放進說明卡的 `toneTable`，不要拆成兩張卡、也不要用 `toneTables`＋`tonesAfterConsonants`。
- **例句**：說明卡 `sentence`（L1 文字系統的 สวัสดีค่ะ ฉันชื่อเจน）：一段一個 part、段內逐詞標中文，畫面標出空格與「由左至右」，整句有音檔（`gen-audio.py` 會收）。
- **聲調總覽**兩張卡放同一頁、上下排（`<ToneIntro />`，L1 老師試過左右並排，要上下）。點聲調符號開的筆順視窗用 portal 掛到 body，不會跟著投影片放大而超出畫面。
- **筆**：P 或右上「✏️ 筆」，三種顏色；每頁的筆跡存在這台電腦的 localStorage（`present-ink-<課>`，以頁碼為 key），換頁、離開再回來都還在，只有按「清除筆跡」才清掉；這頁有筆跡時才出現這個按鈕。頁序改了之後，舊筆跡會跑到別頁，要請老師清掉。筆跡座標是舞台的比例，打開補充筆記（舞台變窄）時會跟著變形。
- **補充筆記**：N 或「補充」，左邊跳出打字區（大字、泰文字型），內容存在這台電腦的 localStorage（每課分開），「清空」清掉。打字時鍵盤不換頁，Esc 跳出打字。
- **說明文字分點**：投影片裡的說明卡 `body` 遇到「。」「；」就換一點（括號、引號裡的不算），句尾標點拿掉；原本用 `\n` 分行的照舊。只影響投影片，課程頁不變。
- **子音**：一個字母一頁，大字母（點了看筆順）＋圖示＋名稱發音＋拼音＋中文＋類型。上方一排小圓圈列出這課所有子音：目前這個實心主色、講過的淡色，點了跳過去。有例字的字母（L4 起）：例字排在**右邊**（大字母｜資訊｜例字三欄），不是資訊下面；例字中文跟 Z；整組子音頁設 `uniform: 'letter'`，字母大小每頁一樣。
- **＊的字**：講義標＊的字（`star: true`）不顯示＊，改用黃色底（`.wstar`）標出，課程頁、投影片、列印都一樣（L4 老師）。
- **單字**（`vocab`）一個單字一頁：大字＋播放鈕＋中文（Z 開關）。不顯示拼音。
- **小結**（`recap`）一頁，排在單字之後、補充之前。
- **章節列**：上方常駐一排整課的章節（＝區塊，互動練習不算），目前這章主色實心、講過的淡色，點了跳到那章第一頁。不要另做章節頁（L1 老師試過，拿掉了）。左邊留給補充筆記和縮圖列，所以放上方。
- **中文預設不顯示**（整份投影片），老師按 Z 或「中文」才打開。
- **互動練習**（`games`）不放。
- **操作**：← → 空白鍵／翻頁筆換頁（任何視窗開著時不換頁、Esc 只關視窗），P 筆、N 補充，Z 中文、R 拼音（隱藏時用 `visibility: hidden`，版面不跳），F 全螢幕，Esc 離開。滑到畫面最左邊（或按左下 ☰）出現縮圖列，點縮圖跳頁。
- **同一組頁面寬度一致**：`Slide.uniform` 填同一個值的頁，會在看不見的 `.pt-measure` 裡一起排版、量出最大寬高，再用這個尺寸算縮放比例，所以整組大小一樣（目前用在母音頁、有例字的子音頁）。
- **縮放**：內容先以 900px 寬排版、量尺寸（含超出的寬表格），再縮放放進舞台，最多放大 2.6 倍。內容區每頁重建，ResizeObserver 要跟著換頁重新監看（不然圖片載入後不會重縮、會出界），縮放放到 requestAnimationFrame 裡做。`.pt-inner .tablewrap` 取消內捲動，寬表格才量得到、整頁一起縮。

## 每種區塊怎麼切頁

| 區塊 | 切法 | 狀態 |
|---|---|---|
| `diagram`（基本概念） | 概念說明卡、組成圖各一頁 | L1 已做 |
| `rules`（說明／聲調） | 每張說明卡一頁、聲調總覽兩頁、每張聲調表一頁 | L1 已做；`finalsIntro`、`vowelShifts`、`clusters` 總表還沒做 |
| `consonants` | 標 `at: "consonants"` 的說明卡各一頁，然後一個字母一頁；`afterLetter` 的說明卡接在那個字母後面 | L1、L4 已做 |
| `vowels` | `vowelIntro` 總覽一頁、`vowelNotes` 各一頁；每個母音：`heading` 一頁（有的話）→ `preface` 說明卡各一頁 → 母音卡一頁（大字點了看筆順、拼讀表、例字；中文跟 Z；例字有圖的圖放在格子右邊）→ `after` 說明卡各一頁（L2 拼讀規則接在 /a/ 後面）；`vocabAfterVowel` 的單字接在那個母音後面。母音頁設 `uniform: 'vowel'`，整組用同一個縮放比例（以最高的那頁為準），每頁寬度一樣（L2 老師：/u/ 例字少、被放得比較寬） | L2 已做；`sanskritVowels` 還沒做 |
| `vocab` | 一個單字一頁；有 `image` 的（L2 จู๋、ป้า）圖放在字的**右邊**（L2 老師） | L1、L2 已做 |
| `practice` | 一個詞一頁，同單字頁（大字＋播放＋中文跟 Z）；有好幾組時頁首寫「區塊・組名」（L2 老師：多音節練習也要一頁一頁） | L2 已做；句型還沒做 |
| `memes` | 一張補充卡一頁（`.pt-meme`，圖最高 440px） | L2 已做 |
| `recap` | 小結一頁 | L1 已做 |
| `extras` | 一張補充卡一頁 | L1 已做 |
| `finals`、`unit-N`、`review` | 原則是一張卡一頁（一個母音、一個尾音、一組練習、一張梗圖）；複習的分頁卡一張一頁 | 還沒做，先提給老師看 |

課程頁的卡片寫在 `LessonPage.tsx` 元件裡面（例 `finalCard`）。投影片要用同一張卡時，先把它抽成獨立元件、兩邊共用，不要複製一份：L2 已抽出 `src/components/LessonCards.tsx`（`VowelCard`、`VowelWords`、`PracticeItems`、`MemeCard`），新的共用卡也放這裡。

## 調整順序（課程頁和投影片一起變）

欄位定義在 `src/types.ts`，L1 用到的：

- `rules[].at: "concept"`：說明卡放進「基本概念」區塊（和音節組成圖一起，區塊排最前面）。`diagram.after` 填說明卡 id，組成圖排在那張卡後面；沒填排最前。
- `rules[].at: "consonants"`：說明卡放在「子音」區塊最上面（例：為什麼子音要搭配母音）。
- `tonesAfterConsonants: true`：「說明」區塊（聲調總覽、聲調表）排到子音後面、改叫「聲調」。

需要其他排法時，照這個做法在 `lessonTabs()` 加欄位，並把欄位補進這裡和 reading-lesson skill 的「分頁」段。

## 出界檢查

dev server 的 port 以實際啟動的為準（`lsof -nP -iTCP -sTCP:LISTEN`，L1 這次是 5175）。在 Chrome 用 `javascript_tool` 對目前這頁執行，`overflow` 要是 `false`：

```js
const st = document.querySelector('.pt-stage').getBoundingClientRect()
const el = document.querySelector('.pt-inner')
const r = el.getBoundingClientRect()
;({ zoom: el.style.zoom, overflow: r.left < st.left - 1 || r.right > st.right + 1 || r.top < st.top - 1 || r.bottom > st.bottom + 1, todo: !!document.querySelector('.pt-stage .pt-todo') })
```

換頁用 `computer` 按 `Right`。有圖片的頁要等圖片載入後再量（高度會變）。
