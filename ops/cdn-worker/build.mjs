// Builds dist/worker.js — the plain-JS Worker to paste into the Cloudflare dashboard.
// Run from the repo root: node ops/cdn-worker/build.mjs
import { buildSync } from 'esbuild'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

export function buildWorker() {
  const out = buildSync({
    entryPoints: [join(here, 'src', 'index.ts')],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    legalComments: 'inline',
    logLevel: 'silent',
  }).outputFiles[0].text
  return `// GENERATED from src/index.ts by build.mjs — do not edit by hand.\n${out}`
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(join(here, 'dist'), { recursive: true })
  writeFileSync(join(here, 'dist', 'worker.js'), buildWorker())
  console.log('ops/cdn-worker/dist/worker.js written')
}
