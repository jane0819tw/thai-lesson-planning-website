// 講義 PDF → 每頁 JPG＋文字（macOS 內建 PDFKit，不用裝 poppler）
// 用法：osascript -l JavaScript render-pdf.js <pdf> <輸出資料夾> [長邊像素=1400] [起頁] [迄頁]
//   例：osascript -l JavaScript render-pdf.js data/handouts/泰語認字L11-L15.pdf $SCRATCH/pages
//   要裁講義裡的圖時，指定那一頁用 2800 重轉：... $SCRATCH/pages 2800 4 4（輸出 hi04.jpg）
// 輸出：p01.jpg…（高解析度時 hi04.jpg…）與 text.txt（每頁以 ===== PAGE n ===== 分隔；泰文常掉字，以圖片為準）
ObjC.import('PDFKit'); ObjC.import('AppKit')
function run(argv) {
  const [pdf, out] = argv, px = Number(argv[2] || 1400)
  const doc = $.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(pdf))
  const from = Number(argv[3] || 1), to = Number(argv[4] || doc.pageCount)
  const prefix = px > 1400 ? '/hi' : '/p'
  let text = ''
  for (let i = from - 1; i < to; i++) {
    const p = doc.pageAtIndex(i)
    text += '\n===== PAGE ' + (i + 1) + ' =====\n' + (p.string.js || '')
    const r = p.boundsForBox($.kPDFDisplayBoxMediaBox)
    const s = px / Math.max(r.size.width, r.size.height)
    const img = p.thumbnailOfSizeForBox($.NSMakeSize(r.size.width * s, r.size.height * s), $.kPDFDisplayBoxMediaBox)
    const rep = $.NSBitmapImageRep.imageRepWithData(img.TIFFRepresentation)
    rep.representationUsingTypeProperties($.NSBitmapImageFileTypeJPEG, $({ NSImageCompressionFactor: 0.8 }))
      .writeToFileAtomically(out + prefix + String(i + 1).padStart(2, '0') + '.jpg', true)
  }
  if (px <= 1400) $(text).writeToFileAtomicallyEncodingError(out + '/text.txt', true, $.NSUTF8StringEncoding, null)
  return 'pages ' + doc.pageCount + '，輸出第 ' + from + '–' + to + ' 頁'
}
