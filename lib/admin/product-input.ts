import type { Json } from '@/lib/supabase/database.types'

export type AdminProductImageInput = {
  id: string
  url: string
  alt_text: string | null
  is_primary: boolean
  display_order: number
  storage_path: string | null
}

export type AdminProductInput = {
  id: string
  name: string
  slug: string
  description: string
  dimensions: string | null
  material: string | null
  price: number | null
  minimum_order_quantity: number | null
  featured: boolean
  in_stock: boolean
  is_published: boolean
  category_id: string
}

export type ValidatedProductSave = {
  product: AdminProductInput
  images: AdminProductImageInput[]
  rpcProduct: Json
  rpcImages: Json
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredText(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maximum
}

function optionalText(value: unknown, maximum: number): value is string | null {
  return value === null || value === undefined || (typeof value === 'string' && value.length <= maximum)
}

function validImageUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

export function validateProductSave(value: unknown): ValidatedProductSave | null {
  if (!isRecord(value) || !isRecord(value.product) || !Array.isArray(value.images)) return null
  const row = value.product
  const productId = row.id

  if (
    !requiredText(productId, 80)
    || !/^[A-Za-z0-9_-]+$/.test(productId)
    || !requiredText(row.name, 120)
    || !requiredText(row.slug, 140)
    || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.slug)
    || !requiredText(row.description, 5000)
    || !requiredText(row.category_id, 80)
    || !/^[A-Za-z0-9_-]+$/.test(row.category_id)
    || !optionalText(row.dimensions, 200)
    || !optionalText(row.material, 200)
    || (row.price !== null && (typeof row.price !== 'number' || !Number.isFinite(row.price) || row.price < 0))
    || (row.minimum_order_quantity !== null && (
      typeof row.minimum_order_quantity !== 'number'
      || !Number.isInteger(row.minimum_order_quantity)
      || row.minimum_order_quantity < 1
    ))
    || typeof row.featured !== 'boolean'
    || typeof row.in_stock !== 'boolean'
    || typeof row.is_published !== 'boolean'
    || value.images.length === 0
    || value.images.length > 20
  ) {
    return null
  }

  const images: AdminProductImageInput[] = []
  for (let index = 0; index < value.images.length; index += 1) {
    const image = value.images[index]
    if (
      !isRecord(image)
      || !requiredText(image.id, 80)
      || !/^[A-Za-z0-9_-]+$/.test(image.id)
      || !validImageUrl(image.url)
      || !optionalText(image.alt_text, 500)
      || (image.storage_path !== null && (
        typeof image.storage_path !== 'string'
        || !image.storage_path.startsWith(`${productId}/`)
        || !/^[A-Za-z0-9_-]+\/[A-Za-z0-9._-]{1,200}$/.test(image.storage_path)
      ))
    ) {
      return null
    }

    images.push({
      id: image.id,
      url: image.url,
      alt_text: image.alt_text ?? null,
      is_primary: index === 0,
      display_order: index,
      storage_path: typeof image.storage_path === 'string' ? image.storage_path : null,
    })
  }

  const product: AdminProductInput = {
    id: productId,
    name: row.name.trim(),
    slug: row.slug,
    description: row.description.trim(),
    dimensions: typeof row.dimensions === 'string' && row.dimensions ? row.dimensions.trim() : null,
    material: typeof row.material === 'string' && row.material ? row.material.trim() : null,
    price: typeof row.price === 'number' ? row.price : null,
    minimum_order_quantity: typeof row.minimum_order_quantity === 'number' ? row.minimum_order_quantity : null,
    featured: row.featured,
    in_stock: row.in_stock,
    is_published: row.is_published,
    category_id: row.category_id,
  }

  return { product, images, rpcProduct: product, rpcImages: images }
}

export function isValidProductId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,80}$/.test(value)
}
