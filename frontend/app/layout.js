// Root Layout
import './globals.css'

export const metadata = {
  title: 'WhatsApp Gateway SaaS',
  description: 'Professional WhatsApp API untuk monitoring jaringan',
}

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  )
}
