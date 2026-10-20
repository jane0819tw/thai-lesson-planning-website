"""批次產生課程發音 mp3（edge-tts，th-TH-PremwadeeNeural）。
用法：python3 scripts/gen-audio.py lesson-01 [lesson-02 ...] [--only 詞1 詞2 ...]
      --only：只處理列出的詞，並強制重生（會覆蓋已存在的檔案）
輸出：public/audio/<hash>.mp3 與 public/audio/manifest.json（泰文文字 → 檔名）。
前端 speak(text) 會先查 manifest，有檔就播 mp3，否則退回瀏覽器語音。
已存在的檔案會略過；要重做某個詞，刪掉對應 mp3 與 manifest 條目再執行。
"""
import asyncio, hashlib, json, pathlib, re, sys, edge_tts
from gtts import gTTS  # pip install gTTS；非官方管道，公開／商用前見 docs/audio-rerecord.md

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "audio"
VOICE = "th-TH-PremwadeeNeural"
RATE = "-20%"
BARE_RATE = "-45%"  # 單獨「子音＋อ」音節單唸會太短促，用更慢的語速拉長

is_note = lambda s: s == "x" or s == "(x)" or "不發音" in s or s.startswith("用")
name_text = lambda s: re.sub(r"\s+", "", s)  # 同 src/audio/speak.ts 的 nameText

# 單一符號（ะ า）直接念符號本身；多個符號（เ-ะ）會被拆成兩個母音，改寫成「เอะ」（同 src/strokes.ts 的 vowelSpeech）
vowel_speech = lambda f: f.replace("-", "อ") if len(f.replace("-", "")) > 1 or f.replace("-", "") == "อ" else f.replace("-", "")  # 單獨 อ 會被念成子音名稱，補成 ออ

# 個別詞指定來源（優先於自動規則）：聽過覺得某個來源唸得不對時，在這裡換成另一個
FORCE_GTTS = {"โก๋แก่", "เออเออ"}
FORCE_EDGE = {"เตอ"}

gtts_texts = set()  # 以 อ 當載體的單獨母音（อะ、อา、เอะ…）與母音卡的短／長音例字（กะ、กา…）：edge-tts 會唸跑掉，改用 gTTS

def collect(lesson):
    texts = set()
    synth_override = {}
    for c in lesson.get("consonants", []):
        texts.add(name_text(c["name"]))
        synth_override[name_text(c["name"])] = c["name"]  # 名稱中間的空格保留，第一個音節的聲調才會正確
        texts.add(c["char"])
        texts.update(w["thai"] for w in c.get("words", []))
    for v in lesson.get("vowels", []):
        syl = v.get("shortSyllables", []) + v.get("longSyllables", [])  # 母音卡的短音／長音例字也走 gTTS
        gtts_texts.update(syl); texts.update(syl)
        vs = {vowel_speech(f) for f in (v.get("short"), v.get("long")) if f}  # 母音單獨念；同 src/strokes.ts 的 vowelSpeech
        gtts_texts.update(vs); texts.update(vs)  # 單獨母音走 gTTS
        texts.update(w["thai"] for w in v.get("words", []))
    texts.update(w["thai"] for w in lesson.get("vocab", []))
    for r in lesson.get("rules", []):
        texts.update(t["speak"] for t in r.get("demo", []) if t.get("speak"))
    for t in lesson.get("toneTables", []):
        for row in t["rows"]:
            texts.update(re.sub(r"\s*\(x\)", "", c) for c in row["cells"] if not is_note(c))
    for g in lesson.get("practice", []):
        texts.update(i["thai"] for i in g.get("items", []))
    return {t.strip() for t in texts if t and t.strip()}, synth_override

BPS, FR = 6000, 144  # edge-tts 輸出 48kbps mono mp3：每秒 6000 bytes，每個 frame 144 bytes
BARE = re.compile(r"^[ก-ฮ]อ$")  # 單獨的「子音＋อ」（กอ、จอ…）：TTS 單唸會偏低調，改取連唸三次的第一個

async def stream(text, rate):
    data, wb = b"", []
    async for m in edge_tts.Communicate(text, VOICE, rate=rate, boundary="WordBoundary").stream():
        if m["type"] == "audio": data += m["data"]
        else: wb.append((m["offset"] / 1e7, m["duration"] / 1e7))
    return data, wb

async def gen(text, f, synth=None):
    if text in gtts_texts:
        try:
            await asyncio.to_thread(lambda: gTTS(synth or text, lang="th").save(str(f)))
            return f.stat().st_size > 0
        except Exception as e:
            print("gTTS 失敗:", text, e); f.unlink(missing_ok=True); return False
    for rate in (RATE, RATE, "+0%"):
        try:
            if BARE.match(text):
                data, wb = await stream(f"{text} {text} {text}", BARE_RATE)
                start = wb[0][0]
                end = wb[1][0]  # 切到第二個字開始前，保留完整尾音
                a = int(max(0, start - 0.03) * BPS) // FR * FR
                b = -(-int(end * BPS) // FR) * FR
                f.write_bytes(data[a:b])
            else:
                f.write_bytes((await stream(synth or text, rate))[0])
            return f.stat().st_size > 0
        except edge_tts.exceptions.NoAudioReceived:
            f.unlink(missing_ok=True)
    return False

async def main(ids, only=None):
    OUT.mkdir(parents=True, exist_ok=True)
    mf = OUT / "manifest.json"
    manifest = json.loads(mf.read_text(encoding="utf-8")) if mf.exists() else {}
    texts, synth = set(), {}
    for i in ids:
        t, o = collect(json.loads((ROOT / "data" / "lessons" / f"{i}.json").read_text(encoding="utf-8")))
        texts |= t; synth.update(o)
    gtts_texts.update(FORCE_GTTS); gtts_texts.difference_update(FORCE_EDGE)
    if only:
        texts = {t for t in texts if t in only}
        missing = set(only) - texts
        if missing: print("不在所選課程中，略過:", *sorted(missing))
    new = failed = 0
    made = set()  # 這次實際生成的詞（來源標記只對它們更新）
    for t in sorted(texts):
        name = hashlib.sha1(t.encode()).hexdigest()[:10] + ".mp3"
        f = OUT / name
        if not only and f.exists() and f.stat().st_size > 0:
            manifest[t] = name
            continue
        if await gen(t, f, synth.get(t)):
            manifest[t] = name; new += 1; made.add(t)
        else:
            failed += 1; print("FAILED:", t)
    sf = OUT / "sources.json"  # 記錄每段音檔的來源，之後整批換成官方服務或真人錄音時用
    srcs = json.loads(sf.read_text(encoding="utf-8")) if sf.exists() else {}
    for t in texts:
        if t in manifest and (t in made or t not in srcs):
            srcs[t] = "gtts" if t in gtts_texts else "edge-tts"
    sf.write_text(json.dumps(srcs, ensure_ascii=False, indent=0, sort_keys=True), encoding="utf-8")
    mf.write_text(json.dumps(manifest, ensure_ascii=False, indent=0, sort_keys=True), encoding="utf-8")
    print(f"{len(texts)} texts, {new} new, {failed} failed, manifest {len(manifest)} entries")

args = sys.argv[1:]
only = args[args.index("--only") + 1:] if "--only" in args else None
ids = [a for a in (args[:args.index("--only")] if only else args)] or ["lesson-01"]
asyncio.run(main(ids, only))
