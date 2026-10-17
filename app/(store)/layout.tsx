import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import WhatsAppFloat from '@/components/layout/WhatsAppFloat'
import { getNavSettings } from '@/lib/data'

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  const navSettings = getNavSettings()

  return (
    <>
      <Navbar navSettings={navSettings} />
      <main className="min-h-screen">{children}</main>
      <Footer navSettings={navSettings} />
      <WhatsAppFloat />
    </>
  )
}
