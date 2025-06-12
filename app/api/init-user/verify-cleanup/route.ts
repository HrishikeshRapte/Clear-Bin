import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

export async function POST(req: NextRequest) {
  const data = await req.formData()
  const beforeFile = data.get('beforeImage') as File
  const afterFile = data.get('afterImage') as File

  if (!beforeFile || !afterFile) {
    return NextResponse.json({ success: false, message: 'Missing images' }, { status: 400 })
  }

  const beforeBuffer = Buffer.from(await beforeFile.arrayBuffer())
  const afterBuffer = Buffer.from(await afterFile.arrayBuffer())

  // Resize both images to same dimensions
  const width = 512
  const height = 512

  const beforePng = await sharp(beforeBuffer).resize(width, height).png().toBuffer()
  const afterPng = await sharp(afterBuffer).resize(width, height).png().toBuffer()

  const img1 = PNG.sync.read(beforePng)
  const img2 = PNG.sync.read(afterPng)
  const { width: w, height: h } = img1

  const diff = new PNG({ width: w, height: h })
  const pixelDiff = pixelmatch(img1.data, img2.data, diff.data, w, h, { threshold: 0.1 })

  const totalPixels = w * h
  const similarity = 1 - pixelDiff / totalPixels

  const cleaned = similarity < 0.85 // Lower similarity = more change = likely cleaned

  if (cleaned) {
    return NextResponse.json({
      success: true,
      wasteType: 'Plastic',
      quantity: '2.5 kg',
      confidence: parseFloat((similarity * 100).toFixed(2))
    })
  } else {
    return NextResponse.json({
      success: false,
      confidence: parseFloat((similarity * 100).toFixed(2)),
      message: 'Waste does not appear to be cleaned up properly.'
    })
  }
}
