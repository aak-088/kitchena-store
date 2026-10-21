import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import nextEnv from '@next/env'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { test } from 'node:test'

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

const supabaseUrl = process.env.SUPABASE_SECURITY_TEST_URL
const anonKey = process.env.SUPABASE_SECURITY_TEST_ANON_KEY
const adminEmail = process.env.SUPABASE_SECURITY_TEST_ADMIN_EMAIL
const adminPassword = process.env.SUPABASE_SECURITY_TEST_ADMIN_PASSWORD
const userEmail = process.env.SUPABASE_SECURITY_TEST_USER_EMAIL
const userPassword = process.env.SUPABASE_SECURITY_TEST_USER_PASSWORD
const appBaseUrl = process.env.SUPABASE_SECURITY_TEST_APP_URL
const configured = Boolean(
  supabaseUrl && anonKey && adminEmail && adminPassword && userEmail && userPassword && appBaseUrl,
)
const testImage = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

function createSupabaseClient() {
  if (!supabaseUrl || !anonKey) throw new Error('Live Supabase test credentials are missing.')
  return createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
}

async function signInForApp(email, password) {
  if (!supabaseUrl || !anonKey) throw new Error('Live Supabase test credentials are missing.')

  const cookies = new Map()
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: (values) => {
        for (const { name, value } of values) cookies.set(name, value)
      },
    },
  })
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  assert.ifError(error)
  assert.ok(cookies.size, 'Supabase SSR sign-in should produce session cookies.')
  return [...cookies].map(([name, value]) => `${name}=${value}`).join('; ')
}

function appRequest(path, { cookie, method = 'GET', body, contentType } = {}) {
  if (!appBaseUrl) throw new Error('SUPABASE_SECURITY_TEST_APP_URL is not configured.')
  const url = new URL(path, appBaseUrl)
  const headers = { Origin: new URL(appBaseUrl).origin }
  if (cookie) headers.Cookie = cookie
  if (contentType) headers['Content-Type'] = contentType
  return fetch(url, { method, headers, body })
}

test('live admin API auth, persistence, image upload, and storefront cache invalidation', {
  skip: !configured && 'Set all SUPABASE_SECURITY_TEST_* variables, including the running app URL, to run live integration tests.',
}, async (t) => {
  const admin = createSupabaseClient()
  const ordinaryUser = createSupabaseClient()
  const anonymous = createSupabaseClient()
  const appUrl = new URL(appBaseUrl)
  const { error: adminLoginError } = await admin.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  })
  assert.ifError(adminLoginError)
  const { error: userLoginError } = await ordinaryUser.auth.signInWithPassword({
    email: userEmail,
    password: userPassword,
  })
  assert.ifError(userLoginError)
  const adminCookie = await signInForApp(adminEmail, adminPassword)
  const userCookie = await signInForApp(userEmail, userPassword)
  const productId = randomUUID()
  const deniedImagePath = `security-test-denied/${randomUUID()}.png`
  let storagePath
  let productCreated = false

  t.after(async () => {
    if (productCreated) {
      const { error } = await admin.from('products').delete().eq('id', productId)
      assert.ifError(error)
    }
    if (storagePath) {
      const { error } = await admin.storage.from('product-images').remove([storagePath])
      assert.ifError(error)
    }
    const { error } = await admin.storage.from('product-images').remove([deniedImagePath])
    assert.ifError(error)
  })

  const { data: category, error: categoryError } = await admin
    .from('categories')
    .select('id')
    .limit(1)
    .single()
  assert.ifError(categoryError)

  const product = {
    id: productId,
    name: 'Security verification product',
    slug: `security-verification-${productId}`,
    description: 'Created and removed by the live admin API integration test.',
    dimensions: null,
    material: 'Oak',
    price: 123,
    minimum_order_quantity: 1,
    featured: false,
    in_stock: true,
    is_published: false,
    category_id: category.id,
  }

  await t.test('anonymous, non-admin, and cross-origin requests are rejected by the app', async () => {
    const anonymousRequest = await appRequest('/api/admin/products')
    assert.equal(anonymousRequest.status, 401)

    const deniedUser = await appRequest('/api/admin/products', { cookie: userCookie })
    assert.equal(deniedUser.status, 403)

    const crossOrigin = await fetch(new URL('/api/admin/products', appBaseUrl), {
      method: 'POST',
      headers: { Origin: 'https://attacker.invalid', Cookie: adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ product, images: [] }),
    })
    assert.equal(crossOrigin.status, 403)

    const deniedMutation = await appRequest('/api/admin/products', {
      cookie: userCookie,
      method: 'POST',
      body: JSON.stringify({ product, images: [] }),
      contentType: 'application/json',
    })
    assert.equal(deniedMutation.status, 403)

    const deniedUploadForm = new FormData()
    deniedUploadForm.set('productId', productId)
    deniedUploadForm.set('file', new Blob([testImage], { type: 'image/png' }), 'test.png')
    const deniedUpload = await fetch(new URL('/api/admin/product-images', appBaseUrl), {
      method: 'POST',
      headers: { Origin: appUrl.origin, Cookie: userCookie },
      body: deniedUploadForm,
    })
    assert.equal(deniedUpload.status, 403)

    const deniedRpc = await ordinaryUser.rpc('admin_save_product', {
      p_product: { id: productId, name: 'Unauthorized' },
      p_images: [],
    })
    assert.ok(deniedRpc.error, 'RLS must reject direct RPC calls from an authenticated non-admin.')

    const deniedStorageUpload = await ordinaryUser.storage.from('product-images').upload(
      deniedImagePath,
      testImage,
      { contentType: 'image/png' },
    )
    assert.ok(deniedStorageUpload.error, 'Storage policies must reject direct uploads from an authenticated non-admin.')
  })

  await t.test('admin can upload an image and create/update/delete a persisted product', async () => {
    const invalidForm = new FormData()
    invalidForm.set('productId', productId)
    invalidForm.set('file', new Blob(['not an image'], { type: 'text/plain' }), 'invalid.txt')
    const invalidUpload = await fetch(new URL('/api/admin/product-images', appBaseUrl), {
      method: 'POST',
      headers: { Origin: appUrl.origin, Cookie: adminCookie },
      body: invalidForm,
    })
    assert.equal(invalidUpload.status, 400)

    const uploadForm = new FormData()
    uploadForm.set('productId', productId)
    uploadForm.set('file', new Blob([testImage], { type: 'image/png' }), 'test.png')
    const uploadResponse = await fetch(new URL('/api/admin/product-images', appBaseUrl), {
      method: 'POST',
      headers: { Origin: appUrl.origin, Cookie: adminCookie },
      body: uploadForm,
    })
    assert.equal(uploadResponse.status, 200)
    const { image } = await uploadResponse.json()
    storagePath = image.storage_path

    const createResponse = await appRequest('/api/admin/products', {
      cookie: adminCookie,
      method: 'POST',
      body: JSON.stringify({ product, images: [image] }),
      contentType: 'application/json',
    })
    assert.equal(createResponse.status, 200, await createResponse.text())
    productCreated = true

    const createdRow = await admin.from('products').select('*').eq('id', productId).single()
    assert.ifError(createdRow.error)
    assert.equal(createdRow.data.name, product.name)
    const createdImage = await admin.from('product_images').select('*').eq('product_id', productId).single()
    assert.ifError(createdImage.error)
    assert.equal(createdImage.data.storage_path, storagePath)
    const storedImage = await anonymous.storage.from('product-images').download(storagePath)
    assert.ifError(storedImage.error)
    assert.ok(storedImage.data)

    const updateResponse = await appRequest('/api/admin/products', {
      cookie: adminCookie,
      method: 'PUT',
      body: JSON.stringify({
        product: { ...product, name: 'Updated security verification product', is_published: true },
        images: [image],
      }),
      contentType: 'application/json',
    })
    assert.equal(updateResponse.status, 200, await updateResponse.text())

    const publicResponse = await appRequest('/api/storefront/products')
    assert.equal(publicResponse.status, 200)
    const publicCatalog = await publicResponse.json()
    assert.ok(Array.isArray(publicCatalog.products), 'Public catalog endpoint should return a products array.')
    const publicProducts = publicCatalog.products
    assert.ok(publicProducts.some((item) => item.id === productId), 'A published update should invalidate the storefront cache immediately.')
    assert.equal(publicProducts.find((item) => item.id === productId).name, 'Updated security verification product')

    const publicProductPage = await appRequest(`/products/${encodeURIComponent(product.slug)}`)
    assert.equal(publicProductPage.status, 200)
    assert.match(await publicProductPage.text(), /Updated security verification product/)

    const deleteResponse = await fetch(new URL(`/api/admin/products/${productId}`, appBaseUrl), {
      method: 'DELETE',
      headers: { Origin: appUrl.origin, Cookie: adminCookie },
    })
    assert.equal(deleteResponse.status, 200, await deleteResponse.text())
    productCreated = false

    const deletedRow = await admin.from('products').select('id').eq('id', productId).maybeSingle()
    assert.ifError(deletedRow.error)
    assert.equal(deletedRow.data, null)
    const deletedImage = await anonymous.storage.from('product-images').download(storagePath)
    assert.ok(deletedImage.error, 'Deleting a product should remove its uploaded storage object.')
    storagePath = undefined
    const publicAfterDelete = await appRequest('/api/storefront/products')
    assert.equal(publicAfterDelete.status, 200)
    const catalogAfterDelete = await publicAfterDelete.json()
    assert.ok(
      !catalogAfterDelete.products.some((item) => item.id === productId),
      'A deleted product should disappear after cache invalidation.',
    )
    const deletedProductPage = await appRequest(`/products/${encodeURIComponent(product.slug)}`)
    assert.equal(deletedProductPage.status, 404)
  })
})
