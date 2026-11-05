#!/bin/bash
# 把認字課一個單元的可列印講義輸出成 PDF：public/handouts/reading-<單元>.pdf（1＝L1–L5）
# 用法：scripts/gen-handout.sh 1 [port]   （dev server 要先開著，port 預設 5173；vite 只聽 IPv6，所以網址用 [::1]）
set -e
unit=${1:?用法：scripts/gen-handout.sh <單元> [port]}
port=${2:-5173}
cd "$(dirname "$0")/.."
mkdir -p public/handouts
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --user-data-dir="$(mktemp -d)" --no-pdf-header-footer \
  --virtual-time-budget=20000 --run-all-compositor-stages-before-draw \
  --print-to-pdf="public/handouts/reading-$unit.pdf" "http://[::1]:$port/#/reading/handout/$unit" 2>/dev/null
echo "public/handouts/reading-$unit.pdf"
