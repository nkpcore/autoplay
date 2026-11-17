import { create } from 'zustand'

interface ToastState {
  message: string | null
  showToast: (message: string) => void
  hideToast: () => void
}

let timeoutId: ReturnType<typeof setTimeout> | null = null

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  showToast: (message: string) => {
    if (timeoutId) clearTimeout(timeoutId)
    set({ message })
    timeoutId = setTimeout(() => {
      set({ message: null })
      timeoutId = null
    }, 3000)
  },
  hideToast: () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    set({ message: null })
  },
}))

export const showToast = (message: string) => {
  useToastStore.getState().showToast(message)
}
