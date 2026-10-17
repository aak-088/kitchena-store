import type { Metadata } from 'next'
import { buildMetadata } from '@/lib/seo'
import { getGalleryItems } from '@/lib/data'
import GalleryClient from '@/components/store/GalleryClient'

export const metadata: Metadata = buildMetadata({
  title: 'Project Gallery – Our Work',
  description: 'Browse Craftura\'s portfolio of completed furniture projects — hotels, homes, offices and commercial spaces across India. Handcrafted premium furniture.',
  path: '/gallery',
  keywords: ['furniture portfolio India', 'handcrafted furniture gallery', 'hotel furniture projects', 'interior furniture Ahmedabad'],
})

export default function GalleryPage() {
  return <GalleryClient items={getGalleryItems().map(g => ({ id: g.id, title: g.title, description: g.description ?? undefined, imageUrl: g.imageUrl, category: g.category, featured: g.featured }))} />
}
