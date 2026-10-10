// 例字圖示：data/icons.json 把子音對到 Twemoji 的檔名（public/icons/<碼>.svg）。
// 圖示來源 Twemoji（CC-BY 4.0）。要換圖：改 JSON 的碼，並把 SVG 放進 public/icons/ 即可。
import raw from '../data/icons.json'

const map = raw as Record<string, string>
export function getIconUrl(char: string): string | undefined {
  const code = map[char]
  return code ? `${import.meta.env.BASE_URL}icons/${code}.svg` : undefined
}
