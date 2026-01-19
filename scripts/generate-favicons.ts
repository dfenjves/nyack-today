/**
 * Generate favicon PNG files from the SVG source
 * Run with: npx tsx scripts/generate-favicons.ts
 */

import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const PUBLIC_DIR = join(process.cwd(), 'public')
const SVG_PATH = join(PUBLIC_DIR, 'favicon.svg')

async function generateFavicons() {
  console.log('Reading SVG source...')
  const svgBuffer = readFileSync(SVG_PATH)

  const sizes = [
    { name: 'favicon-16x16.png', size: 16 },
    { name: 'favicon-32x32.png', size: 32 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'android-chrome-192x192.png', size: 192 },
    { name: 'android-chrome-512x512.png', size: 512 },
  ]

  for (const { name, size } of sizes) {
    console.log(`Generating ${name} (${size}x${size})...`)
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(join(PUBLIC_DIR, name))
  }

  // Generate ICO file (using 32x32 PNG as base)
  console.log('Generating favicon.ico...')
  const png32 = await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toBuffer()

  // Simple ICO file with single 32x32 PNG
  // ICO format: header (6 bytes) + directory entry (16 bytes) + PNG data
  const icoHeader = Buffer.alloc(6)
  icoHeader.writeUInt16LE(0, 0) // Reserved
  icoHeader.writeUInt16LE(1, 2) // Type: 1 = ICO
  icoHeader.writeUInt16LE(1, 4) // Number of images

  const icoDirectory = Buffer.alloc(16)
  icoDirectory.writeUInt8(32, 0)  // Width
  icoDirectory.writeUInt8(32, 1)  // Height
  icoDirectory.writeUInt8(0, 2)   // Color palette
  icoDirectory.writeUInt8(0, 3)   // Reserved
  icoDirectory.writeUInt16LE(1, 4)  // Color planes
  icoDirectory.writeUInt16LE(32, 6) // Bits per pixel
  icoDirectory.writeUInt32LE(png32.length, 8) // Size of image data
  icoDirectory.writeUInt32LE(22, 12) // Offset to image data (6 + 16)

  const icoFile = Buffer.concat([icoHeader, icoDirectory, png32])
  writeFileSync(join(PUBLIC_DIR, 'favicon.ico'), icoFile)

  console.log('Done! Generated all favicon files.')
}

generateFavicons().catch(console.error)
