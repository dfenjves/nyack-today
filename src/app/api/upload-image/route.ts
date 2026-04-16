import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import sharp from 'sharp'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_IMAGE_WIDTH = 1200

/**
 * POST /api/upload-image
 * Upload and optimize event images
 */
export async function POST(request: NextRequest) {
  try {
    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 5MB limit' },
        { status: 400 }
      )
    }

    // Validate file type (MIME type)
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Validate actual image format (prevents malicious files with fake MIME types)
    let imageMetadata
    try {
      imageMetadata = await sharp(buffer).metadata()
    } catch {
      return NextResponse.json(
        { error: 'Invalid or corrupted image file' },
        { status: 400 }
      )
    }

    // Additional format validation
    const allowedFormats = ['jpeg', 'png', 'webp', 'gif']
    if (!imageMetadata.format || !allowedFormats.includes(imageMetadata.format)) {
      return NextResponse.json(
        { error: 'Unsupported image format' },
        { status: 400 }
      )
    }

    // Optimize and resize image
    let optimizedBuffer: Buffer
    const shouldResize = imageMetadata.width && imageMetadata.width > MAX_IMAGE_WIDTH

    if (imageMetadata.format === 'gif') {
      // Preserve GIFs as-is (don't resize animated GIFs)
      optimizedBuffer = buffer
    } else {
      // .rotate() auto-applies EXIF orientation so phone photos aren't sideways
      const sharpInstance = sharp(buffer).rotate()

      if (shouldResize) {
        sharpInstance.resize(MAX_IMAGE_WIDTH, null, {
          fit: 'inside',
          withoutEnlargement: true
        })
      }

      // Convert to WebP for better compression (except GIFs)
      optimizedBuffer = await sharpInstance
        .webp({ quality: 85 })
        .toBuffer()
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(7)
    const extension = imageMetadata.format === 'gif' ? 'gif' : 'webp'
    const filename = `event-images/${timestamp}-${randomString}.${extension}`

    // Upload to Vercel Blob
    const blob = await put(filename, optimizedBuffer, {
      access: 'public',
      contentType: imageMetadata.format === 'gif' ? 'image/gif' : 'image/webp',
    })

    // Log optimization results
    console.log('Image uploaded:', {
      originalSize: file.size,
      optimizedSize: optimizedBuffer.length,
      reduction: ((1 - optimizedBuffer.length / file.size) * 100).toFixed(1) + '%',
      format: imageMetadata.format,
      dimensions: `${imageMetadata.width}x${imageMetadata.height}`,
      url: blob.url,
    })

    return NextResponse.json({
      url: blob.url,
      size: optimizedBuffer.length,
      originalSize: file.size,
    })
  } catch (error) {
    console.error('Image upload error:', error)

    // Check for specific Vercel Blob errors
    if (error instanceof Error) {
      if (error.message.includes('token')) {
        return NextResponse.json(
          { error: 'Storage configuration error. Please contact support.' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    )
  }
}
