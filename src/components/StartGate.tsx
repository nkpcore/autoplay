import React from 'react'

interface StartGateProps {
  onStart: () => void | Promise<void>
  title?: string
  subtitle?: string
}

export const StartGate: React.FC<StartGateProps> = ({
  onStart,
  title = 'Ready to start?',
  subtitle = 'Tap below to unlock audio and begin playback.',
}) => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-6 text-center">
      <div className="max-w-md w-full space-y-6">
        <div className="space-y-2">
          <h2 className="text-3xl font-extrabold text-white tracking-tight">{title}</h2>
          <p className="text-zinc-400 text-sm">{subtitle}</p>
        </div>

        <button
          onClick={onStart}
          type="button"
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-400 hover:via-purple-500 hover:to-indigo-500 text-white font-bold text-lg shadow-lg shadow-purple-500/25 transition-all transform active:scale-95 cursor-pointer"
        >
          Start the Party &rarr;
        </button>
      </div>
    </div>
  )
}
export default StartGate
