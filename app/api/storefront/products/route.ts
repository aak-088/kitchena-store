import { NextResponse } from 'next/server'
import { getStorefrontCategories, getStorefrontProducts } from '@/lib/storefront/catalog'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [categories, products] = await Promise.all([
    getStorefrontCategories(),
    getStorefrontProducts(),
  ])

  return NextResponse.json({
    categories,
    products,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
