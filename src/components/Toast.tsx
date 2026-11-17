import { useToastStore } from '../state/useToast'

export default function Toast() {
  const message = useToastStore((s) => s.message)

  if (!message) return null

  return (
    <div
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none max-w-sm w-full px-4"
    >
      <div className="bg-[#18181b]/95 text-white text-sm font-medium py-3 px-4 rounded-xl shadow-2xl border border-white/10 backdrop-blur-md text-center whitespace-pre-line animate-fade-in pointer-events-auto">
        {message}
      </div>
    </div>
  )
}
