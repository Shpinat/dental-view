'use client'

import { ChevronDown } from 'lucide-react'
import { useViewer } from '@/lib/viewer-store'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function AdjustPanel() {
  const wl = useViewer((s) => s.wl)
  const slabThickness = useViewer((s) => s.slabThickness)
  const setPano = useViewer((s) => s.setPano)
  const { setWl } = useViewer.getState()

  return (
    <div className="flex w-72 shrink-0 flex-col gap-6 border-l border-border bg-card p-4 text-card-foreground overflow-y-auto">
      <div className="text-sm font-semibold tracking-tight">Регулировка</div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>Толщина среза</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" className="w-full justify-between" />}>
            <span>{slabThickness} мм</span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {[1, 5, 10, 12, 15, 20].map((t) => (
              <DropdownMenuItem key={t} onClick={() => setPano({ slabThickness: t })}>
                {t} мм
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Separator />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Яркость</span>
            <span className="font-mono">{Math.round(wl.center)}</span>
          </div>
          <Slider
            min={-2000}
            max={4000}
            step={1}
            value={[wl.center]}
            onValueChange={(v) => setWl({ center: (v as number[])[0], width: wl.width })}
            aria-label="Яркость"
          />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Контрастность</span>
            <span className="font-mono">{Math.round(wl.width)}</span>
          </div>
          <Slider
            min={1}
            max={8000}
            step={1}
            value={[wl.width]}
            onValueChange={(v) => setWl({ center: wl.center, width: (v as number[])[0] })}
            aria-label="Контрастность"
          />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Резкость</span>
            <span className="font-mono">0</span>
          </div>
          <Slider
            min={0}
            max={100}
            step={1}
            value={[0]}
            disabled
            aria-label="Резкость"
          />
        </div>
      </div>
    </div>
  )
}