"""用官方 Azure Speech 重生「有問題的音檔」，先產生試聽候選，老師選好再套用。

金鑰：在專案根目錄 .env.local 放
    AZURE_SPEECH_KEY=...
    AZURE_SPEECH_REGION=southeastasia   （建立資源時選的區域）
（*.local 已被 .gitignore 排除；金鑰不要貼進對話）

用法：
  python3 scripts/gen-audio-azure.py                 # 生成 docs/audio-rerecord.md 待處理清單裡所有詞的候選
  python3 scripts/gen-audio-azure.py พ้า เตอ         # 只生成指定的詞（manifest 的 key，子音名稱用連寫：ฃอฃวด）
  python3 scripts/gen-audio-azure.py --voices premwadee achara พ้า   # 指定聲音（預設三種都生）
  python3 scripts/gen-audio-azure.py --apply พ้า=achara เตอ=premwadee  # 把選定的候選蓋到正式音檔

候選輸出：public/audio/azure-preview/<詞的 hash>-<聲音>.mp3
試聽頁：  npm run dev 後開 /audio/azure-preview/index.html（每個詞：目前版本 vs 各聲音候選）
個別詞的 SSML 調整（語速、音高曲線、IPA、改寫合成文字）寫在 scripts/azure-ssml.json。
套用時檔名不變（manifest 不用改、前端不用改），sources.json 記成 azure:<聲音>。
"""
import hashlib, html, json, os, pathlib, re, shutil, sys, time, urllib.error, urllib.request
from xml.sax.saxutils import escape

ROOT = pathlib.Path(__file__).resolve().parent.parent
AUDIO = ROOT / "public" / "audio"
PREVIEW = AUDIO / "azure-preview"
VOICES = {"premwadee": "th-TH-PremwadeeNeural", "achara": "th-TH-AcharaNeural", "niwat": "th-TH-NiwatNeural"}
RATE = "-20%"  # 同 gen-audio.py
# 同 gen-audio.py 的 FORCE_SYNTH：畫面文字與實際要念的文字不同的
FORCE_SYNTH = {"ฃ": "ฃอ", "ฃอฃวด": "ขอ ฃวด", "ฉันกินชานม ๓ แก้ว": "ฉันกินชานม สาม แก้ว"}

name_text = lambda s: re.sub(r"\s+", "", s)
file_of = lambda key: hashlib.sha1(key.encode()).hexdigest()[:10]


def load_env():
    f = ROOT / ".env.local"
    if f.exists():
        for line in f.read_text(encoding="utf-8").splitlines():
            m = re.match(r"\s*([A-Z_]+)\s*=\s*(.*?)\s*$", line)
            if m: os.environ.setdefault(m[1], m[2].strip("'\""))
    key, region = os.environ.get("AZURE_SPEECH_KEY"), os.environ.get("AZURE_SPEECH_REGION")
    if not key or not region:
        sys.exit("找不到 AZURE_SPEECH_KEY／AZURE_SPEECH_REGION，請先寫進 .env.local")
    return key, region


def todo_words(manifest):
    """docs/audio-rerecord.md「待處理清單」表格第一欄 → (manifest key, 合成文字)"""
    doc = (ROOT / "docs" / "audio-rerecord.md").read_text(encoding="utf-8")
    section = doc.split("## 待處理清單", 1)[1].split("\n## ", 1)[0]
    out, skipped = {}, []
    for line in section.splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) < 4 or not re.search("[ก-๙]", cells[0]) or cells[0] == "泰文": continue
        for w in cells[0].split("、"):
            w = w.strip()
            for cand in (w, name_text(w), re.sub(r"^สระ", "", w)):
                if cand in manifest:
                    out.setdefault(cand, w if " " in w else cand); break
            else:
                skipped.append(w)
    if skipped: print("清單裡找不到對應音檔、略過:", *skipped)
    return out


def ssml(text, voice, o):
    inner = o.get("ssml")
    if not inner:
        body = escape(o.get("text", text))
        if o.get("ipa"): body = f'<phoneme alphabet="ipa" ph="{escape(o["ipa"])}">{body}</phoneme>'
        attrs = f' rate="{o.get("rate", RATE)}"'
        for k in ("pitch", "contour"):
            if o.get(k): attrs += f' {k}="{escape(o[k])}"'
        inner = f"<prosody{attrs}>{body}</prosody>"
    return (f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="th-TH">'
            f'<voice name="{voice}">{inner}</voice></speak>')


def synth(doc, key, region):
    req = urllib.request.Request(
        f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1", data=doc.encode("utf-8"),
        headers={"Ocp-Apim-Subscription-Key": key, "Content-Type": "application/ssml+xml",
                 "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3", "User-Agent": "lesson-audio"})
    for k in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r: return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 503) and k < 3: time.sleep(2 * (k + 1)); continue
            raise RuntimeError(f"HTTP {e.code}: {e.read().decode(errors='ignore')[:200]}")
        except urllib.error.URLError:
            if k < 3: time.sleep(2 * (k + 1)); continue
            raise


def write_index(manifest, overrides):
    """試聽頁：每個詞一列，目前版本 vs 各聲音候選，勾選後按「套用」（開發伺服器的 /__azure-apply）"""
    words = {file_of(k): k for k in manifest}
    by = {}
    for f in sorted(PREVIEW.glob("*.mp3")):
        h, v = f.stem.rsplit("-", 1)
        by.setdefault(h, {})[v] = f"{f.name}?v={int(f.stat().st_mtime)}"  # 重生後瀏覽器不會播到舊的
    items = [{"word": words[h], "current": manifest[words[h]], "cands": vs, "note": overrides.get(words[h], {}).get("text", "")}
             for h, vs in by.items() if h in words]
    items.sort(key=lambda x: x["word"])
    data = json.dumps({"items": items, "voices": list(VOICES)}, ensure_ascii=False).replace("</", "<\\/")
    (PREVIEW / "index.html").write_text(INDEX_HTML.replace("__DATA__", data), encoding="utf-8")


INDEX_HTML = """<!doctype html><meta charset="utf-8"><title>Azure 候選試聽</title>
<style>
body{font-family:sans-serif;padding:16px 16px 80px;margin:0}
table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px 8px;vertical-align:top}
th.w{font-size:24px;text-align:left}td.pick{cursor:pointer}td.on{background:#e6f4ea;outline:2px solid #34a853}
small{color:#666}.src{font-size:12px;color:#888}audio{height:32px;display:block;margin-top:4px}
#bar{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:1px solid #ccc;padding:10px 16px;display:flex;gap:12px;align-items:center}
button{font-size:16px;padding:6px 16px}#msg{white-space:pre-wrap;font-size:13px}
</style>
<h1>Azure 候選試聽</h1>
<p>點格子選要用的聲音（再點一次取消），選好按下方「套用」，會直接換掉網站上的正式音檔。綠底＝目前正式音檔已經是這個 Azure 聲音。</p>
<table id="t"><tr><th>詞</th><td>目前</td><td>不換</td><td>premwadee（女）</td><td>achara（女）</td><td>niwat（男）</td></tr></table>
<div id="bar"><button id="go" disabled>套用勾選的 0 個</button><span id="msg"></span></div>
<script>
const D = __DATA__, pick = {}
const t = document.getElementById('t'), go = document.getElementById('go'), msg = document.getElementById('msg')
let src = {}
const esc = s => s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))
function render() {
  t.querySelectorAll('tr.row').forEach(r => r.remove())
  for (const it of D.items) {
    const tr = document.createElement('tr'); tr.className = 'row'
    const applied = (src[it.word] || '').startsWith('azure:') ? src[it.word] : ''
    tr.innerHTML = `<th class="w" lang="th">${esc(it.word)}${it.note ? `<br><small>合成：${esc(it.note)}</small>` : ''}</th>`
      + `<td><span class="src">${esc(src[it.word] || '')}</span><audio controls preload="none" src="../${it.current}?t=${Date.now()}"></audio></td>`
      + `<td class="pick" data-v=""><label><input type="radio" name="${esc(it.word)}" value="" ${!pick[it.word] ? 'checked' : ''}> 不換</label></td>`
      + D.voices.map(v => it.cands[v]
          ? `<td class="pick ${applied.toLowerCase().includes(v) ? 'on' : ''}" data-v="${v}"><label><input type="radio" name="${esc(it.word)}" value="${v}" ${pick[it.word] === v ? 'checked' : ''}> 用這個</label><audio controls preload="none" src="${it.cands[v]}"></audio></td>`
          : '<td>—</td>').join('')
    tr.querySelectorAll('input').forEach(i => i.onchange = () => { if (i.value) pick[it.word] = i.value; else delete pick[it.word]; upd() })
    t.appendChild(tr)
  }
  upd()
}
function upd() { const n = Object.keys(pick).length; go.textContent = `套用勾選的 ${n} 個`; go.disabled = !n }
go.onclick = async () => {
  go.disabled = true; msg.textContent = '套用中…'
  try {
    const r = await fetch('/__azure-apply', { method: 'POST', body: JSON.stringify({ choices: pick }) })
    const j = await r.json()
    if (!j.ok) throw new Error(j.error)
    msg.textContent = j.log.trim(); for (const k in pick) delete pick[k]
    await load()
  } catch (e) { msg.textContent = '失敗：' + e.message + '（要用 npm run dev 開這頁才能套用）'; upd() }
}
async function load() { try { src = await (await fetch('../sources.json?t=' + Date.now())).json() } catch {} render() }
load()
</script>
"""


def main(args):
    manifest = json.loads((AUDIO / "manifest.json").read_text(encoding="utf-8"))
    sf = AUDIO / "sources.json"
    sources = json.loads(sf.read_text(encoding="utf-8")) if sf.exists() else {}

    if args and args[0] == "--apply":
        for pair in args[1:]:
            word, v = pair.split("=")
            src = PREVIEW / f"{file_of(word)}-{v}.mp3"
            if word not in manifest or not src.exists():
                print("找不到候選或正式音檔:", pair); continue
            shutil.copyfile(src, AUDIO / manifest[word])
            sources[word] = f"azure:{VOICES[v]}"
            print("已套用:", word, "←", VOICES[v])
        sf.write_text(json.dumps(sources, ensure_ascii=False, indent=0, sort_keys=True), encoding="utf-8")
        return

    voices = list(VOICES)
    if "--voices" in args:
        i = args.index("--voices"); j = i + 1
        while j < len(args) and args[j] in VOICES: j += 1
        voices, args = args[i + 1:j], args[:i] + args[j:]

    key, region = load_env()
    over_f = ROOT / "scripts" / "azure-ssml.json"
    overrides = {k: v for k, v in json.loads(over_f.read_text(encoding="utf-8")).items() if not k.startswith("_")} if over_f.exists() else {}
    words = {name_text(w) if name_text(w) in manifest else w: w for w in args} if args else todo_words(manifest)

    PREVIEW.mkdir(parents=True, exist_ok=True)
    ok = fail = 0
    for k, text in words.items():
        text = FORCE_SYNTH.get(k, text)
        o = overrides.get(k, {})
        for v in o.get("voices", voices):
            try:
                data = synth(ssml(text, VOICES[v], o), key, region)
                if not data: raise RuntimeError("空音訊")
                (PREVIEW / f"{file_of(k)}-{v}.mp3").write_bytes(data); ok += 1
            except Exception as e:
                fail += 1; print("FAILED:", k, v, e)
    write_index(manifest, overrides)
    print(f"{len(words)} 個詞，{ok} 個候選成功，{fail} 個失敗 → public/audio/azure-preview/index.html")


main(sys.argv[1:])
