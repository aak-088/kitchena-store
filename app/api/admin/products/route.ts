import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { requireAdmin, requireSameOrigin } from '@/lib/admin/authorize'
import { validateProductSave } from '@/lib/admin/product-input'
import { STOREFRONT_CACHE_TAG } from '@/lib/storefront/catalog'

export const dynamic = 'force-dynamic'

export async function GET() {
  const authorization = await requireAdmin()
  if (!authorization.authorized) return authorization.response

  const [categoryResult, productResult, imageResult] = await Promise.all([
    authorization.supabase.from('categories').select('id, name, slug').order('name'),
    authorization.supabase.from('products').select('*').order('updated_at', { ascending: false }),
    authorization.supabase.from('product_images').select('*').order('display_order'),
  ])

  if (categoryResult.error || productResult.error || imageResult.error) {
    return NextResponse.json({ error: 'Unable to load the admin catalog.' }, { status: 500 })
  }

  const imagesByProduct = new Map<string, typeof imageResult.data>()
  for (const image of imageResult.data) {
    const images = imagesByProduct.get(image.product_id) ?? []
    images.push(image)
    imagesByProduct.set(image.product_id, images)
  }

  return NextResponse.json({
    categories: categoryResult.data,
    products: productResult.data.map((product) => ({
      ...product,
      images: imagesByProduct.get(product.id) ?? [],
    })),
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

async function saveProduct(request: Request) {
  const originError = requireSameOrigin(request)
  if (originError) return originError

  const authorization = await requireAdmin()
  if (!authorization.authorized) return authorization.response

  let requestBody: unknown
  try {
    requestBody = await request.json()
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 })
    }
    throw error
  }

  const input = validateProductSave(requestBody)
  if (!input) {
    return NextResponse.json({ error: 'Product or image data is invalid.' }, { status: 400 })
  }

  const { error } = await authorization.supabase.rpc('admin_save_product', {
    p_product: input.rpcProduct,
    p_images: input.rpcImages,
  })
  if (error) {
    return NextResponse.json(
      { error: 'Unable to save the product. Check the category, product slug, and image records.' },
      { status: error.code === '42501' ? 403 : 400 },
    )
  }

  revalidateTag(STOREFRONT_CACHE_TAG)
  return NextResponse.json({ id: input.product.id }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  return saveProduct(request)
}

export async function PUT(request: Request) {
  return saveProduct(request)
}
