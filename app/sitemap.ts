import { MetadataRoute } from 'next'
import { getProducts, getCategories, getPublishedPosts } from '@/lib/data'

export const dynamic = 'force-static'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://craftura.com'

export default function sitemap(): MetadataRoute.Sitemap {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/products`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/gallery`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/bulk-orders`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ]

  // Dynamic product pages
  const products = getProducts()

  const productPages: MetadataRoute.Sitemap = products.map(product => ({
    url: `${BASE_URL}/products/${product.slug}`,
    lastModified: product.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.85,
  }))

  // Dynamic category pages
  const categories = getCategories()

  const categoryPages: MetadataRoute.Sitemap = categories.map(cat => ({
    url: `${BASE_URL}/products?category=${cat.slug}`,
    lastModified: cat.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.75,
  }))

  // Blog pages
  const blogPosts = getPublishedPosts()
  const blogPages: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    ...blogPosts.map(post => ({
      url: `${BASE_URL}/blog/${post.slug}`,
      lastModified: post.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.65,
    })),
  ]

  return [...staticPages, ...productPages, ...categoryPages, ...blogPages]
}
