import { mkdir, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const BRAND = '#2a78d6'
const GLYPH = '#ffffff'
const ROOT = path.resolve(import.meta.dirname, '..')

/** Builds the "E" glyph from four rects so rendering never depends on a system font. */
function glyphRects(scale) {
  const bars = [
    { x: 176, y: 156, w: 40, h: 200 },
    { x: 176, y: 156, w: 160, h: 40 },
    { x: 176, y: 236, w: 130, h: 40 },
    { x: 176, y: 316, w: 160, h: 40 },
  ]
  return bars
    .map(({ x, y, w, h }) => {
      const cx = 256 + (x + w / 2 - 256) * scale
      const cy = 256 + (y + h / 2 - 256) * scale
      return `<rect x="${cx - (w * scale) / 2}" y="${cy - (h * scale) / 2}" width="${w * scale}" height="${h * scale}" fill="${GLYPH}" />`
    })
    .join('')
}

function markSvg({ size, radius, scale }) {
  const rectAttrs = radius > 0 ? `rx="${radius}" ry="${radius}"` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
    <rect width="512" height="512" ${rectAttrs} fill="${BRAND}" />
    ${glyphRects(scale)}
  </svg>`
}

const targets = [
  { file: 'public/icons/icon-192.png', size: 192, radius: 115, scale: 1 },
  { file: 'public/icons/icon-512.png', size: 512, radius: 115, scale: 1 },
  { file: 'public/icons/icon-maskable-512.png', size: 512, radius: 0, scale: 0.62 },
  { file: 'src/app/apple-icon.png', size: 180, radius: 40, scale: 1 },
  { file: 'src/app/icon.png', size: 32, radius: 7, scale: 1 },
]

await mkdir(path.join(ROOT, 'public/icons'), { recursive: true })
await rm(path.join(ROOT, 'src/app/favicon.ico'), { force: true })

for (const target of targets) {
  const svg = markSvg(target)
  const outPath = path.join(ROOT, target.file)
  await writeFile(outPath, await sharp(Buffer.from(svg)).png().toBuffer())
  console.log(`wrote ${target.file}`)
}
