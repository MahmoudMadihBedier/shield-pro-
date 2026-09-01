/**
 * Bundle the `shield-server` Appwrite Function into a single self-contained
 * `dist/main.js`.
 *
 * The Function ships as an isolated directory, but it legitimately shares the
 * framework-free `src/core/*` logic (reference-id format, doc-status rules,
 * document envelope) and the `functions/routes/*` handlers. esbuild inlines
 * those at build time so there is exactly one source of truth and nothing is
 * vendored by hand.
 *
 * `node-appwrite` and `zod` stay external — Appwrite installs them from the
 * function's package.json during the build step, keeping the bundle tiny.
 *
 * Usage: `pnpm fn:build` (also runs before deploy).
 */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))
const srcAlias = fileURLToPath(new URL('../src', import.meta.url))

export const FUNCTION_DIR = 'server'

async function main() {
  await build({
    entryPoints: [`${root}${FUNCTION_DIR}/src/main.ts`],
    outfile: `${root}${FUNCTION_DIR}/dist/main.js`,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    external: ['node-appwrite', 'zod'],
    alias: { '@': srcAlias },
    logLevel: 'info',
  })
  console.log(`✓ ${FUNCTION_DIR} → dist/main.js`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
