import { Suspense } from 'react'
import { getPublishedPosts } from '@/lib/data'
import BlogListClient from '@/components/store/BlogListClient'
import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Craft Stories & Buying Guides',
  description: 'Articles about furniture craftsmanship, material sourcing, and buying guides from Craftura — Ahmedabad\'s premium furniture manufacturer since 1994.',
  path: '/blog',
  keywords: ['furniture blog India', 'teak wood guide', 'furniture buying tips', 'craft stories', 'furniture manufacturer blog'],
})

export default function BlogPage() {
  const allPosts = getPublishedPosts().map(p => ({
    id: p.id, title: p.title, slug: p.slug, excerpt: p.excerpt,
    coverImage: p.coverImage, category: p.category, readTime: p.readTime,
    publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
  }))
  return (
    <Suspense fallback={<div className="pt-20 min-h-screen" />}>
      <BlogListClient allPosts={allPosts} />
    </Suspense>
  )
}
