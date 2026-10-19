import { Component } from 'react'
import type { ReactNode } from 'react'

// 畫面渲染出錯時顯示錯誤訊息，而不是整頁空白
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="card" role="alert">
        <h3>這個頁面發生錯誤</h3>
        <p className="muted small">{this.state.error.message}</p>
        <button className="gbtn" onClick={() => location.reload()}>重新整理</button>
      </div>
    )
  }
}
