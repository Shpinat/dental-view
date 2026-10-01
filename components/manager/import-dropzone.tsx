'use client'

import { useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileUp, FolderUp, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { collectDroppedFiles, type useImporter } from '@/hooks/use-importer'

type Importer = ReturnType<typeof useImporter>

export function ImportDropzone({ importer }: { importer: Importer }) {
  const { state, importFiles, reset } = importer
  const [dragging, setDragging] = useState(false)
  const folderInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const running = state.status === 'running'
  const pct = state.total ? Math.round((state.done / state.total) * 100) : 0

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (running) return
    const files = await collectDroppedFiles(e.dataTransfer.items)
    importFiles(files)
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    importFiles(files)
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border bg-card/50 px-6 py-10 text-center transition-colors',
          dragging && 'border-primary bg-primary/5',
        )}
      >
        {running ? (
          <div className="flex w-full max-w-sm flex-col items-center gap-3" role="status" aria-live="polite">
            <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
            <p className="text-sm font-medium">{state.stage}</p>
            <Progress value={pct} className="w-full" aria-label="Прогресс импорта" />
            <p className="font-mono text-xs text-muted-foreground tabular-nums">
              {state.total > 100 || state.stage.startsWith('Чтение')
                ? `${state.done} / ${state.total} файлов`
                : `${pct}%`}
            </p>
          </div>
        ) : (
          <>
            <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <FolderUp className="size-5" aria-hidden />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Перетащите папку с DICOM-файлами сюда</p>
              <p className="text-xs text-muted-foreground">
                {'Поддерживаются .dcm и файлы без расширения · несжатые и RLE · несколько серий за раз'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button onClick={() => folderInput.current?.click()}>
                <FolderUp data-icon="inline-start" />
                Выбрать папку
              </Button>
              <Button variant="outline" onClick={() => fileInput.current?.click()}>
                <FileUp data-icon="inline-start" />
                Выбрать файлы
              </Button>
            </div>
          </>
        )}
        <input
          ref={folderInput}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={onPick}
          {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
        />
        <input ref={fileInput} type="file" multiple className="sr-only" tabIndex={-1} aria-hidden onChange={onPick} />
      </div>

      {state.status === 'done' && (
        <Notice tone="success" onClose={reset}>
          Импортировано серий: {state.imported}.
          {state.warnings.length > 0 && (
            <ul className="mt-1 list-inside list-disc text-muted-foreground">
              {state.warnings.slice(0, 4).map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </Notice>
      )}
      {state.status === 'error' && (
        <Notice tone="error" onClose={reset}>
          {state.message}
        </Notice>
      )}
    </div>
  )
}

function Notice({
  tone,
  children,
  onClose,
}: {
  tone: 'success' | 'error'
  children: React.ReactNode
  onClose: () => void
}) {
  const Icon = tone === 'success' ? CheckCircle2 : AlertTriangle
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 rounded-md border px-3 py-2.5 text-sm',
        tone === 'success' ? 'border-primary/30 bg-primary/5' : 'border-destructive/40 bg-destructive/10',
      )}
    >
      <Icon
        className={cn('mt-0.5 size-4 shrink-0', tone === 'success' ? 'text-primary' : 'text-destructive')}
        aria-hidden
      />
      <div className="flex-1">{children}</div>
      <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="Закрыть">
        <X />
      </Button>
    </div>
  )
}
