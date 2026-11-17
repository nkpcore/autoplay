import { estimateBpm } from './bpm'

self.onmessage = (e: MessageEvent<{ mono: Float32Array; sampleRate: number }>) => {
  const { mono, sampleRate } = e.data
  const result = estimateBpm(mono, sampleRate)
  self.postMessage(result)
}
