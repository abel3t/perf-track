import { injectManifest } from 'workbox-build'
import { existsSync } from 'fs'

// On Vercel, Nitro writes static assets directly to .vercel/output/static (not .output/public)
const staticDir = existsSync('.vercel/output/static') ? '.vercel/output/static' : '.output/public'
const swSrc = '.output/public/sw.js'
const swDest = `${staticDir}/sw.js`

const { count, size } = await injectManifest({
  swSrc,
  swDest,
  globDirectory: staticDir,
  globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
})

console.log(`SW manifest injected: ${count} files (${size} bytes) → ${swDest}`)
