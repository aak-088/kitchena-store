import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'

const root = process.cwd()

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? collectFiles(path) : [path]
  }))
  return nested.flat()
}

test('every admin API route authenticates requests and checks mutation origins', async () => {
  const routePaths = [
    'app/api/admin/products/route.ts',
    'app/api/admin/products/[id]/route.ts',
    'app/api/admin/product-images/route.ts',
  ]
  const routes = await Promise.all(routePaths.map((path) => readFile(join(root, path), 'utf8')))

  for (const route of routes) {
    assert.match(route, /requireAdmin\(/)
    assert.match(route, /requireSameOrigin\(/)
  }
  for (const route of routes.slice(0, 2)) {
    assert.match(route, /revalidateTag\(STOREFRONT_CACHE_TAG\)/)
  }
  const catalog = await readFile(join(root, 'lib/storefront/catalog.ts'), 'utf8')
  assert.match(catalog, /STOREFRONT_CACHE_TAG = ['"]storefront-catalog['"]/)
})

test('database and storage policies remain a defense-in-depth authorization boundary', async () => {
  const migration = await readFile(join(root, 'supabase/migrations/20261018000000_admin_storefront.sql'), 'utf8')

  assert.match(migration, /alter table public\.products enable row level security;/)
  assert.match(migration, /alter table public\.product_images enable row level security;/)
  assert.match(migration, /create policy "Admins manage products"[\s\S]*?using \(\(select public\.is_admin\(\)\)\)[\s\S]*?with check \(\(select public\.is_admin\(\)\)\)/)
  assert.match(migration, /create policy "Admins upload product images"[\s\S]*?public\.is_admin\(\)/)
  assert.match(migration, /grant execute on function public\.admin_save_product\(jsonb, jsonb\) to authenticated;/)
  assert.doesNotMatch(migration, /grant execute on function public\.admin_save_product\(jsonb, jsonb\) to anon;/)
})

test('admin browser code uses server routes and contains no privileged credentials', async () => {
  const adminPage = await readFile(join(root, 'app/admin/page.tsx'), 'utf8')
  const client = await readFile(join(root, 'lib/supabase/client.ts'), 'utf8')

  assert.match(adminPage, /\/api\/admin\/products/)
  assert.match(adminPage, /\/api\/admin\/product-images/)
  assert.doesNotMatch(adminPage, /from\('products'\)|from\('product_images'\)|\.rpc\(/)
  assert.doesNotMatch(`${adminPage}\n${client}`, /SUPABASE_SERVICE_ROLE_KEY|GITHUB_TOKEN|ADMIN_PASSWORD/)
})

test('public storefront reads the runtime catalog with a JSON-only configuration fallback', async () => {
  const catalog = await readFile(join(root, 'lib/storefront/catalog.ts'), 'utf8')
  const storeHome = await readFile(join(root, 'app/(store)/page.tsx'), 'utf8')
  const productList = await readFile(join(root, 'app/(store)/products/page.tsx'), 'utf8')
  const productDetails = await readFile(join(root, 'app/(store)/products/[slug]/page.tsx'), 'utf8')
  const sitemap = await readFile(join(root, 'app/sitemap.ts'), 'utf8')

  assert.match(catalog, /unstable_cache/)
  assert.match(catalog, /storefront-catalog/)
  assert.match(catalog, /getCategories\(\), products: getProducts\(\)/)
  assert.match(storeHome, /getStorefrontFeaturedProducts/)
  assert.match(productList, /getStorefrontProducts/)
  assert.match(productDetails, /getStorefrontProductBySlug/)
  assert.match(sitemap, /getStorefrontProducts/)
  assert.doesNotMatch(productDetails, /generateStaticParams|dynamicParams\s*=\s*false/)
})

test('runtime build does not configure static export or legacy publish automation', async () => {
  const config = await readFile(join(root, 'next.config.js'), 'utf8')
  const workflow = await readFile(join(root, '.github/workflows/deploy.yml'), 'utf8')
  const obsoleteEdgeFunction = join(root, 'supabase/functions/publish-storefront/index.ts')

  assert.doesNotMatch(config, /output:\s*['"]export['"]/)
  assert.doesNotMatch(workflow, /pages|repository_dispatch|storefront-publish/i)
  await assert.rejects(readFile(obsoleteEdgeFunction), { code: 'ENOENT' })
})

test('compiled browser bundles do not contain privileged keys', async (t) => {
  const staticOutput = join(root, '.next/static')
  let files
  try {
    files = await collectFiles(staticOutput)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      t.skip('Run npm run build before checking the browser bundle.')
      return
    }
    throw error
  }

  const browserAssets = await Promise.all(
    files.filter((file) => file.endsWith('.js')).map((file) => readFile(file, 'utf8')),
  )
  assert.doesNotMatch(browserAssets.join('\n'), /SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECURITY_TEST_ADMIN_PASSWORD/)
})
