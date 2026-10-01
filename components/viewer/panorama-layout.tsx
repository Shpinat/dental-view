'use client'

import { useMemo, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { buildCurvePath, computeCrossSection, pointOnPath, splinePolyline, type CurvePath } from '@/lib/panorama'
import { extractAxial } from '@/lib/volume'
import { useViewer } from '@/lib/viewer-store'
import { ACCENT, horizontalLine, strokePolyline, verticalLine } from '@/lib/overlay'
import type { Point2, Volume } from '@/lib/types'
import { usePanorama } from '@/hooks/use-panorama'
import { SliceViewport, type ImagePointerEvent, type OverlayApi } from './slice-viewport'
import { PanoramaControls } from './panorama-controls'

const HIT_RADIUS_PX = 10

export function PanoramaLayout({ volume }: { volume: Volume }) {
  const cursor = useViewer((s) => s.cursor)
  const tool = useViewer((s) => s.tool)
  const curve = useViewer((s) => s.curve)
  const curveDone = useViewer((s) => s.curveDone)
  const slab = useViewer((s) => s.slabThickness)
  const crossPos = useViewer((s) => s.crossPos)
  const crossCount = useViewer((s) => s.crossCount)
  const crossInterval = useViewer((s) => s.crossInterval)
  const crossWidth = useViewer((s) => s.crossWidth)
  const { setCursor, setCurve, setPano, setTool } = useViewer.getState()

  const [, , nz] = volume.dims
  const [sx, sy, sz] = volume.spacing
  const z = cursor[2]
  const k = Math.round(z)
  const axial = useMemo(() => extractAxial(volume, k), [volume, k])
  const path = useMemo(() => buildCurvePath(curve, sx, sy), [curve, sx, sy])
  const spline = useMemo(() => splinePolyline(curve), [curve])
  const { image: panorama, computing } = usePanorama(volume, curve, slab)

  const positions = useMemo(
    () => Array.from({ length: crossCount }, (_, i) => crossPos + (i - (crossCount - 1) / 2) * crossInterval),
    [crossPos, crossCount, crossInterval],
  )
  const crossSections = useMemo(
    () => (path ? positions.map((s) => computeCrossSection(volume, path, s, crossWidth)) : []),
    [volume, path, positions, crossWidth],
  )

  const clampPos = (s: number) => (path ? Math.min(path.length, Math.max(0, s)) : 0)
  const dragIndex = useRef<number | null>(null)

  const onAxialPointer = (e: ImagePointerEvent) => {
    if (tool === 'curve') {
      if (e.type === 'down') {
        const hit = curve.findIndex((p) => e.screenDistance(p, e.point) < HIT_RADIUS_PX)
        if (hit >= 0) {
          dragIndex.current = hit
          return
        }
        if (!curveDone) {
          setCurve([...curve, e.point])
          dragIndex.current = curve.length
        }
      } else if (e.type === 'move' && dragIndex.current !== null && e.buttons & 1) {
        const next = curve.slice()
        next[dragIndex.current] = e.point
        setCurve(next)
      } else if (e.type === 'up') {
        dragIndex.current = null
      } else if (e.type === 'dblclick' && curve.length >= 2) {
        setCurve(dedupeTail(curve, e), true)
        setTool('crosshair')
      }
      return
    }
    if (tool !== 'crosshair') return
    if (e.type === 'down' || (e.type === 'move' && e.buttons & 1)) {
      setCursor({ x: e.point.x, y: e.point.y })
      if (path) {
        const hit = nearestOnPath(path, { x: e.point.x * sx, y: e.point.y * sy })
        if (hit.distance < 10) setPano({ crossPos: hit.s })
      }
    }
  }

  const drawAxialOverlay = (ctx: CanvasRenderingContext2D, api: OverlayApi) => {
    if (path) {
      const toIdx = (x: number, y: number) => ({ x: x / sx, y: y / sy })
      const half = slab / 2
      for (const sign of [-1, 1]) {
        const pts: Point2[] = []
        for (let n = 0; n < path.count; n += 3) {
          pts.push(toIdx(path.px[n] + sign * half * path.nx[n], path.py[n] + sign * half * path.ny[n]))
        }
        strokePolyline(ctx, api, pts, 'rgba(250, 204, 21, 0.45)', 1, [4, 4])
      }
      positions.forEach((s, i) => {
        if (s < 0 || s > path.length) return
        const p = pointOnPath(path, s)
        const w = crossWidth / 2
        const active = i === Math.floor(crossCount / 2)
        strokePolyline(
          ctx,
          api,
          [toIdx(p.x - w * p.nx, p.y - w * p.ny), toIdx(p.x + w * p.nx, p.y + w * p.ny)],
          ACCENT.cross,
          active ? 2 : 1,
        )
      })
    }
    strokePolyline(ctx, api, spline, ACCENT.curve, 2)
    ctx.fillStyle = ACCENT.curve
    for (const p of curve) {
      const s = api.toScreen(p)
      ctx.beginPath()
      ctx.arc(s.x, s.y, 4.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const onPanoramaPointer = (e: ImagePointerEvent) => {
    if (tool !== 'crosshair' || !path) return
    if (e.type === 'down' || (e.type === 'move' && e.buttons & 1)) {
      setPano({ crossPos: clampPos(e.point.x * path.step) })
      setCursor({ z: nz - 1 - e.point.y })
    }
  }

  const drawPanoramaOverlay = (ctx: CanvasRenderingContext2D, api: OverlayApi) => {
    if (!path) return
    horizontalLine(ctx, api, nz - 1 - z, `color-mix(in oklch, ${ACCENT.axial} 70%, transparent)`)
    positions.forEach((s, i) => {
      const active = i === Math.floor(crossCount / 2)
      verticalLine(ctx, api, s / path.step, ACCENT.cross, active ? 1.75 : 1, active ? [] : [3, 3])
    })
  }

  const onCrossPointer = (e: ImagePointerEvent) => {
    if (tool !== 'crosshair') return
    if (e.type === 'down' || (e.type === 'move' && e.buttons & 1)) setCursor({ z: nz - 1 - e.point.y })
  }

  const centerIndex = Math.floor(crossCount / 2)

  return (
    <div className="flex size-full flex-col gap-1.5">
      <PanoramaControls pathLength={path?.length ?? 0} />
      <div className="grid min-h-0 flex-1 grid-rows-[1.1fr_1fr] gap-1.5">
        <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_minmax(0,2.3fr)] gap-1.5">
          <SliceViewport
            image={axial}
            title="Аксиальный · дуга"
            accent={ACCENT.axial}
            measureKey={`axial-${k}`}
            info={[`Срез ${k + 1}/${nz}`, `Z ${(k * sz).toFixed(1)} мм`]}
            orientation={{ top: 'A', left: 'R', right: 'L' }}
            onScroll={(d) => setCursor({ z: z + d })}
            onImagePointer={onAxialPointer}
            drawOverlay={drawAxialOverlay}
          />
          <div className="relative min-h-0 min-w-0">
            <SliceViewport
              className="size-full"
              image={panorama}
              title={`Панорама · слой ${slab} мм`}
              accent={ACCENT.panorama}
              measureKey="panorama"
              info={path ? [`Длина дуги ${path.length.toFixed(1)} мм`] : undefined}
              orientation={{ left: 'R', right: 'L' }}
              onScroll={(d) => setPano({ crossPos: clampPos(crossPos + d * crossInterval) })}
              onImagePointer={onPanoramaPointer}
              drawOverlay={drawPanoramaOverlay}
              placeholder={
                curve.length < 2
                  ? 'Постройте кривую по зубной дуге на аксиальном срезе: клик — добавить точку, перетаскивание — переместить, двойной клик или Enter — завершить.'
                  : undefined
              }
            />
            {computing && (
              <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-1.5 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[11px] text-slate-300">
                <Loader2 className="size-3 animate-spin" aria-hidden />
                Расчёт
              </div>
            )}
          </div>
        </div>
        <div
          className="grid min-h-0 gap-1.5"
          style={{ gridTemplateColumns: `repeat(${crossCount}, minmax(0, 1fr))` }}
        >
          {positions.map((s, i) => (
            <SliceViewport
              key={i}
              image={crossSections[i] ?? null}
              title={`${i === centerIndex ? '● ' : ''}${s.toFixed(1)} мм`}
              accent={ACCENT.cross}
              measureKey={`cross-${s.toFixed(2)}-${crossWidth}`}
              orientation={{ left: 'Яз', right: 'Вест', top: 'S' }}
              onScroll={(d) => setPano({ crossPos: clampPos(crossPos + d * crossInterval) })}
              onImagePointer={onCrossPointer}
              drawOverlay={(ctx, api) => {
                const img = crossSections[i]
                if (!img) return
                horizontalLine(ctx, api, nz - 1 - z, `color-mix(in oklch, ${ACCENT.axial} 70%, transparent)`)
                verticalLine(ctx, api, (img.width - 1) / 2, 'rgba(250, 204, 21, 0.5)', 1, [3, 4])
              }}
              placeholder={i === centerIndex && !path ? 'Поперечные срезы' : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function dedupeTail(curve: Point2[], e: ImagePointerEvent) {
  const out = curve.slice()
  while (out.length > 2 && e.screenDistance(out[out.length - 1], out[out.length - 2]) < HIT_RADIUS_PX) out.pop()
  return out
}

function nearestOnPath(path: CurvePath, p: Point2) {
  let best = Infinity
  let idx = 0
  for (let n = 0; n < path.count; n++) {
    const d = (path.px[n] - p.x) ** 2 + (path.py[n] - p.y) ** 2
    if (d < best) {
      best = d
      idx = n
    }
  }
  return { s: idx * path.step, distance: Math.sqrt(best) }
}
