#!/bin/bash
# 把一個單元的可列印講義輸出成 PDF（dev server 要先開著；vite 只聽 IPv6，所以網址用 [::1]）
#   認字課：scripts/gen-handout.sh 1 [port]          → public/handouts/reading-1.pdf（1＝L1–L5）
#   會話課：scripts/gen-handout.sh conv1:1 [port]    → public/handouts/conversation-1-1.pdf（會話 1 的第 1 單元）
#   時事補充：scripts/gen-handout.sh news:<id> [port] → public/handouts/news-<id>.pdf（id＝data/news/ 的檔名）
set -e
unit=${1:?用法：scripts/gen-handout.sh <單元|conv<級>:<單元>|news:<id>> [port]}
port=${2:-5173}
cd "$(dirname "$0")/.."
mkdir -p public/handouts
if [[ $unit =~ ^news:(.+)$ ]]; then
  out="public/handouts/news-${BASH_REMATCH[1]}.pdf"
  url="http://[::1]:$port/#/news/${BASH_REMATCH[1]}/handout"
elif [[ $unit =~ ^conv([0-9]+):([0-9]+)$ ]]; then
  out="public/handouts/conversation-${BASH_REMATCH[1]}-${BASH_REMATCH[2]}.pdf"
  url="http://[::1]:$port/#/conversation/${BASH_REMATCH[1]}/handout/${BASH_REMATCH[2]}"
else
  out="public/handouts/reading-$unit.pdf"
  url="http://[::1]:$port/#/reading/handout/$unit"
fi
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --user-data-dir="$(mktemp -d)" --no-pdf-header-footer \
  --virtual-time-budget=20000 --run-all-compositor-stages-before-draw \
  --print-to-pdf="$out" "$url" 2>/dev/null
echo "$out"
