import { revalidateTag } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin, requireSameOrigin } from '@/lib/admin/authorize'
import { isValidProductId } from '@/lib/admin/product-input'
import { STOREFRONT_CACHE_TAG } from '@/lib/storefront/catalog'

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const originError = requireSameOrigin(request)
  if (originError) return originError

  const authorization = await requireAdmin()
  if (!authorization.authorized) return authorization.response

  const { id } = await params
  if (!isValidProductId(id)) {
    return NextResponse.json({ error: 'Invalid product ID.' }, { status: 400 })
  }

  const images = await authorization.supabase
    .from('product_images')
    .select('storage_path')
    .eq('product_id', id)
  if (images.error) {
    return NextResponse.json({ error: 'Unable to load the product images before deletion.' }, { status: 500 })
  }

  const { data, error } = await authorization.supabase
    .from('products')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Unable to delete the product.' }, { status: error.code === '42501' ? 403 : 400 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Product not found.' }, { status: 404 })
  }

  revalidateTag(STOREFRONT_CACHE_TAG)
  const storagePaths = images.data.flatMap((image) => image.storage_path ? [image.storage_path] : [])
  let warning: string | undefined
  if (storagePaths.length) {
    const { error: storageError } = await authorization.supabase
      .storage
      .from('product-images')
      .remove(storagePaths)
    if (storageError) warning = 'تم حذف المنتج، لكن تعذر حذف بعض ملفات الصور من التخزين.'
  }

  return NextResponse.json(
    { id: data.id, ...(warning ? { warning } : {}) },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
