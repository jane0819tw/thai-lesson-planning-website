#!/bin/bash
# 在 Wikimedia Commons 找可授權的圖片：列出檔名｜授權｜作者｜說明｜960px 縮圖網址
# 用法：bash find-image.sh "mango sticky rice" ["Thai iced tea" ...]
# 挑好後：curl -sL -A "thai-lesson-site/0.1" -o <檔名>.jpg <縮圖網址>，實際看過內容再用；credit 寫「照片：作者 / 授權（Wikimedia Commons）」
for q in "$@"; do
  echo "### $q"
  curl -s -G "https://commons.wikimedia.org/w/api.php" -A "thai-lesson-site/0.1 (teaching material)" \
    --data-urlencode action=query --data-urlencode format=json --data-urlencode generator=search \
    --data-urlencode gsrnamespace=6 --data-urlencode gsrlimit=8 --data-urlencode "gsrsearch=$q filetype:bitmap" \
    --data-urlencode prop=imageinfo --data-urlencode "iiprop=url|extmetadata|size" --data-urlencode iiurlwidth=960 |
  python3 -c '
import json, re, sys
strip = lambda s: re.sub("<[^>]+>", "", s).strip()
for p in json.load(sys.stdin).get("query", {}).get("pages", {}).values():
    ii = p["imageinfo"][0]; m = ii["extmetadata"]
    print(" | ".join([p["title"][5:70], m.get("LicenseShortName", {}).get("value", "?"), strip(m.get("Artist", {}).get("value", ""))[:30],
                      str(ii["width"]) + "x" + str(ii["height"]), strip(m.get("ImageDescription", {}).get("value", ""))[:60], ii.get("thumburl", "").split("?")[0]]))
'
done
