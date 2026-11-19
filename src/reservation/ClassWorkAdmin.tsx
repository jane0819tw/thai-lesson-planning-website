import { useEffect, useMemo, useState } from 'react'
import type { getApi } from './api'
import type { ClassWorkItem } from './types'
import { WorkCard } from '../components/SubtitlePracticePage'
import { subPracticeByKey } from '../subtitlePractice'
import { homeworkLessonLabel } from '../reviews'
import '../dictation.css'

type Api = ReturnType<typeof getApi>
type Run = <T>(label: string, f: () => Promise<T>) => Promise<T>

// 管理頁「班級作業」：字幕聽打＋斷句解析。每份作業顯示參考句子、學生留言，老師寫回饋或留言。
export default function ClassWorkAdmin({ api, run, flash, onTodo }: { api: Api; run: Run; flash: (ok: boolean, text: string) => void; onTodo?: (n: number) => void }) {
  const [list, setList] = useState<ClassWorkItem[] | null>(null)
  const [key, setKey] = useState('')
  const [only, setOnly] = useState(true)
  const load = () => run('讀取班級作業中…', () => api.adminGetClassWork()).then(setList).catch(e => flash(false, (e as Error).message))
  useEffect(() => { if (!list) load() }, [list]) // eslint-disable-line react-hooks/exhaustive-deps

  const keys = useMemo(() => [...new Set((list ?? []).map(w => w.key))].sort((a, b) => Number(b.slice(1)) - Number(a.slice(1))), [list])
  const shown = (list ?? []).filter(w => (!key || w.key === key) && (!only || !w.feedback))
  const todo = (list ?? []).filter(w => !w.feedback).length
  useEffect(() => { if (list) onTodo?.(todo) }, [list, todo]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="bk-card">
      <div className="bk-row between">
        <h2 style={{ margin: 0 }}>班級作業{todo > 0 && <span className="bk-muted">（待回饋 {todo}）</span>}</h2>
        <button onClick={() => load()}>重新整理</button>
      </div>
      <p className="bk-muted">學生的字幕聽打＋斷句解析。團班同學送出後看得到彼此的作業和留言；你的回饋同班的人都看得到。學生的班級在「學生」分頁設定。資料存在試算表的「班級作業」「作業留言」分頁。</p>
      <div className="bk-row">
        <select value={key} onChange={e => setKey(e.target.value)}>
          <option value="">全部課</option>
          {keys.map(k => <option key={k} value={k}>{homeworkLessonLabel(k)}</option>)}
        </select>
        <label><input type="checkbox" checked={only} onChange={e => setOnly(e.target.checked)} /> 只看還沒回饋的</label>
      </div>
      {!list ? <p className="bk-muted">載入中…</p> : shown.length === 0 ? <p className="bk-muted">{list.length ? '沒有符合的作業。' : '還沒有學生送出班級作業。'}</p> : (
        <div className="dict" style={{ marginTop: 10 }}>
          {shown.map(w => (
            <WorkCard key={w.id} w={w} lines={subPracticeByKey(w.key)?.lines}>
              <span className="bk-muted small">{homeworkLessonLabel(w.key)}</span>
              <Reply w={w}
                onFeedback={t => run('儲存回饋中…', () => api.adminReplyClassWork(w.id, t)).then(() => { flash(true, `已回饋 ${w.name}`); load() }).catch(e => flash(false, (e as Error).message))}
                onComment={t => run('留言中…', () => api.adminCommentClassWork(w.id, t)).then(() => load()).catch(e => flash(false, (e as Error).message))} />
            </WorkCard>
          ))}
        </div>
      )}
    </div>
  )
}

function Reply({ w, onFeedback, onComment }: { w: ClassWorkItem; onFeedback: (t: string) => void; onComment: (t: string) => void }) {
  const [fb, setFb] = useState(w.feedback)
  const [c, setC] = useState('')
  return (
    <div className="sw-admin">
      <textarea rows={3} value={fb} onChange={e => setFb(e.target.value)} placeholder="老師回饋（批改、建議；學生和同班同學都看得到）" />
      <div className="bk-row">
        <button className="primary" disabled={fb.trim() === w.feedback} onClick={() => onFeedback(fb)}>{w.feedback ? '更新回饋' : '送出回饋'}</button>
        <input style={{ flex: 1, minWidth: 160 }} value={c} onChange={e => setC(e.target.value)} placeholder="或在留言串回覆某位同學…" />
        <button disabled={!c.trim()} onClick={() => { onComment(c.trim()); setC('') }}>留言</button>
      </div>
    </div>
  )
}
