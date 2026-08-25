import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Skylark BI Agent',
  description: 'Skylark Drones Business Intelligence Agent — powered by Monday.com',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">
        {children}
      </body>
    </html>
  )
}
