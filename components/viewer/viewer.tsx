'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import useSWR from 'swr'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { loadVolume } from '@/lib/db'
import { useViewer } from '@/lib/viewer-store'
import { ViewerToolbar } from './viewer-toolbar'
import { MprLayout } from './mpr-layout'
import { PanoramaLayout } from './panorama-layout'
import { useViewerShortcuts } from './use-viewer-shortcuts'
import { AdjustPanel } from './adjust-panel'
import { initializeCornerstone } from '@/lib/cornerstone-init'

export function Viewer({ id }: { id: string }) {
  const { data, error, isLoading } = useSWR(id ? ['volume', id] : null, () => loadVolume(id), {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    revalidateOnReconnect: false,
  })
  const layout = useViewer((s) => s.layout)
  const ready = useViewer((s) => s.dims === data?.meta.dims)
  const init = useViewer((s) => s.init)

  useEffect(() => {
    initializeCornerstone()
  }, [])

  useEffect(() => {
    if (!data) return
    init(data.meta.dims, data.meta.window)
    document.title = `${data.meta.patientName || 'Без имени'} · ДентаВью`
  }, [data, init])

  useViewerShortcuts()

  if (error || (!id && !isLoading)) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <p className="text-sm text-muted-foreground">{error ? String(error.message ?? error) : 'Исследование не указано'}</p>
        <Button render={<Link href="/" />} nativeButton={false} variant="outline">
          <ArrowLeft data-icon="inline-start" />К списку исследований
        </Button>
      </main>
    )
  }

  if (!data || !ready) {
    return (
      <main className="flex min-h-dvh items-center justify-center gap-2 bg-black text-sm text-muted-foreground" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Загрузка объёма из локального хранилища…
      </main>
    )
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-black text-foreground">
      <ViewerToolbar meta={data.meta} />
      <div className="flex min-h-0 flex-1">
        <main className="min-h-0 min-w-0 flex-1 p-1.5">
          {layout === 'mpr' ? <MprLayout volume={data.volume} meta={data.meta} /> : <PanoramaLayout volume={data.volume} />}
        </main>
        <AdjustPanel />
      </div>
    </div>
  )
}
