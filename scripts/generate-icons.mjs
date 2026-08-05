import { mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.resolve(import.meta.dirname, '..')
const BRAND_NAVY = '#2B3A67'
const CANVAS = 512
const MARK_PATH = path.join(ROOT, 'public/brand/mark-light.png')

/** Composites the Edugistics mark onto a navy rounded-square canvas at the given size. */
async function buildIcon({ file, size, radius, markScale }) {
  // Intermediate files (rather than in-memory Buffers) are used for the
  // composite inputs — sharp/libvips in this environment mis-validates
  // Buffer dimensions during composite() and rejects an in-bounds overlay.
  const markTmp = path.join(os.tmpdir(), `edugistics-mark-${size}.png`)
  const bgTmp = path.join(os.tmpdir(), `edugistics-bg-${size}.png`)

  await sharp(MARK_PATH)
    .resize({ width: Math.round(CANVAS * markScale), fit: 'inside' })
    .png()
    .toFile(markTmp)
  const markMeta = await sharp(markTmp).metadata()

  const backgroundSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}">
    <rect width="${CANVAS}" height="${CANVAS}" rx="${radius}" ry="${radius}" fill="${BRAND_NAVY}" />
  </svg>`
  await sharp(Buffer.from(backgroundSvg)).png().toFile(bgTmp)

  const left = Math.round((CANVAS - markMeta.width) / 2)
  const top = Math.round((CANVAS - markMeta.height) / 2)

  // Composite and resize are kept as separate pipelines — chaining resize()
  // straight after composite() trips the same libvips bounds bug as the
  // extract()+trim() chain in process-brand-logo.mjs.
  const composedBuf = await sharp(bgTmp).composite([{ input: markTmp, left, top }]).png().toBuffer()
  const composed = await sharp(composedBuf).resize(size, size).png().toBuffer()

  await writeFile(path.join(ROOT, file), composed)
  await rm(markTmp, { force: true })
  await rm(bgTmp, { force: true })
  console.log(`wrote ${file}`)
}

const targets = [
  { file: 'public/icons/icon-192.png', size: 192, radius: 115, markScale: 0.6 },
  { file: 'public/icons/icon-512.png', size: 512, radius: 115, markScale: 0.6 },
  { file: 'public/icons/icon-maskable-512.png', size: 512, radius: 0, markScale: 0.44 },
  { file: 'src/app/apple-icon.png', size: 180, radius: 90, markScale: 0.6 },
  { file: 'src/app/icon.png', size: 32, radius: 7, markScale: 0.66 },
]

await mkdir(path.join(ROOT, 'public/icons'), { recursive: true })
await rm(path.join(ROOT, 'src/app/favicon.ico'), { force: true })

for (const target of targets) {
  await buildIcon(target)
}
