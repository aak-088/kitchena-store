import { Suspense } from 'react'
import type { Metadata } from 'next'
import { getProducts, getCategories } from '@/lib/data'
import ProductsClient from '@/components/store/ProductsClient'

export const metadata: Metadata = {
  title: 'Products',
  description: 'Browse our full collection of handcrafted furniture — sofas, beds, dining tables, office furniture and more. Available for individual and bulk orders.',
}

export default function ProductsPage() {
  const products = getProducts().map(p => ({
    id: p.id, name: p.name, slug: p.slug, description: p.description,
    material: p.material, price: p.price, moq: p.moq, featured: p.featured,
    imageUrl: p.images[0]?.url || '', categorySlug: p.category.slug,
  }))
  const categories = getCategories().map(c => ({ id: c.id, name: c.name, slug: c.slug, description: c.description }))
  return (
    <Suspense fallback={<div className="pt-20 min-h-screen" />}>
      <ProductsClient allProducts={products} categories={categories} />
    </Suspense>
  )
}
