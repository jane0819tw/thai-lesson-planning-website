#!/usr/bin/env python3
"""歌詞跟讀草稿：抓 YouTube 官方（手動）泰文字幕 → 每句字幕＝一句歌詞 → 斷詞 → 存成 data/songs/<id>.json

用法：
  python3 scripts/song-build.py <videoId> [--id=<頁面 id>] [--force]

規則：
  - 只用手動字幕；影片沒有手動泰文字幕就停止，不改用自動字幕。
  - 歌詞原文（lines[].th）一律照官方字幕，斷詞只切開不改字：words 接起來必須等於 th。
  - 起訖秒數照字幕；歌曲有間奏，所以每句都存 end。
  - 斷詞用 pythainlp newmm＋data/songs/words.txt（歌詞常見的口語、外來語；「-詞」＝從詞典拿掉，讓它被切開）。
    斷不好的地方老師在歌詞頁的編輯模式用「/」重新切。
  - 輸出是草稿（draft: true），音標與中文留空給老師填；學生的歌曲列表不會列出草稿。
  - 檔案已存在時不覆蓋（老師可能已經審過），要重做加 --force。

字幕快取放 data/dictation/subtitles/<videoId>.json（不進版本控制）。
"""
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

from pythainlp.corpus.common import thai_words
from pythainlp.tokenize import word_tokenize
from pythainlp.util import dict_trie
from youtube_transcript_api import YouTubeTranscriptApi

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "data" / "dictation" / "subtitles"
OUT = ROOT / "data" / "songs"
THAI_RE = re.compile(r"[฀-๿]")


def fetch_manual(video_id):
    """只抓手動泰文字幕；沒有就丟錯。"""
    cache = CACHE / f"{video_id}.json"
    if cache.exists():
        return json.loads(cache.read_text())
    tr = YouTubeTranscriptApi().list(video_id).find_manually_created_transcript(["th"]).fetch()
    items = [{"start": s.start, "duration": s.duration, "text": s.text} for s in tr.snippets]
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(items, ensure_ascii=False, indent=1))
    return items


def oembed(video_id):
    url = "https://www.youtube.com/oembed?format=json&url=" + urllib.parse.quote(
        f"https://www.youtube.com/watch?v={video_id}", safe="")
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            j = json.loads(r.read())
        return {"title": j.get("title", ""), "channel": j.get("author_name", "")}
    except Exception:
        return {}


def clean(text):
    text = re.sub(r"\[.*?\]|♪", "", text)  # [ดนตรี]、♪ 之類
    return re.sub(r"\s+", " ", text).strip()


def song_dict():
    f = OUT / "words.txt"
    lines = [l.strip() for l in f.read_text().splitlines()] if f.exists() else []
    add = {l for l in lines if l and not l.startswith(("#", "-"))}
    drop = {l[1:] for l in lines if l.startswith("-")}
    return dict_trie((set(thai_words()) | add) - drop)


DICT = song_dict()


def split_words(th):
    """斷詞：空白、標點併進前一個字，保證 ''.join(words) == th。"""
    words = []
    for tok in word_tokenize(th, custom_dict=DICT, engine="newmm", keep_whitespace=True):
        if words and (tok.isspace() or not re.search(r"\w", tok)):
            words[-1]["th"] += tok
        else:
            words.append({"th": tok, "rom": "", "zh": ""})
    assert "".join(w["th"] for w in words) == th
    return words


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    opts = dict(a[2:].split("=", 1) if "=" in a else (a[2:], "1") for a in sys.argv[1:] if a.startswith("--"))
    if len(args) != 1:
        sys.exit(__doc__)
    video_id = args[0]
    page_id = opts.get("id", f"song-{video_id}")
    out = OUT / f"{page_id}.json"
    if out.exists() and "force" not in opts:
        sys.exit(f"{out.relative_to(ROOT)} 已存在（可能已審過）；要重做請加 --force")

    try:
        subs = fetch_manual(video_id)
    except Exception as e:
        sys.exit(f"這支影片沒有手動泰文字幕，停止（{type(e).__name__}）")

    lines, skipped = [], 0
    for s in subs:
        th = clean(s["text"])
        if not THAI_RE.search(th):
            skipped += 1
            continue
        start = round(s["start"], 2)
        lines.append({"start": start, "end": round(start + s["duration"], 2), "th": th,
                      "zh": "", "words": split_words(th)})
    # 字幕的 duration 有時會蓋到下一句，截到下一句開始
    for a, b in zip(lines, lines[1:]):
        a["end"] = min(a["end"], b["start"])

    meta = oembed(video_id)
    last = subs[-1]
    doc = {
        "id": page_id, "kind": "song", "draft": True, "subtitleSource": "official",
        "title": meta.get("title", video_id), "titleZh": "", "artist": meta.get("channel", ""),
        "youtubeId": video_id, "duration": round(last["start"] + last["duration"]),
        "note": "歌詞照 YouTube 官方泰文字幕。",
        "lines": lines,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n")

    uniq = len({l["th"] for l in lines})
    print(f"✓ {out.relative_to(ROOT)}")
    print(f"  {doc['title']}｜{doc['artist']}｜{doc['duration']} 秒")
    print(f"  {len(lines)} 句（不重複 {uniq} 句，略過無泰文 {skipped} 句），共 {sum(len(l['words']) for l in lines)} 個字")


if __name__ == "__main__":
    main()
