/**
 * Static data layer.
 *
 * The site is exported as plain static HTML for GitHub Pages, so there is no
 * database at runtime. All content lives in /data/*.json and is read at build
 * time. To change products, blog posts, testimonials, etc. edit those files
 * and push — GitHub Actions will rebuild and redeploy the site.
 */
import categoriesJson from '@/data/categories.json'
import productsJson from '@/data/products.json'
import productImagesJson from '@/data/product-images.json'
import testimonialsJson from '@/data/testimonials.json'
import blogPostsJson from '@/data/blog-posts.json'
import galleryJson from '@/data/gallery.json'
import siteContentJson from '@/data/site-content.json'

export interface Category {
  id: string; name: string; slug: string
  description: string | null; imageUrl: string | null
  createdAt: Date; updatedAt: Date
}
export interface ProductImage {
  id: string; url: string; altText: string | null
  isPrimary: boolean; order: number; productId: string
}
export interface Product {
  id: string; name: string; slug: string; description: string
  dimensions: string | null; material: string | null
  price: number | null; moq: number | null
  featured: boolean; inStock: boolean
  createdAt: Date; updatedAt: Date
  categoryId: string
  category: Category
  images: ProductImage[]
}
export interface Testimonial {
  id: string; name: string; role: string; location: string
  quote: string; rating: number; featured: boolean; order: number
  createdAt: Date; updatedAt: Date
}
export interface BlogPost {
  id: string; title: string; slug: string; excerpt: string; content: string
  coverImage: string | null; category: string; tags: string
  published: boolean; readTime: number; views: number
  createdAt: Date; updatedAt: Date; publishedAt: Date | null
}
export interface GalleryItem {
  id: string; title: string; description: string | null
  imageUrl: string; category: string; featured: boolean; order: number
}

const d = (v: string | null | undefined) => (v ? new Date(v) : null)

const categories: Category[] = (categoriesJson as any[]).map(c => ({
  ...c, createdAt: new Date(c.createdAt), updatedAt: new Date(c.updatedAt),
}))

const images = productImagesJson as ProductImage[]

const products: Product[] = (productsJson as any[]).map(p => ({
  ...p,
  createdAt: new Date(p.createdAt),
  updatedAt: new Date(p.updatedAt),
  category: categories.find(c => c.id === p.categoryId)!,
  images: images.filter(i => i.productId === p.id)
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.order - b.order),
}))

const blogPosts: BlogPost[] = (blogPostsJson as any[]).map(b => ({
  ...b,
  createdAt: new Date(b.createdAt),
  updatedAt: new Date(b.updatedAt),
  publishedAt: d(b.publishedAt),
}))

const testimonials: Testimonial[] = (testimonialsJson as any[]).map(t => ({
  ...t, createdAt: new Date(t.createdAt), updatedAt: new Date(t.updatedAt),
}))

// ── Categories ────────────────────────────────────────────────
export function getCategories(): Category[] {
  return [...categories].sort((a, b) => a.name.localeCompare(b.name))
}

// ── Products ──────────────────────────────────────────────────
export function getProducts(): Product[] {
  return [...products].sort((a, b) =>
    Number(b.featured) - Number(a.featured) || b.createdAt.getTime() - a.createdAt.getTime())
}
export function getFeaturedProducts(limit = 6): Product[] {
  return getProducts().filter(p => p.featured).sort((a, b) =>
    b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit)
}
export function getProductBySlug(slug: string): Product | undefined {
  return products.find(p => p.slug === slug)
}
export function getRelatedProducts(product: Product, limit = 4): Product[] {
  return products.filter(p => p.categoryId === product.categoryId && p.id !== product.id).slice(0, limit)
}
export function primaryImage(p: Product): ProductImage | undefined {
  return p.images.find(i => i.isPrimary) ?? p.images[0]
}

// ── Testimonials ──────────────────────────────────────────────
export function getFeaturedTestimonials(limit = 3): Testimonial[] {
  return testimonials
    .filter(t => t.featured)
    .sort((a, b) => a.order - b.order || b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit)
}

// ── Blog ──────────────────────────────────────────────────────
const postDate = (p: BlogPost) => (p.publishedAt ?? p.createdAt).getTime()

export function getPublishedPosts(): BlogPost[] {
  return blogPosts.filter(p => p.published).sort((a, b) => postDate(b) - postDate(a))
}
export function getPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find(p => p.slug === slug && p.published)
}
export function getAdjacentPosts(post: BlogPost) {
  const all = getPublishedPosts() // newest first
  const i = all.findIndex(p => p.id === post.id)
  return { prev: all[i + 1] ?? null, next: all[i - 1] ?? null }
}

// ── Gallery ───────────────────────────────────────────────────
export function getGalleryItems(): GalleryItem[] {
  return [...(galleryJson as GalleryItem[])].sort((a, b) => a.order - b.order)
}

// ── Site content / navigation toggles ─────────────────────────
export function getSiteContent(): Record<string, string> {
  return Object.fromEntries((siteContentJson as { key: string; value: string }[]).map(r => [r.key, r.value]))
}
export interface NavSettings {
  nav_show_gallery: boolean; nav_show_bulk_orders: boolean; nav_show_blog: boolean
  nav_show_about: boolean; nav_show_contact: boolean
}
export function getNavSettings(): NavSettings {
  const content = getSiteContent()
  const keys = ['nav_show_gallery', 'nav_show_bulk_orders', 'nav_show_blog', 'nav_show_about', 'nav_show_contact']
  return Object.fromEntries(keys.map(k => [k, k in content ? content[k] === 'true' : true])) as unknown as NavSettings
}
