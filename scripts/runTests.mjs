import { build } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

// Shim browser globals for Node test run
globalThis.window = globalThis

const outDir = path.resolve('.tmp-test')

try {
  await build({
    build: {
      ssr: 'scripts/testEngine.ts',
      outDir,
      emptyOutDir: true,
      logLevel: 'warn',
    },
  })

  // Convert to file URL for Windows compatibility
  const testPath = path.resolve(outDir, 'testEngine.js')
  const fileUrl = new URL(`file:///${testPath.replace(/\\/g, '/')}`)
  await import(fileUrl.href)
} finally {
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true })
  }
}
