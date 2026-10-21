import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'إدارة المتجر',
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div lang="ar" dir="rtl">{children}</div>
}
