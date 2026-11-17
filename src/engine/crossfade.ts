export interface FadeHandle {
  cancel: () => void
  finishNow: () => void
}

export function equalPowerFade(opts: {
  durationMs: number
  stepMs: number
  onStep: (inGain: number, outGain: number) => void
  onDone: () => void
}): FadeHandle {
  const t0 = performance.now()
  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    window.clearInterval(id)
    opts.onStep(1, 0)
    opts.onDone()
  }
  const id = window.setInterval(() => {
    const p = Math.min(1, (performance.now() - t0) / opts.durationMs)
    opts.onStep(Math.sin((p * Math.PI) / 2), Math.cos((p * Math.PI) / 2))
    if (p >= 1) finish()
  }, opts.stepMs)
  return {
    cancel: () => {
      finished = true
      window.clearInterval(id)
    },
    finishNow: finish,
  }
}
