'use client'

import { Check, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useViewer } from '@/lib/viewer-store'

function LabeledSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="whitespace-nowrap text-xs text-muted-foreground">{label}</span>
      <Slider
        className="w-24"
        value={[value]}
        min={min}
        max={max}
        step={step}
        aria-label={label}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
      />
      <span className="w-12 font-mono text-xs tabular-nums">
        {value}
        {unit}
      </span>
    </div>
  )
}

export function PanoramaControls({ pathLength }: { pathLength: number }) {
  const curve = useViewer((s) => s.curve)
  const curveDone = useViewer((s) => s.curveDone)
  const tool = useViewer((s) => s.tool)
  const slab = useViewer((s) => s.slabThickness)
  const count = useViewer((s) => s.crossCount)
  const interval = useViewer((s) => s.crossInterval)
  const width = useViewer((s) => s.crossWidth)
  const { setPano, resetCurve, setCurve, setTool } = useViewer.getState()

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border border-border bg-card px-3 py-1.5">
      <div className="flex items-center gap-1.5">
        {!curveDone ? (
          <Button
            size="sm"
            disabled={curve.length < 2}
            onClick={() => {
              setCurve(curve, true)
              setTool('crosshair')
            }}
          >
            <Check data-icon="inline-start" />
            Завершить кривую
          </Button>
        ) : (
          <Button size="sm" variant={tool === 'curve' ? 'secondary' : 'outline'} onClick={() => setTool(tool === 'curve' ? 'crosshair' : 'curve')}>
            {tool === 'curve' ? 'Готово' : 'Править кривую'}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={resetCurve} disabled={!curve.length}>
          <RotateCcw data-icon="inline-start" />
          Заново
        </Button>
        <span className="ml-1 font-mono text-xs text-muted-foreground tabular-nums">
          {curve.length} т. · {pathLength.toFixed(0)} мм
        </span>
      </div>

      <LabeledSlider label="Толщина слоя" value={slab} min={1} max={30} step={1} unit=" мм" onChange={(v) => setPano({ slabThickness: v })} />
      <LabeledSlider label="Шаг срезов" value={interval} min={0.5} max={5} step={0.5} unit=" мм" onChange={(v) => setPano({ crossInterval: v })} />
      <LabeledSlider label="Ширина среза" value={width} min={16} max={60} step={2} unit=" мм" onChange={(v) => setPano({ crossWidth: v })} />

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Срезов</span>
        <ToggleGroup
          size="sm"
          variant="outline"
          value={[String(count)]}
          onValueChange={(v) => v[0] && setPano({ crossCount: Number(v[0]) })}
        >
          {[3, 5, 7].map((n) => (
            <ToggleGroupItem key={n} value={String(n)} className="px-2.5 font-mono text-xs">
              {n}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  )
}
