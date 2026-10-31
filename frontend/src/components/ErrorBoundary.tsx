import { Component, type ErrorInfo, type ReactNode } from 'react'

export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('GRIDINAL interface error', error.message, info.componentStack)
  }
  render() {
    if (this.state.failed)
      return (
        <div className="query-state" role="alert">
          <h1>The workspace could not render</h1>
          <p>Reload to retry. No infrastructure changes have been applied.</p>
          <button className="button primary" onClick={() => window.location.reload()}>
            Reload workspace
          </button>
        </div>
      )
    return this.props.children
  }
}
