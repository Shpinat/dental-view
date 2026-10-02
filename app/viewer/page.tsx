import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ViewerClient } from './viewer-client'
import { Loader2 } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Просмотр исследования · ДентаВью',
}

export default function ViewerPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center gap-2 bg-black text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Загрузка...
        </main>
      }
    >
      <ViewerClient />
    </Suspense>
  )
}
