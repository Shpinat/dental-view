'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { buildLut, renderToImageData } from '@/lib/volume'
import { useViewer } from '@/lib/viewer-store'
import type { Measurement, Point2, SliceImage } from '@/lib/types'
import { cn } from '@/lib/utils'

export interface OverlayApi {
  toScreen: (p: Point2) => Point2
  pxPerImageX: number
  pxPerImageY: number
  width: number
  height: number
}

export interface ImagePointerEvent {
  type: 'down' | 'move' | 'up' | 'dblclick'
  point: Point2
  buttons: number
  shiftKey: boolean
  screenDistance: (a: Point2, b: Point2) => number
}

interface SliceViewportProps {
  image: SliceImage | null
  title: string
  accent: string
  measureKey: string
  info?: string[]
  orientation?: { top?: string; bottom?: string; left?: string; right?: string }
  onImagePointer?: (e: ImagePointerEvent) => boolean | void
  onScroll?: (direction: number) => void
  drawOverlay?: (ctx: CanvasRenderingContext2D, api: OverlayApi) => void
  className?: string
  placeholder?: string
}

const FONT = '11px "Geist Mono", ui-monospace, monospace'

type DragMode = 'wl' | 'pan' | 'zoom' | 'measure' | 'external' | null

export function SliceViewport({
  image,
  title,
  accent,
  measureKey,
  info,
  orientation,
  onImagePointer,
  onScroll,
  drawOverlay,
  className,
  placeholder,
}: SliceViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const offscreenRef = useRef<HTMLCanvasElement | null>(null)
  const sizeRef = useRef({ w: 0, h: 0 })
  const viewRef = useRef({ zoom: 1, panX: 0, panY: 0 })
  const dragRef = useRef<{ mode: DragMode; startX: number; startY: number; wl?: { center: number; width: number }; zoom?: number; panX?: number; panY?: number; anchor?: Point2 }>({ mode: null, startX: 0, startY: 0 })
  const draftRef = useRef<Measurement | null>(null)
  const hoverRef = useRef<{ p: Point2; value: number } | null>(null)
  const frameRef = useRef(0)

  const wl = useViewer((s) => s.wl)
  const invert = useViewer((s) => s.invert)
  const tool = useViewer((s) => s.tool)
  const measurements = useViewer((s) => s.measurements[measureKey])
  const viewToken = useViewer((s) => s.viewToken)

  const lut = useMemo(() => buildLut(wl, invert), [wl, invert])

  const propsRef = useRef({ image, drawOverlay, measurements, info, orientation, title, accent, wl })
  propsRef.current = { image, drawOverlay, measurements, info, orientation, title, accent, wl }

  useEffect(() => {
    if (!image) return
    let off = offscreenRef.current
    if (!off) {
      off = document.createElement('canvas')
      offscreenRef.current = off
    }
    if (off.width !== image.width || off.height !== image.height) {
      off.width = image.width
      off.height = image.height
    }
    const ctx = off.getContext('2d')
    if (!ctx) return
    const imgData = ctx.createImageData(image.width, image.height)
    renderToImageData(image, lut, imgData)
    ctx.putImageData(imgData, 0, 0)
  }, [image, lut])

  const getTransform = useCallback(() => {
    const img = propsRef.current.image
    const { w, h } = sizeRef.current
    if (!img) return null
    const wMm = img.width * img.spacingX
    const hMm = img.height * img.spacingY
    const fit = Math.min(w / wMm, h / hMm) * 0.94
    const { zoom, panX, panY } = viewRef.current
    const scale = fit * zoom
    const pxX = scale * img.spacingX
    const pxY = scale * img.spacingY
    const originX = w / 2 + panX - (wMm * scale) / 2
    const originY = h / 2 + panY - (hMm * scale) / 2
    return {
      pxX,
      pxY,
      originX,
      originY,
      toScreen: (p: Point2) => ({ x: originX + (p.x + 0.5) * pxX, y: originY + (p.y + 0.5) * pxY }),
      toImage: (sx: number, sy: number) => ({ x: (sx - originX) / pxX - 0.5, y: (sy - originY) / pxY - 0.5 }),
    }
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const { w, h } = sizeRef.current
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, w, h)
    const { image: img, drawOverlay: overlay, measurements: ms, info: lines, orientation: ori, wl: curWl } = propsRef.current
    const t = getTransform()
    const off = offscreenRef.current
    if (!img || !t || !off) return

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(off, t.originX, t.originY, img.width * t.pxX, img.height * t.pxY)

    const api: OverlayApi = { toScreen: t.toScreen, pxPerImageX: t.pxX, pxPerImageY: t.pxY, width: w, height: h }
    ctx.save()
    overlay?.(ctx, api)
    ctx.restore()

    const all = [...(ms ?? []), ...(draftRef.current ? [draftRef.current] : [])]
    for (const m of all) drawMeasurement(ctx, m, img, t.toScreen)

    ctx.font = FONT
    ctx.textBaseline = 'top'
    ctx.fillStyle = 'rgba(226, 232, 240, 0.85)'
    const textLines = [...(lines ?? []), `W ${curWl.width}  L ${curWl.center}`]
    textLines.forEach((line, i) => ctx.fillText(line, 8, h - 8 - (textLines.length - i) * 14))

    const hover = hoverRef.current
    if (hover) {
      ctx.textAlign = 'right'
      ctx.fillText(`${Math.round(hover.value)}`, w - 8, h - 22)
      ctx.textAlign = 'left'
    }

    if (ori) {
      ctx.fillStyle = 'rgba(250, 204, 21, 0.9)'
      ctx.textAlign = 'center'
      if (ori.top) ctx.fillText(ori.top, w / 2, 26)
      if (ori.bottom) ctx.fillText(ori.bottom, w / 2, h - 22)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      if (ori.left) ctx.fillText(ori.left, 8, h / 2)
      ctx.textAlign = 'right'
      if (ori.right) ctx.fillText(ori.right, w - 8, h / 2)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
    }

    drawScaleBar(ctx, t.pxX / img.spacingX, w, h)
  }, [getTransform])

  const scheduleDraw = useCallback(() => {
    cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(draw)
  }, [draw])

  useEffect(() => {
    scheduleDraw()
  })

  useEffect(() => {
    viewRef.current = { zoom: 1, panX: 0, panY: 0 }
    scheduleDraw()
  }, [viewToken, scheduleDraw])

  useEffect(() => {
    const el = containerRef.current
    const canvas = canvasRef.current
    if (!el || !canvas) return
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      sizeRef.current = { w: rect.width, h: rect.height }
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
      draw()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [draw])

  const onScrollRef = useRef(onScroll)
  onScrollRef.current = onScroll
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        const rect = canvas.getBoundingClientRect()
        zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0015))
        return
      }
      onScrollRef.current?.(e.deltaY > 0 ? 1 : -1)
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function zoomAt(sx: number, sy: number, factor: number) {
    const v = viewRef.current
    const { w, h } = sizeRef.current
    const newZoom = Math.min(30, Math.max(0.2, v.zoom * factor))
    const f = newZoom / v.zoom
    const cx = w / 2 + v.panX
    const cy = h / 2 + v.panY
    v.panX += (sx - cx) * (1 - f)
    v.panY += (sy - cy) * (1 - f)
    v.zoom = newZoom
    scheduleDraw()
  }

  const localPoint = (e: React.PointerEvent | React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top }
  }

  const makeEvent = (type: ImagePointerEvent['type'], e: React.PointerEvent | React.MouseEvent): ImagePointerEvent | null => {
    const t = getTransform()
    if (!t) return null
    const { sx, sy } = localPoint(e)
    return {
      type,
      point: t.toImage(sx, sy),
      buttons: e.buttons,
      shiftKey: e.shiftKey,
      screenDistance: (a, b) => {
        const pa = t.toScreen(a)
        const pb = t.toScreen(b)
        return Math.hypot(pa.x - pb.x, pa.y - pb.y)
      },
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (!image) return
    canvasRef.current?.setPointerCapture(e.pointerId)
    const { sx, sy } = localPoint(e)
    const d = dragRef.current
    d.startX = sx
    d.startY = sy
    let mode: DragMode
    if (e.button === 2) mode = 'wl'
    else if (e.button === 1) mode = 'pan'
    else if (tool === 'wl' || tool === 'pan' || tool === 'zoom' || tool === 'measure') mode = tool
    else mode = 'external'
    d.mode = mode
    d.wl = { ...wl }
    d.zoom = viewRef.current.zoom
    d.panX = viewRef.current.panX
    d.panY = viewRef.current.panY
    if (mode === 'measure') {
      const ev = makeEvent('down', e)
      if (ev) draftRef.current = { id: crypto.randomUUID(), a: ev.point, b: ev.point }
    } else if (mode === 'external') {
      const ev = makeEvent('down', e)
      if (ev) onImagePointer?.(ev)
    }
    scheduleDraw()
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!image) return
    const { sx, sy } = localPoint(e)
    const t = getTransform()
    if (t) {
      const p = t.toImage(sx, sy)
      const ix = Math.round(p.x)
      const iy = Math.round(p.y)
      hoverRef.current =
        ix >= 0 && iy >= 0 && ix < image.width && iy < image.height ? { p, value: image.data[iy * image.width + ix] } : null
    }
    const d = dragRef.current
    const dx = sx - d.startX
    const dy = sy - d.startY
    switch (d.mode) {
      case 'wl': {
        const base = useViewer.getState().defaultWl.width
        const sens = Math.max(0.5, base / 350)
        useViewer.getState().setWl({ center: d.wl!.center + dy * sens, width: Math.max(1, d.wl!.width + dx * sens) })
        break
      }
      case 'pan':
        viewRef.current.panX = d.panX! + dx
        viewRef.current.panY = d.panY! + dy
        break
      case 'zoom': {
        const target = d.zoom! * Math.exp(-dy * 0.01)
        zoomAt(d.startX, d.startY, target / viewRef.current.zoom)
        break
      }
      case 'measure': {
        const ev = makeEvent('move', e)
        if (ev && draftRef.current) draftRef.current = { ...draftRef.current, b: ev.point }
        break
      }
      default: {
        const ev = makeEvent('move', e)
        if (ev) onImagePointer?.(ev)
      }
    }
    scheduleDraw()
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (d.mode === 'measure' && draftRef.current && image) {
      const m = draftRef.current
      const len = Math.hypot((m.b.x - m.a.x) * image.spacingX, (m.b.y - m.a.y) * image.spacingY)
      if (len > 0.2) useViewer.getState().addMeasurement(measureKey, m)
      draftRef.current = null
    } else if (d.mode === 'external') {
      const ev = makeEvent('up', e)
      if (ev) onImagePointer?.(ev)
    }
    d.mode = null
    scheduleDraw()
  }

  const onDoubleClick = (e: React.MouseEvent) => {
    if (tool === 'pan' || tool === 'zoom') {
      viewRef.current = { zoom: 1, panX: 0, panY: 0 }
      scheduleDraw()
      return
    }
    const ev = makeEvent('dblclick', e)
    if (ev) onImagePointer?.(ev)
  }

  const cursor =
    tool === 'pan' ? 'grab' : tool === 'zoom' ? 'zoom-in' : tool === 'wl' ? 'ns-resize' : 'crosshair'

  return (
    <div
      ref={containerRef}
      className={cn('relative min-h-0 min-w-0 overflow-hidden rounded-md border bg-black', className)}
      style={{ borderColor: `color-mix(in oklch, ${accent} 45%, transparent)` }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={title}
        className="absolute inset-0 size-full touch-none select-none"
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => {
          hoverRef.current = null
          scheduleDraw()
        }}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wide text-slate-200">
        <span className="size-2 rounded-full" style={{ backgroundColor: accent }} aria-hidden />
        {title}
      </div>
      {!image && placeholder && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
          {placeholder}
        </div>
      )}
    </div>
  )
}

function drawMeasurement(
  ctx: CanvasRenderingContext2D,
  m: Measurement,
  img: SliceImage,
  toScreen: (p: Point2) => Point2,
) {
  const a = toScreen(m.a)
  const b = toScreen(m.b)
  const len = Math.hypot((m.b.x - m.a.x) * img.spacingX, (m.b.y - m.a.y) * img.spacingY)
  ctx.save()
  ctx.strokeStyle = '#facc15'
  ctx.fillStyle = '#facc15'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
  const ang = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2
  for (const p of [a, b]) {
    ctx.beginPath()
    ctx.moveTo(p.x + Math.cos(ang) * 5, p.y + Math.sin(ang) * 5)
    ctx.lineTo(p.x - Math.cos(ang) * 5, p.y - Math.sin(ang) * 5)
    ctx.stroke()
  }
  const label = `${len.toFixed(1)} mm`
  ctx.font = '600 12px "Geist Mono", ui-monospace, monospace'
  const tw = ctx.measureText(label).width
  const lx = (a.x + b.x) / 2 + 8
  const ly = (a.y + b.y) / 2 - 8
  ctx.fillStyle = 'rgba(0,0,0,0.7)'
  ctx.fillRect(lx - 3, ly - 9, tw + 6, 17)
  ctx.fillStyle = '#facc15'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, lx, ly)
  ctx.restore()
}

function drawScaleBar(ctx: CanvasRenderingContext2D, pxPerMm: number, w: number, h: number) {
  const candidates = [1, 2, 5, 10, 20, 50]
  const mm = candidates.find((c) => c * pxPerMm >= 50) ?? 50
  const len = mm * pxPerMm
  const x = w - 12 - len
  const y = h - 10
  ctx.save()
  ctx.strokeStyle = 'rgba(226,232,240,0.8)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x, y - 4)
  ctx.lineTo(x, y)
  ctx.lineTo(x + len, y)
  ctx.lineTo(x + len, y - 4)
  ctx.stroke()
  ctx.font = FONT
  ctx.fillStyle = 'rgba(226,232,240,0.85)'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'bottom'
  ctx.fillText(`${mm} mm`, w - 12, y - 30)
  ctx.restore()
}
