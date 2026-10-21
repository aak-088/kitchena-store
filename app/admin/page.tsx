'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { AuthChangeEvent, AuthError, Session } from '@supabase/supabase-js'
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase/client'

type Category = {
  id: string
  name: string
  slug: string
}

type ProductImage = {
  id: string
  product_id: string
  url: string
  alt_text: string | null
  is_primary: boolean
  display_order: number
  storage_path: string | null
}

type Product = {
  id: string
  name: string
  slug: string
  description: string
  dimensions: string | null
  material: string | null
  price: number | null
  minimum_order_quantity: number | null
  featured: boolean
  in_stock: boolean
  is_published: boolean
  category_id: string
  updated_at: string
  images: ProductImage[]
}

type DraftImage = Pick<ProductImage, 'id' | 'url' | 'alt_text' | 'storage_path'>

type ProductDraft = {
  id: string
  name: string
  slug: string
  description: string
  dimensions: string
  material: string
  price: string
  minimum_order_quantity: string
  category_id: string
  featured: boolean
  in_stock: boolean
  is_published: boolean
  images: DraftImage[]
  files: File[]
}

const inputClass = 'mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-amber-700 focus:ring-2 focus:ring-amber-100'
const labelClass = 'block text-sm font-medium text-stone-700'

type AdminProductsResponse = { categories: Category[]; products: Product[] }

class AdminApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'AdminApiError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isAdminProductsResponse(value: unknown): value is AdminProductsResponse {
  if (!isRecord(value) || !Array.isArray(value.categories) || !Array.isArray(value.products)) return false

  return value.categories.every((category) =>
    isRecord(category)
    && typeof category.id === 'string'
    && typeof category.name === 'string'
    && typeof category.slug === 'string')
    && value.products.every((product) =>
      isRecord(product)
      && typeof product.id === 'string'
      && typeof product.name === 'string'
      && typeof product.slug === 'string'
      && typeof product.description === 'string'
      && typeof product.category_id === 'string'
      && typeof product.updated_at === 'string'
      && Array.isArray(product.images)
      && product.images.every((image) =>
        isRecord(image)
        && typeof image.id === 'string'
        && typeof image.url === 'string'
        && typeof image.product_id === 'string'
        && typeof image.is_primary === 'boolean'
        && typeof image.display_order === 'number'))
}

async function adminRequest(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, { ...init, cache: 'no-store' })
  const body: unknown = await response.json()
  if (!response.ok) {
    const message = isRecord(body) && typeof body.error === 'string'
      ? body.error
      : 'تعذر تنفيذ طلب الإدارة.'
    throw new AdminApiError(message, response.status)
  }
  return body
}

function newDraft(): ProductDraft {
  return {
    id: crypto.randomUUID(),
    name: '',
    slug: '',
    description: '',
    dimensions: '',
    material: '',
    price: '',
    minimum_order_quantity: '',
    category_id: '',
    featured: false,
    in_stock: true,
    is_published: true,
    images: [],
    files: [],
  }
}

function productDraft(product: Product): ProductDraft {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    dimensions: product.dimensions ?? '',
    material: product.material ?? '',
    price: product.price === null ? '' : String(product.price),
    minimum_order_quantity: product.minimum_order_quantity === null ? '' : String(product.minimum_order_quantity),
    category_id: product.category_id,
    featured: product.featured,
    in_stock: product.in_stock,
    is_published: product.is_published,
    images: product.images.map(({ id, url, alt_text, storage_path }) => ({ id, url, alt_text, storage_path })),
    files: [],
  }
}

function makeSlug(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : 'حدث خطأ غير متوقع. حاول مرة أخرى.'
}

export default function AdminPage() {
  const supabase = getSupabaseBrowserClient()
  const [session, setSession] = useState<Session | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [adminState, setAdminState] = useState<'checking' | 'ready' | 'denied' | 'error'>('checking')
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [draft, setDraft] = useState<ProductDraft | null>(null)
  const [search, setSearch] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)

  const refreshProducts = useCallback(async () => {
    const response = await adminRequest('/api/admin/products')
    if (!isAdminProductsResponse(response)) {
      throw new Error('استجابة إدارة المنتجات غير صالحة.')
    }
    setCategories(response.categories)
    setProducts(response.products)
  }, [])

  useEffect(() => {
    if (!supabase) {
      setCheckingSession(false)
      return
    }

    let active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((
      _event: AuthChangeEvent,
      nextSession: Session | null,
    ) => {
      setSession(nextSession)
      setCheckingSession(false)
    })

    void supabase.auth.getSession().then(({
      data,
      error,
    }: { data: { session: Session | null }; error: AuthError | null }) => {
      if (!active) return
      if (error) setFeedback({ kind: 'error', text: `تعذر التحقق من الجلسة: ${error.message}` })
      setSession(data.session)
      setCheckingSession(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [supabase])

  useEffect(() => {
    if (!session?.user || !supabase) {
      setAdminState('checking')
      setProducts([])
      setCategories([])
      return
    }

    let active = true
    setAdminState('checking')
    void (async () => {
      await refreshProducts()
      if (active) setAdminState('ready')
    })().catch((error: unknown) => {
      if (active) {
        setAdminState(error instanceof AdminApiError && error.status === 403 ? 'denied' : 'error')
        setFeedback({ kind: 'error', text: formatError(error) })
      }
    })

    return () => {
      active = false
    }
  }, [refreshProducts, session])

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    if (!query) return products
    return products.filter((product) =>
      `${product.name} ${product.slug}`.toLocaleLowerCase().includes(query))
  }, [products, search])

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return

    setBusy(true)
    setFeedback(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setFeedback({ kind: 'error', text: `تعذر تسجيل الدخول: ${error.message}` })
  }

  async function signOut() {
    if (!supabase) return
    setBusy(true)
    const { error } = await supabase.auth.signOut()
    setBusy(false)
    if (error) setFeedback({ kind: 'error', text: `تعذر تسجيل الخروج: ${error.message}` })
  }

  function updateDraft<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) {
    setDraft((current) => current ? { ...current, [key]: value } : current)
  }

  function selectFiles(files: FileList | null) {
    if (!files || !draft) return
    const selected = Array.from(files)
    const invalid = selected.find((file) =>
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024)
    if (invalid) {
      setFeedback({ kind: 'error', text: 'استخدم صور JPG أو PNG أو WebP بحجم لا يتجاوز 10 ميغابايت للصورة.' })
      return
    }

    updateDraft('files', [...draft.files, ...selected])
    setFeedback(null)
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !draft) return

    const slug = (draft.slug.trim() || makeSlug(draft.name)).trim()
    const price = draft.price.trim() ? Number(draft.price) : null
    const quantity = draft.minimum_order_quantity.trim() ? Number(draft.minimum_order_quantity) : null
    if (!draft.name.trim() || !draft.description.trim() || !draft.category_id || !slug) {
      setFeedback({ kind: 'error', text: 'أدخل اسم المنتج ووصفه ورابطه واختر تصنيفاً.' })
      return
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setFeedback({ kind: 'error', text: 'اكتب رابطاً مختصراً بحروف إنجليزية صغيرة وأرقام وشرطات فقط.' })
      return
    }
    if (draft.images.length + draft.files.length === 0) {
      setFeedback({ kind: 'error', text: 'أضف صورة واحدة على الأقل للمنتج.' })
      return
    }
    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      setFeedback({ kind: 'error', text: 'أدخل سعراً صحيحاً أو اترك الحقل فارغاً.' })
      return
    }
    if (quantity !== null && (!Number.isInteger(quantity) || quantity < 1)) {
      setFeedback({ kind: 'error', text: 'الحد الأدنى للطلب يجب أن يكون عدداً صحيحاً أكبر من صفر.' })
      return
    }

    setBusy(true)
    setFeedback(null)
    const uploadedPaths: string[] = []
    const cleanupWarnings: string[] = []
    let saved = false

    try {
      const imageRows: Array<{
        id: string
        url: string
        alt_text: string | null
        is_primary: boolean
        display_order: number
        storage_path: string | null
      }> = draft.images.map((image, index) => ({
        id: image.id,
        url: image.url,
        alt_text: image.alt_text,
        is_primary: index === 0,
        display_order: index,
        storage_path: image.storage_path,
      }))

      for (let index = 0; index < draft.files.length; index += 1) {
        const file = draft.files[index]
        const form = new FormData()
        form.set('productId', draft.id)
        form.set('file', file)
        const result = await adminRequest('/api/admin/product-images', {
          method: 'POST',
          body: form,
        })
        const uploadedImage = isRecord(result) ? result.image : null
        if (
          !isRecord(uploadedImage)
          || typeof uploadedImage.id !== 'string'
          || typeof uploadedImage.url !== 'string'
          || typeof uploadedImage.storage_path !== 'string'
        ) {
          throw new Error(`استجابة رفع الصورة "${file.name}" غير صالحة.`)
        }
        uploadedPaths.push(uploadedImage.storage_path)
        imageRows.push({
          id: uploadedImage.id,
          url: uploadedImage.url,
          alt_text: draft.name.trim(),
          is_primary: imageRows.length === 0 && index === 0,
          display_order: imageRows.length,
          storage_path: uploadedImage.storage_path,
        })
      }

      const productPayload = {
        id: draft.id,
        name: draft.name.trim(),
        slug,
        description: draft.description.trim(),
        dimensions: draft.dimensions.trim(),
        material: draft.material.trim(),
        price,
        minimum_order_quantity: quantity,
        featured: draft.featured,
        in_stock: draft.in_stock,
        is_published: draft.is_published,
        category_id: draft.category_id,
      }
      await adminRequest('/api/admin/products', {
        method: products.some((product) => product.id === draft.id) ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: productPayload, images: imageRows }),
      })
      saved = true

      const retainedStoragePaths = new Set(imageRows.flatMap((image) => image.storage_path ? [image.storage_path] : []))
      const removedStoragePaths = products
        .find((product) => product.id === draft.id)?.images
        .flatMap((image) => image.storage_path ? [image.storage_path] : [])
        .filter((storagePath) => !retainedStoragePaths.has(storagePath)) ?? []
      for (const storagePath of removedStoragePaths) {
        try {
          await adminRequest(
            `/api/admin/product-images?productId=${encodeURIComponent(draft.id)}&path=${encodeURIComponent(storagePath)}`,
            { method: 'DELETE' },
          )
        } catch (cleanupError) {
          cleanupWarnings.push(`تعذر حذف ملف صورة قديمة: ${formatError(cleanupError)}`)
        }
      }

      await refreshProducts()

      setDraft(null)
      setFeedback({
        kind: cleanupWarnings.length ? 'error' : 'success',
        text: cleanupWarnings.length
          ? `تم حفظ المنتج وتحديث واجهة المتجر. ${cleanupWarnings.join(' ')}`
          : 'تم حفظ المنتج وتحديث واجهة المتجر مباشرة.',
      })
    } catch (error) {
      let message = formatError(error)
      if (!saved && uploadedPaths.length) {
        for (const storagePath of uploadedPaths) {
          try {
            await adminRequest(
              `/api/admin/product-images?productId=${encodeURIComponent(draft.id)}&path=${encodeURIComponent(storagePath)}`,
              { method: 'DELETE' },
            )
          } catch (cleanupError) {
            message += ` تعذر تنظيف الصورة المرفوعة: ${formatError(cleanupError)}`
          }
        }
      }
      if (saved) {
        message = `تم حفظ المنتج وإبطال ذاكرة المتجر، لكن تعذر تحديث القائمة: ${message} ${cleanupWarnings.join(' ')}`
      }
      setFeedback({ kind: 'error', text: message })
    } finally {
      setBusy(false)
    }
  }

  async function deleteProduct(product: Product) {
    if (!supabase || !window.confirm(`هل تريد حذف «${product.name}» نهائياً؟`)) return

    setBusy(true)
    setFeedback(null)
    let deleted = false
    try {
      const result = await adminRequest(`/api/admin/products/${encodeURIComponent(product.id)}`, { method: 'DELETE' })
      deleted = true

      await refreshProducts()
      const warning = isRecord(result) && typeof result.warning === 'string' ? result.warning : null
      setFeedback({
        kind: warning ? 'error' : 'success',
        text: warning ?? 'تم حذف المنتج وتحديث واجهة المتجر مباشرة.',
      })
    } catch (error) {
      const message = formatError(error)
      setFeedback({
        kind: 'error',
        text: deleted ? `تم حذف المنتج، لكن تعذر تحديث قائمة الإدارة: ${message}` : message,
      })
    } finally {
      setBusy(false)
    }
  }

  const page = (
    <main dir="rtl" lang="ar" className="min-h-screen bg-[#f7f5f1] text-stone-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 pb-6">
          <div>
            <p className="text-xs font-semibold tracking-[0.24em] text-amber-800">KITCHENA · ADMIN</p>
            <h1 className="mt-2 font-display text-3xl font-semibold">لوحة إدارة المتجر</h1>
            <p className="mt-1 text-sm text-stone-500">إدارة المنتجات والصور ونشرها مباشرة إلى واجهة المتجر.</p>
          </div>
          {session && (
            <button type="button" onClick={signOut} disabled={busy} className="rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-medium transition hover:bg-white disabled:opacity-50">
              تسجيل الخروج
            </button>
          )}
        </header>

        {!isSupabaseConfigured ? (
          <section className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
            <h2 className="text-xl font-semibold">يلزم إعداد اتصال Supabase</h2>
            <p className="mt-3 leading-7 text-stone-600">أضف NEXT_PUBLIC_SUPABASE_URL وNEXT_PUBLIC_SUPABASE_ANON_KEY إلى إعدادات البيئة ثم أعد تشغيل البناء.</p>
          </section>
        ) : checkingSession ? (
          <p className="rounded-2xl bg-white p-8 text-center text-stone-600">جارٍ التحقق من الجلسة…</p>
        ) : !session ? (
          <form onSubmit={signIn} className="mx-auto max-w-md rounded-2xl border border-stone-200 bg-white p-7 shadow-sm">
            <h2 className="text-xl font-semibold">تسجيل دخول المدير</h2>
            <p className="mt-2 text-sm leading-6 text-stone-500">تُنشأ حسابات المديرين مسبقاً في Supabase. لا يمكن إنشاء حساب من هذه الصفحة.</p>
            <label className={`${labelClass} mt-6`}>
              البريد الإلكتروني
              <input className={inputClass} autoComplete="username" dir="ltr" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className={`${labelClass} mt-4`}>
              كلمة المرور
              <input className={inputClass} autoComplete="current-password" dir="ltr" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <button disabled={busy} className="mt-6 w-full rounded-xl bg-stone-900 px-4 py-3 font-medium text-white transition hover:bg-amber-800 disabled:opacity-50">
              {busy ? 'جارٍ تسجيل الدخول…' : 'دخول آمن'}
            </button>
          </form>
        ) : adminState === 'checking' ? (
          <p className="rounded-2xl bg-white p-8 text-center text-stone-600">جارٍ التحقق من صلاحيات المدير…</p>
        ) : adminState === 'denied' ? (
          <section className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-8 text-center">
            <h2 className="text-xl font-semibold">لا يملك هذا الحساب صلاحية الإدارة</h2>
            <p className="mt-2 text-stone-600">اطلب من مسؤول المشروع إضافة حسابك إلى قائمة المديرين في Supabase.</p>
          </section>
        ) : adminState === 'error' ? (
          <section className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-8 text-center">
            <h2 className="text-xl font-semibold">تعذر تحميل لوحة الإدارة</h2>
            <button type="button" onClick={() => void refreshProducts().then(() => setAdminState('ready')).catch((error: unknown) => setFeedback({ kind: 'error', text: formatError(error) }))} className="mt-4 rounded-xl bg-stone-900 px-4 py-2.5 text-white">
              إعادة المحاولة
            </button>
          </section>
        ) : (
          <>
            <section className="mb-7 grid gap-4 sm:grid-cols-3">
              {[
                { label: 'إجمالي المنتجات', value: products.length },
                { label: 'المنتجات المنشورة', value: products.filter((product) => product.is_published).length },
                { label: 'التصنيفات المتاحة', value: categories.length },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                  <p className="text-sm text-stone-500">{stat.label}</p>
                  <p className="mt-2 text-3xl font-semibold">{stat.value}</p>
                </div>
              ))}
            </section>

            <section className="rounded-2xl border border-stone-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-100 p-5 sm:p-6">
                <div>
                  <h2 className="text-xl font-semibold">المنتجات</h2>
                  <p className="mt-1 text-sm text-stone-500">تظهر التغييرات المحفوظة فور إبطال ذاكرة المتجر.</p>
                </div>
                <button type="button" onClick={() => { setDraft(newDraft()); setFeedback(null) }} disabled={busy || categories.length === 0} className="rounded-xl bg-amber-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-amber-900 disabled:opacity-50">
                  + إضافة منتج
                </button>
              </div>

              {categories.length === 0 && (
                <p className="m-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">لا توجد تصنيفات في قاعدة البيانات. طبّق ترحيلات Supabase لإضافة بيانات المتجر الحالية.</p>
              )}

              <div className="p-5 sm:p-6">
                <label className="sr-only" htmlFor="product-search">البحث عن منتج</label>
                <input id="product-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث عن منتج…" className={`${inputClass} mt-0 max-w-md`} />

                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[680px] text-right text-sm">
                    <thead className="text-xs text-stone-500">
                      <tr className="border-b border-stone-100">
                        <th className="px-3 py-3 font-medium">المنتج</th>
                        <th className="px-3 py-3 font-medium">التصنيف</th>
                        <th className="px-3 py-3 font-medium">الحالة</th>
                        <th className="px-3 py-3 font-medium">السعر</th>
                        <th className="px-3 py-3 font-medium">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleProducts.map((product) => (
                        <tr key={product.id} className="border-b border-stone-100 last:border-0">
                          <td className="px-3 py-4">
                            <div className="flex items-center gap-3">
                              {product.images[0] ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={product.images[0].url} alt="" className="h-12 w-14 rounded-lg object-cover" />
                              ) : <div className="h-12 w-14 rounded-lg bg-stone-100" />}
                              <div>
                                <p className="font-medium">{product.name}</p>
                                <p dir="ltr" className="mt-1 text-xs text-stone-400">{product.slug}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-4">{categories.find((category) => category.id === product.category_id)?.name ?? '—'}</td>
                          <td className="px-3 py-4">
                            <span className={`rounded-full px-2.5 py-1 text-xs ${product.is_published ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-stone-600'}`}>
                              {product.is_published ? 'منشور' : 'مسودة'}
                            </span>
                          </td>
                          <td className="px-3 py-4">{product.price === null ? '—' : `${product.price.toLocaleString('en-IN')} ₹`}</td>
                          <td className="px-3 py-4">
                            <div className="flex gap-2">
                              <button type="button" onClick={() => { setDraft(productDraft(product)); setFeedback(null) }} disabled={busy} className="rounded-lg border border-stone-200 px-3 py-1.5 hover:bg-stone-50 disabled:opacity-50">تعديل</button>
                              <button type="button" onClick={() => void deleteProduct(product)} disabled={busy} className="rounded-lg border border-red-200 px-3 py-1.5 text-red-700 hover:bg-red-50 disabled:opacity-50">حذف</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {visibleProducts.length === 0 && (
                        <tr><td colSpan={5} className="px-3 py-10 text-center text-stone-500">لا توجد منتجات مطابقة.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {draft && (
              <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/50 p-3 sm:p-6" role="presentation" onMouseDown={(event) => {
                if (event.target === event.currentTarget && !busy) setDraft(null)
              }}>
                <section role="dialog" aria-modal="true" aria-labelledby="product-editor-title" className="mx-auto my-4 max-w-3xl rounded-2xl bg-white shadow-2xl sm:my-8">
                  <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4 sm:px-7">
                    <h2 id="product-editor-title" className="text-xl font-semibold">{products.some((product) => product.id === draft.id) ? 'تعديل المنتج' : 'إضافة منتج'}</h2>
                    <button type="button" onClick={() => setDraft(null)} disabled={busy} aria-label="إغلاق" className="rounded-lg p-2 text-xl text-stone-500 hover:bg-stone-100">×</button>
                  </div>

                  <form onSubmit={saveProduct} className="space-y-5 p-5 sm:p-7">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className={labelClass}>
                        اسم المنتج
                        <input className={inputClass} required maxLength={120} value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} />
                      </label>
                      <label className={labelClass}>
                        الرابط المختصر
                        <input dir="ltr" className={inputClass} maxLength={140} placeholder={makeSlug(draft.name) || 'product-slug'} value={draft.slug} onChange={(event) => updateDraft('slug', event.target.value)} />
                      </label>
                    </div>

                    <label className={labelClass}>
                      وصف المنتج
                      <textarea className={inputClass} rows={4} required maxLength={5000} value={draft.description} onChange={(event) => updateDraft('description', event.target.value)} />
                    </label>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className={labelClass}>
                        التصنيف
                        <select className={inputClass} required value={draft.category_id} onChange={(event) => updateDraft('category_id', event.target.value)}>
                          <option value="">اختر تصنيفاً</option>
                          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                        </select>
                      </label>
                      <label className={labelClass}>
                        السعر (₹)
                        <input className={inputClass} type="number" min="0" step="0.01" value={draft.price} onChange={(event) => updateDraft('price', event.target.value)} />
                      </label>
                      <label className={labelClass}>
                        الخامة
                        <input className={inputClass} maxLength={200} value={draft.material} onChange={(event) => updateDraft('material', event.target.value)} />
                      </label>
                      <label className={labelClass}>
                        الأبعاد
                        <input className={inputClass} maxLength={200} value={draft.dimensions} onChange={(event) => updateDraft('dimensions', event.target.value)} />
                      </label>
                      <label className={labelClass}>
                        الحد الأدنى للطلب
                        <input className={inputClass} type="number" min="1" step="1" value={draft.minimum_order_quantity} onChange={(event) => updateDraft('minimum_order_quantity', event.target.value)} />
                      </label>
                    </div>

                    <div className="flex flex-wrap gap-x-6 gap-y-3">
                      {([
                        ['featured', 'منتج مميز'],
                        ['in_stock', 'متوفر في المخزون'],
                        ['is_published', 'نشر في المتجر'],
                      ] as const).map(([key, label]) => (
                        <label key={key} className="inline-flex items-center gap-2 text-sm text-stone-700">
                          <input type="checkbox" checked={draft[key]} onChange={(event) => updateDraft(key, event.target.checked)} className="h-4 w-4 accent-amber-800" />
                          {label}
                        </label>
                      ))}
                    </div>

                    <div>
                      <p className={labelClass}>صور المنتج</p>
                      <label className="mt-2 flex cursor-pointer flex-col items-center rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-center transition hover:border-amber-700">
                        <span className="font-medium">اختر صوراً من جهازك</span>
                        <span className="mt-1 text-xs text-stone-500">JPG أو PNG أو WebP · حتى 10 ميغابايت للصورة</span>
                        <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => selectFiles(event.target.files)} />
                      </label>
                      {(draft.images.length > 0 || draft.files.length > 0) && (
                        <ul className="mt-3 space-y-2">
                          {draft.images.map((image, index) => (
                            <li key={image.id} className="flex items-center gap-3 rounded-xl border border-stone-100 p-2">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={image.url} alt={image.alt_text ?? ''} className="h-12 w-14 rounded-lg object-cover" />
                              <span className="min-w-0 flex-1 truncate text-xs text-stone-500">{index === 0 ? 'الصورة الرئيسية' : `صورة ${index + 1}`}</span>
                              <button type="button" disabled={busy || index === 0} onClick={() => updateDraft('images', draft.images.map((item, itemIndex) => itemIndex === index ? draft.images[index - 1] : itemIndex === index - 1 ? draft.images[index] : item))} className="rounded-lg border border-stone-200 px-2 py-1 text-xs disabled:opacity-40">↑</button>
                              <button type="button" disabled={busy || index === draft.images.length - 1} onClick={() => updateDraft('images', draft.images.map((item, itemIndex) => itemIndex === index ? draft.images[index + 1] : itemIndex === index + 1 ? draft.images[index] : item))} className="rounded-lg border border-stone-200 px-2 py-1 text-xs disabled:opacity-40">↓</button>
                              <button type="button" disabled={busy} onClick={() => updateDraft('images', draft.images.filter((item) => item.id !== image.id))} className="rounded-lg px-2 py-1 text-xs text-red-700 hover:bg-red-50">إزالة</button>
                            </li>
                          ))}
                          {draft.files.map((file, index) => (
                            <li key={`${file.name}-${index}`} className="flex items-center justify-between rounded-xl border border-stone-100 p-3 text-xs">
                              <span className="truncate">{file.name}</span>
                              <button type="button" onClick={() => updateDraft('files', draft.files.filter((_, itemIndex) => itemIndex !== index))} className="mr-3 text-red-700">إزالة</button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="flex flex-wrap justify-end gap-3 border-t border-stone-100 pt-5">
                      <button type="button" onClick={() => setDraft(null)} disabled={busy} className="rounded-xl border border-stone-300 px-5 py-2.5 text-sm font-medium disabled:opacity-50">إلغاء</button>
                      <button type="submit" disabled={busy} className="rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-amber-800 disabled:opacity-50">
                        {busy ? 'جارٍ الحفظ…' : 'حفظ التغييرات'}
                      </button>
                    </div>
                  </form>
                </section>
              </div>
            )}
          </>
        )}

        {feedback && (
          <div role="status" className={`fixed bottom-5 left-5 right-5 z-[60] mx-auto max-w-xl rounded-xl px-5 py-4 text-sm shadow-lg sm:left-auto ${feedback.kind === 'error' ? 'bg-red-800 text-white' : 'bg-emerald-800 text-white'}`}>
            <div className="flex items-start justify-between gap-4">
              <p>{feedback.text}</p>
              <button type="button" onClick={() => setFeedback(null)} aria-label="إغلاق الرسالة">×</button>
            </div>
          </div>
        )}
      </div>
    </main>
  )

  return page
}
