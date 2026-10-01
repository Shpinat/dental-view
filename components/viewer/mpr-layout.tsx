'use client'

import { useMemo } from 'react'
import { extractAxial, extractCoronal, extractSagittal } from '@/lib/volume'
import { useViewer } from '@/lib/viewer-store'
import { ACCENT, drawCrossLines } from '@/lib/overlay'
import type { Volume } from '@/lib/types'
import { SliceViewport, type ImagePointerEvent } from './slice-viewport'

export function MprLayout({ volume }: { volume: Volume }) {
  const [x, y, z] = useViewer((s) => s.cursor)
  const setCursor = useViewer((s) => s.setCursor)
  const tool = useViewer((s) => s.tool)
  const [nx, ny, nz] = volume.dims
  const [sx, sy, sz] = volume.spacing

  const k = Math.round(z)
  const j = Math.round(y)
  const i = Math.round(x)
  const axial = useMemo(() => extractAxial(volume, k), [volume, k])
  const coronal = useMemo(() => extractCoronal(volume, j), [volume, j])
  const sagittal = useMemo(() => extractSagittal(volume, i), [volume, i])

  const follow = (handler: (e: ImagePointerEvent) => void) => (e: ImagePointerEvent) => {
    if (tool !== 'crosshair') return
    if (e.type === 'down' || (e.type === 'move' && e.buttons & 1)) handler(e)
  }

  return (
    <div className="grid size-full grid-cols-1 gap-1.5 md:grid-cols-[1.4fr_1fr] md:grid-rows-2">
      <SliceViewport
        className="md:row-span-2"
        image={axial}
        title="Аксиальный"
        accent={ACCENT.axial}
        measureKey={`axial-${k}`}
        info={[`Срез ${k + 1}/${nz}`, `Z ${(k * sz).toFixed(1)} мм`]}
        orientation={{ top: 'A', bottom: 'P', left: 'R', right: 'L' }}
        onScroll={(d) => setCursor({ z: z + d })}
        onImagePointer={follow((e) => setCursor({ x: e.point.x, y: e.point.y }))}
        drawOverlay={(ctx, api) => drawCrossLines(ctx, api, { x, y }, ACCENT.sagittal, ACCENT.coronal)}
      />
      <SliceViewport
        image={coronal}
        title="Корональный"
        accent={ACCENT.coronal}
        measureKey={`coronal-${j}`}
        info={[`Срез ${j + 1}/${ny}`, `Y ${(j * sy).toFixed(1)} мм`]}
        orientation={{ top: 'S', bottom: 'I', left: 'R', right: 'L' }}
        onScroll={(d) => setCursor({ y: y + d })}
        onImagePointer={follow((e) => setCursor({ x: e.point.x, z: nz - 1 - e.point.y }))}
        drawOverlay={(ctx, api) =>
          drawCrossLines(ctx, api, { x, y: nz - 1 - z }, ACCENT.sagittal, ACCENT.axial)
        }
      />
      <SliceViewport
        image={sagittal}
        title="Сагиттальный"
        accent={ACCENT.sagittal}
        measureKey={`sagittal-${i}`}
        info={[`Срез ${i + 1}/${nx}`, `X ${(i * sx).toFixed(1)} мм`]}
        orientation={{ top: 'S', bottom: 'I', left: 'A', right: 'P' }}
        onScroll={(d) => setCursor({ x: x + d })}
        onImagePointer={follow((e) => setCursor({ y: e.point.x, z: nz - 1 - e.point.y }))}
        drawOverlay={(ctx, api) =>
          drawCrossLines(ctx, api, { x: y, y: nz - 1 - z }, ACCENT.coronal, ACCENT.axial)
        }
      />
    </div>
  )
}
