'use client'

import { useCallback, useEffect } from 'react'
import useSWR from 'swr'
import { HardDrive, ScanLine, WifiOff } from 'lucide-react'
import { listStudies, onStudiesChanged } from '@/lib/db'
import { useImporter } from '@/hooks/use-importer'
import { ImportDropzone } from './import-dropzone'
import { StudyList } from './study-list'
import { StorageIndicator } from './storage-indicator'

export function StudyManager() {
  const { data: studies, isLoading, mutate } = useSWR('studies', listStudies)
  useEffect(() => onStudiesChanged(() => mutate()), [mutate])

  const onImported = useCallback(() => {
    mutate()
  }, [mutate])
  const importer = useImporter(onImported)

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary/15 text-primary">
              <ScanLine className="size-4.5" aria-hidden />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight">ДентаВью</p>
              <p className="text-xs text-muted-foreground">Просмотр КЛКТ</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="hidden items-center gap-1.5 sm:flex">
              <WifiOff className="size-3.5" aria-hidden />
              Работает офлайн
            </span>
            <StorageIndicator count={studies?.length ?? 0} />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
        <section aria-labelledby="import-heading" className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h1 id="import-heading" className="text-xl font-semibold tracking-tight text-balance">
              Менеджер исследований
            </h1>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground text-pretty">
              <HardDrive className="size-3.5 shrink-0" aria-hidden />
              Файлы обрабатываются в браузере и хранятся только на этом устройстве — ничего не отправляется на сервер.
            </p>
          </div>
          <ImportDropzone importer={importer} />
        </section>

        <section aria-labelledby="studies-heading" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 id="studies-heading" className="text-sm font-medium">
              Исследования
              {studies?.length ? <span className="ml-2 font-mono text-muted-foreground">{studies.length}</span> : null}
            </h2>
          </div>
          <StudyList studies={studies} loading={isLoading} onLoadDemo={importer.importPhantom} />
        </section>
      </main>
    </div>
  )
}
