import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'Zero Broker — Bhutan Real Estate',
  description: 'Find, buy and sell property across all 20 Dzongkhags of Bhutan.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <main>{children}</main>
        <Toaster position="top-right" toastOptions={{ style: { fontFamily: 'var(--font-body)', borderRadius: '8px', border: '1px solid var(--border)' } }} />
      </body>
    </html>
  )
}
