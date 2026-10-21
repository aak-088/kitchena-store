import { Suspense } from 'react'
import type { Metadata } from 'next'
import { getStorefrontProducts, getStorefrontCategories } from '@/lib/storefront/catalog'
import ProductsClient from '@/components/store/ProductsClient'

export const metadata: Metadata = {
  title: 'Products',
  description: 'Browse our full collection of handcrafted furniture — sofas, beds, dining tables, office furniture and more. Available for individual and bulk orders.',
}

export const dynamic = 'force-dynamic'

export default async function ProductsPage() {
  const [storefrontProducts, storefrontCategories] = await Promise.all([
    getStorefrontProducts(),
    getStorefrontCategories(),
  ])
  const products = storefrontProducts.map(p => ({
    id: p.id, name: p.name, slug: p.slug, description: p.description,
    material: p.material, price: p.price, moq: p.moq, featured: p.featured,
    imageUrl: p.images[0]?.url || '', categorySlug: p.category.slug,
  }))
  const categories = storefrontCategories.map(c => ({ id: c.id, name: c.name, slug: c.slug, description: c.description }))
  return (
    <Suspense fallback={<div className="pt-20 min-h-screen" />}>
      <ProductsClient allProducts={products} categories={categories} />
    </Suspense>
  )
}
