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

- **封面**：L 幾＋課名＋`summary`，`summary` 分點列出。
- **說明文字分點**：投影片裡的說明卡 `body` 遇到「。」「；」就換一點（括號、引號裡的不算），句尾標點拿掉；原本用 `\n` 分行的照舊。只影響投影片，課程頁不變。
- **子音**：一個字母一頁，大字母（點了看筆順）＋圖示＋名稱發音＋拼音＋中文＋類型。上方一排小圓圈列出這課所有子音：目前這個實心主色、講過的淡色，點了跳過去。
- **聲調總覽**（`toneIntro`）拆兩頁：聲調符號與音高、漢語對照（`<ToneIntro part="marks" | "compare">`）。
- **互動練習**（`games`）不放。
- **操作**：← → 空白鍵／翻頁筆換頁，Z 中文、R 拼音（隱藏時用 `visibility: hidden`，版面不跳），F 全螢幕，Esc 離開。滑到畫面最左邊（或按左下 ☰）出現縮圖列，點縮圖跳頁。
- **縮放**：內容先以 900px 寬排版、量尺寸（含超出的寬表格），再縮放放進舞台，最多放大 2.6 倍。`.pt-inner .tablewrap` 取消內捲動，寬表格才量得到、整頁一起縮。

## 每種區塊怎麼切頁

| 區塊 | 切法 | 狀態 |
|---|---|---|
| `diagram`（基本概念） | 概念說明卡、組成圖各一頁 | L1 已做 |
| `rules`（說明／聲調） | 每張說明卡一頁、聲調總覽兩頁、每張聲調表一頁 | L1 已做；`finalsIntro`、`vowelShifts`、`clusters` 總表還沒做 |
| `consonants` | 標 `at: "consonants"` 的說明卡各一頁，然後一個字母一頁 | L1 已做 |
| `vocab` | 整份單字一頁 | L1 已做 |
| `extras` | 一張補充卡一頁 | L1 已做 |
| `vowels`、`finals`、`unit-N`、`practice`、`memes`、`review` | 原則是一張卡一頁（一個母音、一個尾音、一組練習、一張梗圖）；複習的分頁卡一張一頁 | 還沒做，先提給老師看 |

課程頁的卡片寫在 `LessonPage.tsx` 元件裡面（例 `vowelCard`、`finalCard`）。投影片要用同一張卡時，先把它抽成獨立元件、兩邊共用，不要複製一份。

## 調整順序（課程頁和投影片一起變）

欄位定義在 `src/types.ts`，L1 用到的：

- `rules[].at: "concept"`：說明卡放進「基本概念」區塊（和音節組成圖一起，區塊排最前面）。`diagram.after` 填說明卡 id，組成圖排在那張卡後面；沒填排最前。
- `rules[].at: "consonants"`：說明卡放在「子音」區塊最上面（例：為什麼子音要搭配母音）。
- `tonesAfterConsonants: true`：「說明」區塊（聲調總覽、聲調表）排到子音後面、改叫「聲調」。

需要其他排法時，照這個做法在 `lessonTabs()` 加欄位，並把欄位補進這裡和 reading-lesson skill 的「分頁」段。

## 出界檢查

在 Chrome 用 `javascript_tool` 對目前這頁執行，`overflow` 要是 `false`：

```js
const st = document.querySelector('.pt-stage').getBoundingClientRect()
const el = document.querySelector('.pt-inner')
const r = el.getBoundingClientRect()
;({ zoom: el.style.zoom, overflow: r.left < st.left - 1 || r.right > st.right + 1 || r.top < st.top - 1 || r.bottom > st.bottom + 1, todo: !!document.querySelector('.pt-stage .pt-todo') })
```

換頁用 `computer` 按 `Right`。有圖片的頁要等圖片載入後再量（高度會變）。
