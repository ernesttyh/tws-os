import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TWS OS — Marketing Command Center',
  description: 'The Wok\'s Star Branding Operations Platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
