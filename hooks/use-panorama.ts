'use client'

import { useEffect, useRef, useState } from 'react'
import type { Point2, SliceImage, Volume } from '@/lib/types'

/** Computes the panoramic reconstruction off the main thread; stale requests are dropped. */
export function usePanorama(volume: Volume | null, curve: Point2[], thickness: number) {
  const [result, setResult] = useState<{ image: SliceImage; requestId: number } | null>(null)
  const [pendingId, setPendingId] = useState(0)
  const workerRef = useRef<Worker | null>(null)
  const requestRef = useRef(0)

  useEffect(() => {
    if (!volume) return
    const worker = new Worker(new URL('../workers/panorama.worker.ts', import.meta.url), { type: 'module' })
    worker.postMessage({ type: 'init', volume })
    worker.onmessage = (e: MessageEvent<{ type: 'result'; requestId: number; image: SliceImage }>) => {
      if (e.data.requestId === requestRef.current) setResult({ image: e.data.image, requestId: e.data.requestId })
    }
    workerRef.current = worker
    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [volume])

  useEffect(() => {
    if (curve.length < 2) return
    const timer = setTimeout(() => {
      const id = ++requestRef.current
      setPendingId(id)
      workerRef.current?.postMessage({ type: 'compute', requestId: id, points: curve, thickness })
    }, 90)
    return () => clearTimeout(timer)
  }, [curve, thickness, volume])

  const hasCurve = curve.length >= 2
  return {
    image: hasCurve ? (result?.image ?? null) : null,
    computing: hasCurve && pendingId !== (result?.requestId ?? 0),
  }
}
