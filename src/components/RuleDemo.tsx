import type { DemoTile } from '../types'
import SpeakButton from './SpeakButton'
import WordIcon from './WordIcon'

// 規則說明裡的小圖解：[ก] ＋ [อ] ＝ [กอ]
export default function RuleDemo({ tiles }: { tiles: DemoTile[] }) {
  return (
    <div className="ruledemo">
      {tiles.map((t, i) => (
        <div className="rd-item" key={i}>
          {t.op && <span className="rd-op">{t.op}</span>}
          <div className="rd-tile">
            {t.icon && <WordIcon char={t.icon} size={40} />}
            <span className="th rd-th">{t.th}</span>
            {(t.sub || t.speak) && (
              <span className="rd-sub small muted">{t.sub}{t.speak && <SpeakButton text={t.speak} />}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
