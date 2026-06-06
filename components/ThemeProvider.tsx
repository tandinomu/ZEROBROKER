'use client'
import { useEffect } from 'react'

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const saved = localStorage.getItem('zb-theme')
    if (saved === 'dark') document.documentElement.classList.add('dark')
  }, [])
  return <>{children}</>
}
