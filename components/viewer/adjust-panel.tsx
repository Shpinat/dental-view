'use client'

import { Contrast, RotateCcw } from 'lucide-react'
import { useViewer } from '@/lib/viewer-store'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { WindowLevel } from '@/lib/types'

function presets(defaultWl: WindowLevel): { label: string; wl: WindowLevel }[] {
  return [
    { label: 'По умолчанию', wl: defaultWl },
    { label: 'Кость', wl: { center: 600, width: 2800 } },
    { label: 'Зубы / эмаль', wl: { center: 1200, width: 3200 } },
    { label: 'Каналы / эндо', wl: { center: 900, width: 1800 } },
    { label: 'Мягкие ткани', wl: { center: 50, width: 500 } },
  ]
}

export function AdjustPanel() {
  const wl = useViewer((s) => s.wl)
  const defaultWl = useViewer((s) => s.defaultWl)
  const invert = useViewer((s) => s.invert)
  const { setWl, toggleInvert, resetWl } = useViewer.getState()

  return (
    <div className="flex w-72 shrink-0 flex-col gap-6 border-l border-border bg-card p-4 text-card-foreground overflow-y-auto">
      <div className="text-sm font-semibold tracking-tight">Регулировка</div>

      <div className="flex flex-col gap-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Окно / Уровень
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Окно (Ширина)</span>
            <span className="font-mono">{Math.round(wl.width)}</span>
          </div>
          <Slider
            min={1}
            max={8000}
            step={1}
            value={[wl.width]}
            onValueChange={(v) => setWl({ center: wl.center, width: (v as number[])[0] })}
            aria-label="Ширина окна"
          />
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Уровень (Центр)</span>
            <span className="font-mono">{Math.round(wl.center)}</span>
          </div>
          <Slider
            min={-2000}
            max={4000}
            step={1}
            value={[wl.center]}
            onValueChange={(v) => setWl({ center: (v as number[])[0], width: wl.width })}
            aria-label="Уровень окна"
          />
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        {presets(defaultWl).map((p) => (
          <Button
            key={p.label}
            variant="outline"
            size="sm"
            className="justify-between"
            onClick={() => setWl(p.wl)}
          >
            {p.label}
            <span className="font-mono text-[10px] text-muted-foreground">
              {p.wl.width}/{p.wl.center}
            </span>
          </Button>
        ))}
      </div>

      <Separator />

      <div className="flex gap-2">
        <Button
          variant={invert ? 'secondary' : 'outline'}
          size="sm"
          className="flex-1"
          onClick={toggleInvert}
        >
          <Contrast className="mr-1.5 size-4" />
          Инверсия
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={resetWl}
        >
          <RotateCcw className="mr-1.5 size-4" />
          Сброс
        </Button>
      </div>
    </div>
  )
}