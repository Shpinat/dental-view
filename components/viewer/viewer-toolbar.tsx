'use client'

import Link from 'next/link'
import {
  AppWindow,
  ArrowLeft,
  Contrast,
  Crosshair,
  Hand,
  Maximize,
  Ruler,
  SlidersHorizontal,
  Spline,
  Trash2,
  Undo2,
  ZoomIn,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useViewer, type Layout } from '@/lib/viewer-store'
import { viewerUrl } from '@/lib/format'
import type { StudyMeta, Tool, WindowLevel } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'

const TOOLS: { id: Tool; label: string; key: string; icon: LucideIcon; panoOnly?: boolean }[] = [
  { id: 'crosshair', label: 'Перекрестие / навигация', key: 'V', icon: Crosshair },
  { id: 'wl', label: 'Окно / уровень (также ПКМ)', key: 'W', icon: SlidersHorizontal },
  { id: 'pan', label: 'Сдвиг (также СКМ)', key: 'P', icon: Hand },
  { id: 'zoom', label: 'Масштаб (также Ctrl + колесо)', key: 'Z', icon: ZoomIn },
  { id: 'measure', label: 'Линейка, мм', key: 'M', icon: Ruler },
  { id: 'curve', label: 'Кривая зубной дуги', key: 'C', icon: Spline, panoOnly: true },
]

function presets(defaultWl: WindowLevel): { label: string; wl: WindowLevel }[] {
  return [
    { label: 'По умолчанию', wl: defaultWl },
    { label: 'Кость', wl: { center: 600, width: 2800 } },
    { label: 'Зубы / эмаль', wl: { center: 1200, width: 3200 } },
    { label: 'Каналы / эндо', wl: { center: 900, width: 1800 } },
    { label: 'Мягкие ткани', wl: { center: 50, width: 500 } },
  ]
}

function IconButton({
  label,
  icon: Icon,
  onClick,
  active,
  disabled,
}: {
  label: string
  icon: LucideIcon
  onClick: () => void
  active?: boolean
  disabled?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant={active ? 'secondary' : 'ghost'}
            size="icon-sm"
            aria-label={label}
            aria-pressed={active}
            onClick={onClick}
            disabled={disabled}
          />
        }
      >
        <Icon />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function ViewerToolbar({ meta }: { meta: StudyMeta }) {
  const tool = useViewer((s) => s.tool)
  const layout = useViewer((s) => s.layout)
  const invert = useViewer((s) => s.invert)
  const defaultWl = useViewer((s) => s.defaultWl)
  const hasMeasurements = useViewer((s) => Object.values(s.measurements).some((l) => l.length))
  const { setTool, setLayout, setWl, toggleInvert, resetViews, resetWl, undoMeasurement, clearMeasurements } =
    useViewer.getState()

  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-card px-2">
      <Tooltip>
        <TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label="К списку исследований" render={<Link href="/" />} nativeButton={false} />}>
          <ArrowLeft />
        </TooltipTrigger>
        <TooltipContent>К списку исследований</TooltipContent>
      </Tooltip>
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-medium">{meta.patientName || 'Без имени'}</span>
        <span className="truncate font-mono text-[11px] text-muted-foreground">
          {[meta.studyDate, meta.patientId && `ID ${meta.patientId}`, `${meta.spacing[0].toFixed(2)} мм`]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </div>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToggleGroup
        size="sm"
        variant="outline"
        value={[layout]}
        onValueChange={(v) => v[0] && setLayout(v[0] as Layout)}
        aria-label="Режим просмотра"
      >
        <ToggleGroupItem value="mpr" className="px-3 text-xs">
          MPR
        </ToggleGroupItem>
        <ToggleGroupItem value="panorama" className="px-3 text-xs">
          Панорама
        </ToggleGroupItem>
      </ToggleGroup>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <div className="flex items-center gap-0.5" role="toolbar" aria-label="Инструменты">
        {TOOLS.filter((t) => !t.panoOnly || layout === 'panorama').map((t) => (
          <IconButton
            key={t.id}
            label={`${t.label} (${t.key})`}
            icon={t.icon}
            active={tool === t.id}
            onClick={() => setTool(t.id)}
          />
        ))}
      </div>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <IconButton
        label="Сбросить масштаб (R)"
        icon={Maximize}
        onClick={() => {
          resetViews()
        }}
      />
      <IconButton label="Отменить измерение (Ctrl+Z)" icon={Undo2} onClick={undoMeasurement} disabled={!hasMeasurements} />
      <IconButton label="Удалить все измерения" icon={Trash2} onClick={clearMeasurements} disabled={!hasMeasurements} />

      <div className={cn('ml-auto flex items-center gap-1')}>
        <ThemeToggle />
        <IconButton
          label="Открыть копию в новом окне"
          icon={AppWindow}
          onClick={() => window.open(viewerUrl(meta.id), `study-${meta.id}-${Date.now()}`, 'popup,width=1600,height=1000')}
        />
      </div>
    </header>
  )
}
