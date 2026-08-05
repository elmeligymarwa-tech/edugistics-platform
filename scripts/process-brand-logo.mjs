import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.resolve(import.meta.dirname, '..')

// Luminance band that gets keyed to transparent (the white backdrop), with a
// soft feather so edges don't come out jagged.
const WHITE_LOW = 225
const WHITE_HIGH = 250

// Luminance band that gets recoloured for the dark variant — this is the
// navy ink (glyph body + wordmark), which sits well below the accent colours
// (coral/teal/amber all have luminance > 100) so the swap never touches them.
const NAVY_DARK = 40
const NAVY_LIGHT = 100
const DARK_VARIANT_INK = [244, 246, 250]

/**
 * Keys out the white background (soft-feathered alpha) and, for the dark
 * variant, remaps the navy ink to a light tone so the mark stays legible on
 * dark surfaces. Pure pixel-space processing — no colour profile assumptions
 * beyond the brand palette's own luminance separation.
 */
async function processLogo(inputPath, { recolorNavy }) {
  const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    let a = data[i + 3]
    const lum = 0.299 * r + 0.587 * g + 0.114 * b

    if (lum >= WHITE_LOW) {
      const t = Math.min(1, (lum - WHITE_LOW) / (WHITE_HIGH - WHITE_LOW))
      a = Math.round(a * (1 - t))
    }

    if (recolorNavy && lum < NAVY_LIGHT) {
      const t = Math.min(1, Math.max(0, (NAVY_LIGHT - lum) / (NAVY_LIGHT - NAVY_DARK)))
      data[i] = Math.round(r * (1 - t) + DARK_VARIANT_INK[0] * t)
      data[i + 1] = Math.round(g * (1 - t) + DARK_VARIANT_INK[1] * t)
      data[i + 2] = Math.round(b * (1 - t) + DARK_VARIANT_INK[2] * t)
    }

    data[i + 3] = a
  }

  return sharp(data, { raw: { width, height, channels } })
}

async function writePng(image, outPath, { width } = {}) {
  let pipeline = image.png()
  if (width) pipeline = pipeline.resize({ width, withoutEnlargement: true })
  await writeFile(outPath, await pipeline.toBuffer())
  console.log(`wrote ${path.relative(ROOT, outPath)}`)
}

const logoPath = path.join(ROOT, 'public/edugistics-logo.png')
const iconPath = path.join(ROOT, 'public/edugistics-logo-icon.png')
const outDir = path.join(ROOT, 'public/brand')

// Full lockup (mark + wordmark + tagline) for the sidebar and PDF cover.
await writePng(await processLogo(logoPath, { recolorNavy: false }), path.join(outDir, 'logo-light.png'), { width: 900 })
await writePng(await processLogo(logoPath, { recolorNavy: true }), path.join(outDir, 'logo-dark.png'), { width: 900 })

// Mark-only crop (drop the wordmark) for compact/icon contexts. The mark
// occupies roughly the top 65% of the square source canvas.
const iconMeta = await sharp(iconPath).metadata()
const markCropHeight = Math.round(iconMeta.height * 0.66)

async function processMark({ recolorNavy }) {
  // Two separate pipelines: chaining extract() straight into trim() trips a
  // libvips bounds bug, so the crop is materialised to a buffer first.
  const extracted = await sharp(iconPath)
    .extract({ left: 0, top: 0, width: iconMeta.width, height: markCropHeight })
    .toBuffer()
  const trimmed = await sharp(extracted).trim({ background: '#ffffff', threshold: 8 }).toBuffer()
  return processLogo(trimmed, { recolorNavy })
}

await writePng(await processMark({ recolorNavy: false }), path.join(outDir, 'mark-light.png'), { width: 512 })
await writePng(await processMark({ recolorNavy: true }), path.join(outDir, 'mark-dark.png'), { width: 512 })
