import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.resolve(__dirname, '../public')

// CRC32 IEEE 802.3
const crcTable = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1)
    } else {
      c = c >>> 1
    }
  }
  crcTable[n] = c >>> 0
}

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function makeChunk(typeStr, dataBuf) {
  const typeBuf = Buffer.from(typeStr, 'ascii')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(dataBuf.length, 0)

  const toCrc = Buffer.concat([typeBuf, dataBuf])
  const crcVal = crc32(toCrc)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crcVal, 0)

  return Buffer.concat([lenBuf, toCrc, crcBuf])
}

function createPng(size) {
  // Background #07060b -> (7, 6, 11)
  // Pink circle #ec4899 -> (236, 72, 153)
  const bgR = 0x07, bgG = 0x06, bgB = 0x0b
  const fgR = 0xec, fgG = 0x48, fgB = 0x99

  const cx = size / 2
  const cy = size / 2
  const radius = size * 0.35 // circle diameter 70% of canvas

  // Scanlines: each line has 1 filter byte (0: None) + size * 4 bytes (RGBA)
  const scanlineLength = 1 + size * 4
  const rawData = Buffer.alloc(size * scanlineLength)

  for (let y = 0; y < size; y++) {
    const rowOffset = y * scanlineLength
    rawData[rowOffset] = 0 // filter: None

    for (let x = 0; x < size; x++) {
      const pxOffset = rowOffset + 1 + x * 4
      const dx = x + 0.5 - cx
      const dy = y + 0.5 - cy
      const dist = Math.sqrt(dx * dx + dy * dy)

      // Anti-aliasing within 1 pixel boundary
      let factor = 0
      if (dist <= radius - 0.5) {
        factor = 1
      } else if (dist >= radius + 0.5) {
        factor = 0
      } else {
        factor = radius + 0.5 - dist
      }

      const r = Math.round(bgR + (fgR - bgR) * factor)
      const g = Math.round(bgG + (fgG - bgG) * factor)
      const b = Math.round(bgB + (fgB - bgB) * factor)

      rawData[pxOffset] = r
      rawData[pxOffset + 1] = g
      rawData[pxOffset + 2] = b
      rawData[pxOffset + 3] = 255
    }
  }

  // PNG Signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  // IHDR Chunk
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  ihdr[10] = 0 // compression: deflate
  ihdr[11] = 0 // filter: standard
  ihdr[12] = 0 // interlace: none

  const compressedData = zlib.deflateSync(rawData, { level: 9 })

  const ihdrChunk = makeChunk('IHDR', ihdr)
  const idatChunk = makeChunk('IDAT', compressedData)
  const iendChunk = makeChunk('IEND', Buffer.alloc(0))

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk])
}

const icon192 = createPng(192)
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), icon192)
console.log(`Generated public/icon-192.png (${icon192.length} bytes)`)

const icon512 = createPng(512)
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), icon512)
console.log(`Generated public/icon-512.png (${icon512.length} bytes)`)
