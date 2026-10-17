/**
 * Generates a pre-filled WhatsApp message URL.
 * Works for product inquiries, bulk orders, and general contact.
 */

const BASE_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '+919876543210'

// Strip everything except digits
function cleanNumber(number: string): string {
  return number.replace(/\D/g, '')
}

export function whatsappProductLink({
  productName,
  material,
  price,
  quantity = 1,
  orderType = 'B2C',
}: {
  productName: string
  material?: string | null
  price?: number | null
  quantity?: number
  orderType?: 'B2C' | 'B2B'
}): string {
  const priceText = price
    ? `Price listed: ₹${price.toLocaleString('en-IN')}`
    : 'Price not listed — please quote'

  const materialText = material ? `\nMaterial: ${material}` : ''

  const message = orderType === 'B2B'
    ? `Hello Craftura! 🪑\n\nI'd like to enquire about a *bulk order* for:\n\n*${productName}*${materialText}\nQuantity: ${quantity} units\n${priceText}\n\nPlease share your best bulk pricing and lead time.`
    : `Hello Craftura! 🪑\n\nI'm interested in:\n\n*${productName}*${materialText}\nQuantity: ${quantity}\n${priceText}\n\nCould you please confirm availability and delivery details?`

  return `https://wa.me/${cleanNumber(BASE_NUMBER)}?text=${encodeURIComponent(message)}`
}

export function whatsappBulkOrderLink(company?: string): string {
  const message = company
    ? `Hello Craftura! 🏢\n\nI'm from *${company}* and would like to discuss a bulk furniture order.\n\nPlease get in touch to discuss our requirements.`
    : `Hello Craftura! 🏢\n\nI'd like to discuss a bulk / commercial furniture order.\n\nCould you please get in touch?`

  return `https://wa.me/${cleanNumber(BASE_NUMBER)}?text=${encodeURIComponent(message)}`
}

export function whatsappGeneralLink(message?: string): string {
  const text = message || `Hello Craftura! I'd like to know more about your furniture.`
  return `https://wa.me/${cleanNumber(BASE_NUMBER)}?text=${encodeURIComponent(text)}`
}

/**
 * Static-site replacement for server-side form submission:
 * builds a WhatsApp link whose message contains everything the visitor typed.
 */
export function whatsappFormLink(title: string, fields: Record<string, string | undefined | null>, extra?: string): string {
  const lines = Object.entries(fields)
    .filter(([, v]) => v && String(v).trim() !== '')
    .map(([k, v]) => `*${k}:* ${v}`)
  const message = `Hello Craftura! 🪑\n\n*${title}*\n\n${lines.join('\n')}${extra ? `\n\n${extra}` : ''}`
  return `https://wa.me/${cleanNumber(BASE_NUMBER)}?text=${encodeURIComponent(message)}`
}

export function openWhatsApp(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}
