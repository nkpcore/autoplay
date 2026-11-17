import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in PartyAux component tree:', error, errorInfo)
  }

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-red-950/80 border border-red-700/60 text-red-400 mx-auto flex items-center justify-center text-xl font-bold">
              !
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-black text-white">Something interrupted the music</h2>
              <p className="text-zinc-400 text-xs">
                {this.state.error?.message || 'An unexpected playback or application error occurred.'}
              </p>
            </div>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.href = '/'
              }}
              className="w-full py-3 px-6 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-bold rounded-xl text-sm shadow cursor-pointer transition-all"
            >
              Return to Home
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
export default ErrorBoundary
