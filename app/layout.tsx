import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ServiceWorkerRegister } from '@/components/sw-register'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const geist = Geist({ subsets: ['latin', 'cyrillic'], variable: '--font-geist-sans' })
const geistMono = Geist_Mono({ subsets: ['latin', 'cyrillic'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: 'ДентаВью — просмотр КЛКТ',
  description:
    'Браузерный просмотрщик КЛКТ/CBCT для стоматологов: MPR, панорамная реконструкция, кросс-срезы и измерения. Работает офлайн, данные хранятся локально.',
  generator: 'v0.app',
  applicationName: 'ДентаВью',
  appleWebApp: { capable: true, title: 'ДентаВью', statusBarStyle: 'black-translucent' },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icon-512.png', type: 'image/png' }],
    apple: '/icon-512.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#16191f',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased bg-background">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delay={300}>{children}</TooltipProvider>
          <ServiceWorkerRegister />
          {process.env.NODE_ENV === 'production' && <Analytics />}
        </ThemeProvider>
      </body>
    </html>
  )
}
