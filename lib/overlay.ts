import type { OverlayApi } from '@/components/viewer/slice-viewport'
import type { Point2 } from './types'

export const ACCENT = {
  axial: '#38bdf8',
  coronal: '#4ade80',
  sagittal: '#f472b6',
  panorama: '#a78bfa',
  cross: '#fb923c',
  curve: '#facc15',
}

/** Full-length line with a gap around the focus point, so the anatomy under the cursor stays visible. */
export function drawCrossLines(
  ctx: CanvasRenderingContext2D,
  api: OverlayApi,
  p: Point2,
  vertical: string | null,
  horizontal: string | null,
  gap = 14,
) {
  const s = api.toScreen(p)
  ctx.lineWidth = 1
  if (vertical) {
    ctx.strokeStyle = vertical
    ctx.beginPath()
    ctx.moveTo(s.x, 0)
    ctx.lineTo(s.x, s.y - gap)
    ctx.moveTo(s.x, s.y + gap)
    ctx.lineTo(s.x, api.height)
    ctx.stroke()
  }
  if (horizontal) {
    ctx.strokeStyle = horizontal
    ctx.beginPath()
    ctx.moveTo(0, s.y)
    ctx.lineTo(s.x - gap, s.y)
    ctx.moveTo(s.x + gap, s.y)
    ctx.lineTo(api.width, s.y)
    ctx.stroke()
  }
}

export function strokePolyline(
  ctx: CanvasRenderingContext2D,
  api: OverlayApi,
  pts: Point2[],
  color: string,
  width = 1.5,
  dash: number[] = [],
) {
  if (pts.length < 2) return
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.setLineDash(dash)
  ctx.beginPath()
  pts.forEach((p, i) => {
    const s = api.toScreen(p)
    if (i === 0) ctx.moveTo(s.x, s.y)
    else ctx.lineTo(s.x, s.y)
  })
  ctx.stroke()
  ctx.setLineDash([])
}

export function horizontalLine(ctx: CanvasRenderingContext2D, api: OverlayApi, row: number, color: string) {
  const y = api.toScreen({ x: 0, y: row }).y
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, y)
  ctx.lineTo(api.width, y)
  ctx.stroke()
}

export function verticalLine(
  ctx: CanvasRenderingContext2D,
  api: OverlayApi,
  col: number,
  color: string,
  width = 1,
  dash: number[] = [],
) {
  const x = api.toScreen({ x: col, y: 0 }).x
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.setLineDash(dash)
  ctx.beginPath()
  ctx.moveTo(x, 0)
  ctx.lineTo(x, api.height)
  ctx.stroke()
  ctx.setLineDash([])
}
