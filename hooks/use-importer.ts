'use client'

import { useCallback, useRef, useState } from 'react'
import { saveStudy } from '@/lib/db'
import type { ImportedSeries, ImportWorkerMessage, StudyMeta } from '@/lib/types'
import { buildLut, extractAxial, renderToImageData } from '@/lib/volume'

export interface ImportState {
  status: 'idle' | 'running' | 'done' | 'error'
  stage: string
  done: number
  total: number
  message?: string
  warnings: string[]
  imported: number
}

const IDLE: ImportState = { status: 'idle', stage: '', done: 0, total: 0, warnings: [], imported: 0 }

function makeThumbnail(series: ImportedSeries): string | undefined {
  const volume = { dims: series.dims, spacing: series.spacing, data: new Int16Array(series.buffer) }
  const slice = extractAxial(volume, Math.round(series.dims[2] * 0.55))
  const src = document.createElement('canvas')
  src.width = slice.width
  src.height = slice.height
  const ctx = src.getContext('2d')
  if (!ctx) return undefined
  const img = ctx.createImageData(slice.width, slice.height)
  renderToImageData(slice, buildLut(series.window), img)
  ctx.putImageData(img, 0, 0)
  const size = 160
  const out = document.createElement('canvas')
  const aspect = (slice.width * slice.spacingX) / (slice.height * slice.spacingY)
  out.width = aspect >= 1 ? size : Math.round(size * aspect)
  out.height = aspect >= 1 ? Math.round(size / aspect) : size
  out.getContext('2d')?.drawImage(src, 0, 0, out.width, out.height)
  return out.toDataURL('image/jpeg', 0.8)
}

export function useImporter(onImported?: (ids: string[]) => void) {
  const [state, setState] = useState<ImportState>(IDLE)
  const workerRef = useRef<Worker | null>(null)

  const run = useCallback(
    (message: { type: 'import'; files: File[] } | { type: 'phantom' }) => {
      workerRef.current?.terminate()
      const worker = new Worker(new URL('../workers/import.worker.ts', import.meta.url), { type: 'module' })
      workerRef.current = worker
      const ids: string[] = []
      const pending: Promise<void>[] = []
      setState({ ...IDLE, status: 'running', stage: 'Подготовка' })

      worker.onmessage = (event: MessageEvent<ImportWorkerMessage>) => {
        const msg = event.data
        if (msg.type === 'progress') {
          setState((s) => ({ ...s, stage: msg.stage, done: msg.done, total: msg.total }))
        } else if (msg.type === 'series') {
          const { buffer, ...rest } = msg.series
          const meta: StudyMeta = {
            ...rest,
            id: crypto.randomUUID(),
            importedAt: Date.now(),
            thumbnail: makeThumbnail(msg.series),
          }
          ids.push(meta.id)
          setState((s) => ({ ...s, stage: 'Сохранение в локальное хранилище' }))
          pending.push(saveStudy(meta, buffer))
        } else if (msg.type === 'done') {
          Promise.all(pending)
            .then(() => {
              setState((s) => ({ ...s, status: 'done', warnings: msg.warnings, imported: msg.count }))
              onImported?.(ids)
            })
            .catch((err: unknown) => {
              const quota = err instanceof DOMException && err.name === 'QuotaExceededError'
              setState((s) => ({
                ...s,
                status: 'error',
                message: quota ? 'Недостаточно места в хранилище браузера' : String(err),
              }))
            })
            .finally(() => worker.terminate())
        } else if (msg.type === 'error') {
          setState((s) => ({ ...s, status: 'error', message: msg.message }))
          worker.terminate()
        }
      }
      worker.onerror = (e) => {
        setState((s) => ({ ...s, status: 'error', message: e.message || 'Ошибка обработки' }))
        worker.terminate()
      }
      worker.postMessage(message)
    },
    [onImported],
  )

  const importFiles = useCallback((files: File[]) => files.length && run({ type: 'import', files }), [run])
  const importPhantom = useCallback(() => run({ type: 'phantom' }), [run])
  const reset = useCallback(() => setState(IDLE), [])

  return { state, importFiles, importPhantom, reset }
}

export async function collectDroppedFiles(items: DataTransferItemList): Promise<File[]> {
  const entries: FileSystemEntry[] = []
  const loose: File[] = []
  for (const item of Array.from(items)) {
    if (item.kind !== 'file') continue
    const entry = item.webkitGetAsEntry?.()
    if (entry) entries.push(entry)
    else {
      const f = item.getAsFile()
      if (f) loose.push(f)
    }
  }
  const out: File[] = [...loose]
  const walk = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej))
      out.push(file)
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader()
      let batch: FileSystemEntry[]
      do {
        batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej))
        await Promise.all(batch.map(walk))
      } while (batch.length)
    }
  }
  await Promise.all(entries.map(walk))
  return out.filter((f) => !/^(DICOMDIR|\.DS_Store|thumbs\.db)$/i.test(f.name) && !/\.(txt|xml|html?|pdf|exe|jpg|png|ini|inf)$/i.test(f.name))
}
