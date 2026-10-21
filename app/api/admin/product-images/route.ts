import { NextResponse } from 'next/server'
import { requireAdmin, requireSameOrigin } from '@/lib/admin/authorize'
import { isValidProductId } from '@/lib/admin/product-input'

export const dynamic = 'force-dynamic'

const extensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const maximumImageSize = 10 * 1024 * 1024

export async function POST(request: Request) {
  const originError = requireSameOrigin(request)
  if (originError) return originError

  const authorization = await requireAdmin()
  if (!authorization.authorized) return authorization.response

  const form = await request.formData()
  const productId = form.get('productId')
  const file = form.get('file')
  if (
    typeof productId !== 'string'
    || !isValidProductId(productId)
    || !(file instanceof File)
    || !(file.type in extensions)
    || file.size === 0
    || file.size > maximumImageSize
  ) {
    return NextResponse.json({ error: 'Choose a JPG, PNG, or WebP image up to 10 MB.' }, { status: 400 })
  }

  const storagePath = `${productId}/${crypto.randomUUID()}.${extensions[file.type]}`
  const { error: uploadError } = await authorization.supabase.storage
    .from('product-images')
    .upload(storagePath, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    })
  if (uploadError) {
    return NextResponse.json({ error: 'Unable to upload the product image.' }, { status: 400 })
  }

  const { data: publicUrl } = authorization.supabase.storage.from('product-images').getPublicUrl(storagePath)
  return NextResponse.json({
    image: {
      id: crypto.randomUUID(),
      url: publicUrl.publicUrl,
      alt_text: file.name.slice(0, 500),
      is_primary: false,
      display_order: 0,
      storage_path: storagePath,
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE(request: Request) {
  const originError = requireSameOrigin(request)
  if (originError) return originError

  const authorization = await requireAdmin()
  if (!authorization.authorized) return authorization.response

  const url = new URL(request.url)
  const productId = url.searchParams.get('productId')
  const storagePath = url.searchParams.get('path')
  if (
    !productId
    || !isValidProductId(productId)
    || !storagePath
    || !storagePath.startsWith(`${productId}/`)
    || !/^[A-Za-z0-9_-]+\/[A-Za-z0-9._-]{1,200}$/.test(storagePath)
  ) {
    return NextResponse.json({ error: 'Invalid image path.' }, { status: 400 })
  }

  const { error } = await authorization.supabase.storage
    .from('product-images')
    .remove([storagePath])
  if (error) {
    return NextResponse.json({ error: 'Unable to remove the uploaded product image.' }, { status: 400 })
  }

  return NextResponse.json({ removed: true }, { headers: { 'Cache-Control': 'no-store' } })
}
