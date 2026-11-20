import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/** Keeps the app usable (and honest) if anything in the tree throws. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('MeshMaps crash:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#070a10] p-6 text-[#e8edf6]">
        <div className="panel-solid w-full max-w-[460px] p-5">
          <div className="mb-1 text-[14px] font-semibold">Что-то пошло не так</div>
          <p className="muted mb-3 text-[12px] leading-relaxed">
            Интерфейс упал на этапе рендера. Данные разметки сохранены в IndexedDB — перезагрузка их не потеряет.
          </p>
          <pre className="mb-3 max-h-[140px] overflow-auto rounded-lg bg-black/40 p-2 font-mono text-[10.5px] text-[#f87171]">
            {this.state.error.message}
          </pre>
          <div className="flex gap-2">
            <button className="btn btn-primary !text-[12px]" onClick={() => location.reload()}>
              Перезагрузить
            </button>
            <button className="btn !text-[12px]" onClick={() => this.setState({ error: null })}>
              Попробовать снова
            </button>
          </div>
        </div>
      </div>
    )
  }
}
