'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AppWindow, CheckSquare, ExternalLink, FlaskConical, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { mutate } from 'swr'
import { deleteStudy } from '@/lib/db'
import { formatBytes, viewerUrl } from '@/lib/format'
import type { StudyMeta } from '@/lib/types'

export function StudyList({
  studies,
  loading,
  onLoadDemo,
}: {
  studies: StudyMeta[] | undefined
  loading: boolean
  onLoadDemo: () => void
}) {
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggleSelectionMode = () => {
    setSelectionMode((prev) => !prev)
    setSelectedIds(new Set())
  }

  const toggleStudySelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDeleteSelected = async () => {
    for (const id of Array.from(selectedIds)) {
      await deleteStudy(id)
    }
    setSelectionMode(false)
    setSelectedIds(new Set())
    mutate('studies')
  }

  if (loading || !studies) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    )
  }

  if (!studies.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card/40 px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">Пока нет импортированных исследований.</p>
        <Button variant="secondary" onClick={onLoadDemo}>
          <FlaskConical data-icon="inline-start" />
          Загрузить демо-фантом челюсти
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-baseline justify-between">
        <h2 id="studies-heading" className="text-sm font-medium">
          Исследования
          {studies?.length ? <span className="ml-2 font-mono text-muted-foreground">{studies.length}</span> : null}
        </h2>
        {studies.length > 0 && (
          <div className="flex items-center gap-2">
            {selectionMode && selectedIds.size > 0 && (
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button variant="destructive" size="sm">
                      <Trash2 className="mr-1.5 size-4" />
                      Удалить выбранные ({selectedIds.size})
                    </Button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Удалить выбранные исследования?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Будет удалено исследований: {selectedIds.size}. Данные будут удалены из локального хранилища этого браузера без возможности восстановления.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Отмена</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={handleDeleteSelected}>
                      Удалить
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button
              variant={selectionMode ? 'secondary' : 'outline'}
              size="sm"
              onClick={toggleSelectionMode}
            >
              <CheckSquare className="mr-1.5 size-4" />
              {selectionMode ? 'Отмена' : 'Выбрать'}
            </Button>
          </div>
        )}
      </div>
      <ul className="flex flex-col gap-2">
        {studies.map((s) => (
          <StudyRow
            key={s.id}
            study={s}
            selectable={selectionMode}
            selected={selectedIds.has(s.id)}
            onToggleSelect={() => toggleStudySelection(s.id)}
          />
        ))}
        <li className="pt-1">
          <Button variant="ghost" size="sm" onClick={onLoadDemo} className="text-muted-foreground">
            <FlaskConical data-icon="inline-start" />
            Добавить демо-фантом
          </Button>
        </li>
      </ul>
    </>
  )
}

function openInWindow(id: string) {
  const w = Math.min(window.screen.availWidth, 1680)
  const h = Math.min(window.screen.availHeight, 1050)
  window.open(viewerUrl(id), `study-${id}`, `popup,width=${w},height=${h}`)
}

function StudyRow({
  study: s,
  selectable,
  selected,
  onToggleSelect,
}: {
  study: StudyMeta
  selectable: boolean
  selected: boolean
  onToggleSelect: () => void
}) {
  const fov = s.dims.map((d, i) => (d * s.spacing[i]).toFixed(0)).join(' × ')
  return (
    <li
      className={`flex items-center gap-4 rounded-lg border border-border bg-card p-3 transition-colors ${
        selected ? 'bg-accent/50' : ''
      }`}
    >
      {selectable && (
        <div className="flex shrink-0 items-center px-1">
          <Checkbox checked={selected} onCheckedChange={onToggleSelect} aria-label={`Select study ${s.patientName}`} />
        </div>
      )}
      <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-black">
        {s.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.thumbnail || '/placeholder.svg'} alt="" className="max-h-full max-w-full" />
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <Link
            href={viewerUrl(s.id)}
            className="truncate font-medium hover:text-primary focus-visible:text-primary focus-visible:outline-none"
          >
            {s.patientName || 'Без имени'}
          </Link>
          {s.patientId && <span className="font-mono text-xs text-muted-foreground">ID {s.patientId}</span>}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {[s.studyDate, s.modality, s.studyDescription || s.seriesDescription, s.manufacturer]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <p className="font-mono text-xs text-muted-foreground tabular-nums">
          {s.dims.join('×')} · {s.spacing[0].toFixed(2)} мм · FOV {fov} мм · {formatBytes(s.sizeBytes)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button size="sm" render={<Link href={viewerUrl(s.id)} />} nativeButton={false}>
          Открыть
        </Button>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Открыть в новом окне"
                onClick={() => openInWindow(s.id)}
              />
            }
          >
            <AppWindow />
          </TooltipTrigger>
          <TooltipContent>В новом окне (для второго монитора)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Открыть в новой вкладке"
                onClick={() => window.open(viewerUrl(s.id), '_blank')}
              />
            }
          >
            <ExternalLink />
          </TooltipTrigger>
          <TooltipContent>В новой вкладке</TooltipContent>
        </Tooltip>
        <AlertDialog>
          <AlertDialogTrigger
            render={<Button variant="ghost" size="icon-sm" aria-label="Удалить исследование" />}
          >
            <Trash2 />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить исследование?</AlertDialogTitle>
              <AlertDialogDescription>
                {s.patientName || 'Без имени'} — данные будут удалены из локального хранилища этого браузера.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={() => deleteStudy(s.id)}>
                Удалить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  )
}
