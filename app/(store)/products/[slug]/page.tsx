import { getProducts, getProductBySlug, getRelatedProducts } from '@/lib/data'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import ProductDetailClient from '@/components/store/ProductDetailClient'
import { buildMetadata, productJsonLd, breadcrumbJsonLd } from '@/lib/seo'

export const dynamicParams = false

export function generateStaticParams() {
  return getProducts().map(p => ({ slug: p.slug }))
}

export function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Metadata {
  const product = getProductBySlug(params.slug)
  if (!product) return { title: 'Product Not Found' }

  const keywords = [
    product.name,
    product.category.name,
    product.material || '',
    `${product.name} price`,
    `buy ${product.name} India`,
    `${product.category.name} furniture Ahmedabad`,
  ].filter(Boolean)

  return buildMetadata({
    title: `${product.name} – ${product.category.name} Furniture`,
    description: `${product.description.slice(0, 155)}${product.description.length > 155 ? '...' : ''}`,
    path: `/products/${params.slug}`,
    image: product.images[0]?.url,
    keywords,
  })
}

export default function ProductDetailPage({
  params,
}: {
  params: { slug: string }
}) {
  const product = getProductBySlug(params.slug)
  if (!product) notFound()

  const related = getRelatedProducts(product, 4)

  // JSON-LD structured data
  const productSchema = productJsonLd({
    name: product.name,
    description: product.description,
    slug: product.slug,
    price: product.price,
    material: product.material,
    dimensions: product.dimensions,
    imageUrl: product.images[0]?.url,
    category: product.category.name,
  })

  const breadcrumbSchema = breadcrumbJsonLd([
    { name: 'Home',              url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://craftura.com'}` },
    { name: 'Products',          url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://craftura.com'}/products` },
    { name: product.category.name, url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://craftura.com'}/products?category=${product.category.slug}` },
    { name: product.name,        url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://craftura.com'}/products/${product.slug}` },
  ])

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}/>
      <ProductDetailClient
        product={JSON.parse(JSON.stringify(product))}
        related={JSON.parse(JSON.stringify(related))}
      />
    </>
  )
}
