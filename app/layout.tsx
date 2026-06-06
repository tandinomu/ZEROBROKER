import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import ThemeProvider from '@/components/ThemeProvider'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'Zero Broker — Bhutan Real Estate',
  description: 'Find, buy and sell property across all 20 Dzongkhags of Bhutan.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Prevent flash of unstyled theme */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('zb-theme');if(t==='dark')document.documentElement.classList.add('dark')}catch(e){}})()` }} />
      </head>
      <body>
        <ThemeProvider>
          <Navbar />
          <main>{children}</main>
          <Toaster position="top-right" toastOptions={{ style: { fontFamily: 'var(--font-body)', borderRadius: '8px', border: '1px solid var(--border)' } }} />
        </ThemeProvider>
      </body>
    </html>
  )
}
