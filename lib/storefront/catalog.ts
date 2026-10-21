import 'server-only'

import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import type { Category, Product, ProductImage } from '@/lib/data'
import { getCategories, getProducts } from '@/lib/data'
import type { Database } from '@/lib/supabase/database.types'

export const STOREFRONT_CACHE_TAG = 'storefront-catalog'

type StorefrontCatalog = {
  categories: Category[]
  products: Product[]
}

function localCatalog(): StorefrontCatalog {
  return { categories: getCategories(), products: getProducts() }
}

async function loadStorefrontCatalog(): Promise<StorefrontCatalog> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url && !anonKey) return localCatalog()
  if (!url || !anonKey) {
    throw new Error('Both NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.')
  }

  const supabase = createClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const [categoryResult, productResult, imageResult] = await Promise.all([
    supabase.from('categories').select('*').order('name'),
    supabase.from('products').select('*').eq('is_published', true).order('created_at', { ascending: false }),
    supabase.from('product_images').select('*').order('display_order'),
  ])

  if (categoryResult.error) throw new Error(`Unable to load storefront categories: ${categoryResult.error.message}`)
  if (productResult.error) throw new Error(`Unable to load published storefront products: ${productResult.error.message}`)
  if (imageResult.error) throw new Error(`Unable to load storefront product images: ${imageResult.error.message}`)

  const categories: Category[] = categoryResult.data.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    imageUrl: category.image_url,
    createdAt: new Date(category.created_at),
    updatedAt: new Date(category.updated_at),
  }))
  const categoriesById = new Map(categories.map((category) => [category.id, category]))
  const imagesByProduct = new Map<string, ProductImage[]>()

  for (const image of imageResult.data) {
    const images = imagesByProduct.get(image.product_id) ?? []
    images.push({
      id: image.id,
      url: image.url,
      altText: image.alt_text,
      isPrimary: image.is_primary,
      order: image.display_order,
      productId: image.product_id,
    })
    imagesByProduct.set(image.product_id, images)
  }

  const products: Product[] = productResult.data.map((product) => {
    const category = categoriesById.get(product.category_id)
    if (!category) throw new Error(`Published product "${product.id}" refers to a missing category.`)

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      dimensions: product.dimensions,
      material: product.material,
      price: product.price,
      moq: product.minimum_order_quantity,
      featured: product.featured,
      inStock: product.in_stock,
      createdAt: new Date(product.created_at),
      updatedAt: new Date(product.updated_at),
      categoryId: product.category_id,
      category,
      images: (imagesByProduct.get(product.id) ?? [])
        .sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary) || left.order - right.order),
    }
  })

  return { categories, products }
}

const getCachedStorefrontCatalog = unstable_cache(
  loadStorefrontCatalog,
  ['public-storefront-catalog-v1'],
  { revalidate: 3600, tags: [STOREFRONT_CACHE_TAG] },
)

export async function getStorefrontCategories(): Promise<Category[]> {
  return (await getCachedStorefrontCatalog()).categories
}

export async function getStorefrontProducts(): Promise<Product[]> {
  return (await getCachedStorefrontCatalog()).products
}

export async function getStorefrontFeaturedProducts(limit = 6): Promise<Product[]> {
  const products = await getStorefrontProducts()
  return products.filter((product) => product.featured)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, limit)
}

export async function getStorefrontProductBySlug(slug: string): Promise<Product | undefined> {
  return (await getStorefrontProducts()).find((product) => product.slug === slug)
}

export async function getStorefrontRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  return (await getStorefrontProducts())
    .filter((candidate) => candidate.categoryId === product.categoryId && candidate.id !== product.id)
    .slice(0, limit)
}
