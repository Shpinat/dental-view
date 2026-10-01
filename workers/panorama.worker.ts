/// <reference lib="webworker" />
import { buildCurvePath, computePanorama } from '../lib/panorama'
import type { Point2, Volume } from '../lib/types'

declare const self: DedicatedWorkerGlobalScope

type Request =
  | { type: 'init'; volume: Volume }
  | { type: 'compute'; requestId: number; points: Point2[]; thickness: number }

let volume: Volume | null = null

self.onmessage = (event: MessageEvent<Request>) => {
  const req = event.data
  if (req.type === 'init') {
    volume = req.volume
    return
  }
  if (!volume) return
  const path = buildCurvePath(req.points, volume.spacing[0], volume.spacing[1])
  if (!path) return
  const image = computePanorama(volume, path, req.thickness)
  self.postMessage({ type: 'result', requestId: req.requestId, image }, [image.data.buffer])
}
