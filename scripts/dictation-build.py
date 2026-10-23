#!/usr/bin/env python3
"""聽寫片段候選：抓 YouTube 手動泰文字幕 → 斷詞 → 比對各課的字 → 存到 data/dictation/

用法：
  python scripts/dictation-build.py <videoId> [課次 ...] [--reset] [--playlist=<清單ID>]
  python scripts/dictation-build.py pBl9uKcZFXo 1 2 3 4 5

標示兩種字（hits[].source）：
  講義：講義上列出的字（子音／母音例字、vocab、練習、作業）
  規則：講義沒列，但整個字只由「該課為止學過的子音＋母音」組成的單音節開音節字。
        該字在哪一課才第一次拼得出來，就歸在那一課（例如 ขา 歸 L4）。

重跑不會蓋掉人工審過的結果：既有片段（含你編輯過的）原樣保留，
admin 頁刪除的片段記在 rejected，不會再被加回來；--reset 只清掉這支影片「還沒審過」的片段。

需要：pip install youtube-transcript-api pythainlp
輸出：
  data/dictation/videos.json                影片清單（標題、頻道、連結、字幕種類；已有的欄位不會被覆蓋，備註可自己改）
  data/dictation/subtitles/<videoId>.json   原始字幕快取
  data/dictation/candidates/lesson-NN.json  { lesson, clips[], rejected[] }
"""
import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

from pythainlp.corpus.common import thai_words
from pythainlp.tokenize import word_tokenize
from youtube_transcript_api import YouTubeTranscriptApi

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "dictation"
MIN_SEC, MAX_SEC = 1.5, 8.0
PER_WORD = 3        # 每個講義字最多留幾句
RULE_CLIPS = 40     # 每課規則字最多留幾句
TONE = "่้๊๋"
TONE_RE = re.compile(f"[{TONE}]")
THAI_RE = re.compile(r"[฀-๿]")
DICT = thai_words()  # 規則字必須是詞表裡的詞，而且前後相鄰的 token 也要是完整的詞，避免把 บอส 切出來的「บอ」當成規則字


def read_lesson(n):
    return json.loads((ROOT / "data" / "lessons" / f"lesson-{n:02d}.json").read_text())


def excluded_rule_words(n):
    """data/dictation/exclude.json 的「規則字不算」：該課不要當成規則字的詞（例如語氣詞 อ่ะ）。"""
    f = OUT / "exclude.json"
    if not f.exists():
        return set()
    return set(json.loads(f.read_text()).get("規則字不算", {}).get(str(n), []))


def listed_words(n):
    """講義上列出的字 → 出處。"""
    d = read_lesson(n)
    ws = {}

    def add(t, where):
        t = (t or "").strip()
        if t and THAI_RE.search(t):
            ws.setdefault(t, where)

    for key in ("consonants", "vowels"):
        for it in d.get(key, []):
            for w in it.get("words", []):
                add(w.get("thai"), "單字")
    for w in d.get("vocab", []):
        add(w.get("thai"), "單字")
    for p in d.get("practice", []):
        for it in p.get("items", []):
            add(it.get("thai"), "練習")
    for h in d.get("homework", []):
        add(h if isinstance(h, str) else h.get("thai"), "作業")
    return ws


def build_rule_table():
    """回傳 (consonant→課次, [(母音樣式 regex 片段, 課次)])。課次 = 該元素第一次出現的那一課。"""
    cons, vowels = {}, []
    for n in range(1, 11):
        d = read_lesson(n)
        for c in d.get("consonants", []):
            cons.setdefault(c["char"], n)
        for v in d.get("vowels", []):
            for f in (v.get("short"), v.get("long")):
                if f and "-" in f:
                    vowels.append((f, n))
    vowels.append(("-อ", 1))  # L1 的長母音 อ（กอ），講義的 vowels 欄位沒有
    seen, uniq = set(), []
    for f, n in vowels:
        if f not in seen:
            seen.add(f)
            uniq.append((f, n))
    return cons, uniq


def rule_lesson(token, cons, vowels):
    """token 是『一個初子音＋一個母音（可加聲調符號）』就回傳最早能拼出它的課次，否則 None。"""
    t = TONE_RE.sub("", token)
    if not t:
        return None
    best = None
    for pat, vn in vowels:
        pre, post = pat.split("-", 1)
        if not (t.startswith(pre) and t.endswith(post)):
            continue
        mid = t[len(pre):len(t) - len(post)] if post else t[len(pre):]
        if len(mid) == 1 and mid in cons:
            n = max(vn, cons[mid])
            best = n if best is None else min(best, n)
    return best


def fetch(video_id):
    cache = OUT / "subtitles" / f"{video_id}.json"
    if cache.exists():
        return json.loads(cache.read_text())
    tr = YouTubeTranscriptApi().fetch(video_id, languages=["th"])
    items = [{"start": s.start, "duration": s.duration, "text": s.text} for s in tr.snippets]
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(items, ensure_ascii=False, indent=1))
    return items


def oembed(video_id):
    """YouTube 公開的 oEmbed：不需要金鑰，只給標題和頻道名稱。失敗就回空，不影響主流程。"""
    url = "https://www.youtube.com/oembed?format=json&url=" + urllib.parse.quote(
        f"https://www.youtube.com/watch?v={video_id}", safe="")
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            j = json.loads(r.read())
        return {"title": j.get("title", ""), "channel": j.get("author_name", "")}
    except Exception:
        return {}


def register_video(video_id, subs, playlist=None):
    """把影片登記到 data/dictation/videos.json（只補沒有的欄位，不覆蓋你改過的）。"""
    f = OUT / "videos.json"
    data = json.loads(f.read_text()) if f.exists() else {"videos": []}
    entry = next((v for v in data["videos"] if v["id"] == video_id), None)
    if entry is None:
        entry = {"id": video_id}
        data["videos"].append(entry)
    if not entry.get("title"):
        entry.update({k: v for k, v in oembed(video_id).items() if v})
    if "subtitle" not in entry:
        try:
            t = next(iter(t for t in YouTubeTranscriptApi().list(video_id) if t.language_code == "th"))
            entry["subtitle"] = {"lang": "th", "kind": "自動" if t.is_generated else "手動"}
        except Exception:
            pass
    last = subs[-1] if subs else None
    entry.setdefault("url", f"https://www.youtube.com/watch?v={video_id}")
    entry.setdefault("subtitleMinutes", round((last["start"] + last["duration"]) / 60) if last else 0)
    entry.setdefault("sentences", len(subs))
    entry.setdefault("addedAt", date.today().isoformat())
    entry.setdefault("note", "")
    if playlist:
        entry["playlist"] = f"https://www.youtube.com/playlist?list={playlist}"
    f.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    return entry


def clean(text):
    text = re.sub(r"\[.*?\]", "", text)           # [เพลง] 之類
    text = re.sub(r"(^|\n)\s*-\s*", r"\1", text)  # 對話開頭的 -
    return re.sub(r"\s+", " ", text).strip()


def whole_word(tok):
    """相鄰的 token 是不是一個完整的詞：非泰文（空格、標點、英文）、ๆ ฯ、或詞表裡的多字詞。
    單一個泰文字母或不在詞表的片段，代表旁邊的詞被切碎了（例如 บอส 切成 บอ＋ส）。"""
    if not THAI_RE.search(tok) or tok in ("ๆ", "ฯ"):
        return True
    return len(tok) > 1 and tok in DICT


def inside_longer_word(text, a, b):
    """text[a:b] 往前或往後多接 1~4 個字元，就能組成詞表裡更長的詞 → 它多半是被切碎的詞的一部分
    （斷詞器把 บอกว่า 切成 บอ＋กว่า，兩邊都是詞，光看相鄰 token 擋不住）。"""
    for k in range(1, 5):
        if text[a:b + k] in DICT and b + k <= len(text) and THAI_RE.search(text[b:b + k]):
            return True
        if a - k >= 0 and text[a - k:b] in DICT and THAI_RE.search(text[a - k:a]):
            return True
    return False


def find_hits(text, listed, lesson, cons, vowels, skip=frozenset()):
    """用預設斷詞，連續 1~3 個 token 合起來等於講義字才算（避免 ห้า 誤中 ห้าม）。"""
    toks, pos = [], 0
    for t in word_tokenize(text, keep_whitespace=True):
        toks.append((t, pos, pos + len(t)))
        pos += len(t)
    taken, hits = set(), []
    # 講義字：長的優先
    for k in (3, 2, 1):
        for i in range(len(toks) - k + 1):
            seg = toks[i:i + k]
            if any(s[0].isspace() for s in seg):
                continue
            w = "".join(s[0] for s in seg)
            span = range(seg[0][1], seg[-1][2])
            if w in listed and not taken.intersection(span):
                taken.update(span)
                hits.append({"word": w, "from": seg[0][1], "to": seg[-1][2], "source": "講義"})
    # 規則字：單一 token、剛好在這一課才拼得出來
    for i, (t, a, b) in enumerate(toks):
        if t.isspace() or taken.intersection(range(a, b)):
            continue
        neighbors = [toks[j][0] for j in (i - 1, i + 1) if 0 <= j < len(toks)]
        if t in DICT and t not in skip and all(whole_word(x) for x in neighbors) and not inside_longer_word(text, a, b) and rule_lesson(t, cons, vowels) == lesson:
            taken.update(range(a, b))
            hits.append({"word": t, "from": a, "to": b, "source": "規則"})
    return sorted(hits, key=lambda h: h["from"])


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    reset = "--reset" in sys.argv
    playlist = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--playlist=")), None)
    video_id = args[0]
    lessons = [int(x) for x in args[1:]] or [4]
    subs = fetch(video_id)
    v = register_video(video_id, subs, playlist)
    print(f"影片：{v.get('title', video_id)}（{v.get('channel', '?')}，字幕{v.get('subtitle', {}).get('kind', '?')}）")
    cons, vowels = build_rule_table()

    sentences = []
    for s in subs:
        text = clean(s["text"])
        if text and MIN_SEC <= s["duration"] <= MAX_SEC:
            sentences.append({"start": round(s["start"], 1),
                              "end": round(s["start"] + s["duration"], 1), "text": text})

    for n in lessons:
        listed = listed_words(n)
        skip = excluded_rule_words(n)
        found = []
        for sen in sentences:
            hits = find_hits(sen["text"], listed, n, cons, vowels, skip)
            if hits:
                found.append({"id": f"{video_id}@{sen['start']}", "videoId": video_id,
                              "start": sen["start"], "end": sen["end"], "text": sen["text"],
                              "hits": hits})
        length = lambda c: c["end"] - c["start"]
        keep = {}
        by_word = {}
        for c in found:
            for h in c["hits"]:
                if h["source"] == "講義":
                    by_word.setdefault(h["word"], []).append(c)
        for w, cs in by_word.items():
            for c in sorted(cs, key=lambda c: (length(c), -len(c["hits"])))[:PER_WORD]:
                keep[c["id"]] = c
        ruled = [c for c in found if any(h["source"] == "規則" for h in c["hits"])]
        score = lambda c: (-len({h["word"] for h in c["hits"]}), length(c))
        for c in sorted(ruled, key=score)[:RULE_CLIPS]:
            keep[c["id"]] = c

        out = OUT / "candidates" / f"lesson-{n:02d}.json"
        old = {"lesson": n, "clips": [], "rejected": []}
        if out.exists():
            j = json.loads(out.read_text())
            if "clips" in j:
                old = j
        rejected = set(old.get("rejected", []))
        clips = [c for c in old["clips"]
                 if not (reset and c["videoId"] == video_id and not c.get("reviewed"))]
        have = {c["id"] for c in clips}
        added = 0
        for cid, c in sorted(keep.items(), key=lambda kv: kv[1]["start"]):
            if cid not in have and cid not in rejected:
                clips.append(c)
                added += 1
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps({"lesson": n, "clips": clips, "rejected": sorted(rejected)},
                                  ensure_ascii=False, indent=1))
        nl = sum(1 for c in clips for h in c["hits"] if h["source"] == "講義")
        nr = sum(1 for c in clips for h in c["hits"] if h["source"] == "規則")
        print(f"L{n}: 新增 {added} 句，共 {len(clips)} 句（講義字標示 {nl}、規則字標示 {nr}）→ {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
