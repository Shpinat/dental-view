/// <reference lib="webworker" />
import { assembleSeries, parseSliceFile } from '../lib/dicom/volume-builder'
import { generatePhantom } from '../lib/phantom'
import type { ImportWorkerMessage } from '../lib/types'

declare const self: DedicatedWorkerGlobalScope

type Request = { type: 'import'; files: File[] } | { type: 'phantom' }

const post = (msg: ImportWorkerMessage, transfer: Transferable[] = []) => self.postMessage(msg, transfer)

self.onmessage = async (event: MessageEvent<Request>) => {
  const req = event.data
  try {
    if (req.type === 'phantom') {
      post({ type: 'progress', done: 0, total: 100, stage: 'Генерация фантома' })
      const series = generatePhantom((p: number) =>
        post({ type: 'progress', done: Math.round(p * 100), total: 100, stage: 'Генерация фантома' }),
      )
      post({ type: 'series', series }, [series.buffer])
      post({ type: 'done', count: 1, warnings: [] })
      return
    }

    const files = req.files
    const warnings: string[] = []
    const slices = []
    let skipped = 0
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        const buffer = await file.arrayBuffer()
        const slice = parseSliceFile(buffer)
        if (slice) slices.push(slice)
        else skipped++
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        if (!warnings.includes(message)) warnings.push(message)
        skipped++
      }
      if (i % 8 === 0 || i === files.length - 1) {
        post({ type: 'progress', done: i + 1, total: files.length, stage: 'Чтение DICOM' })
      }
    }
    if (skipped) warnings.push(`Пропущено файлов: ${skipped} (не DICOM или не поддерживаются)`)
    if (!slices.length) {
      post({ type: 'error', message: warnings[0] ?? 'Не найдено DICOM-изображений' })
      return
    }

    post({ type: 'progress', done: files.length, total: files.length, stage: 'Сборка объёма' })
    const series = assembleSeries(slices, warnings)
    slices.length = 0
    for (const s of series) post({ type: 'series', series: s }, [s.buffer])
    post({ type: 'done', count: series.length, warnings })
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
