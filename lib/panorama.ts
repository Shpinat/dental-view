import type { Point2, SliceImage, Volume } from './types'
import { OUTSIDE_VALUE, sampleBilinear } from './volume'

/** Curve sampled at equal arc-length steps, all coordinates in millimetres. */
export interface CurvePath {
  px: Float32Array
  py: Float32Array
  nx: Float32Array
  ny: Float32Array
  count: number
  step: number
  length: number
}

function catmullRom(points: Point2[], segments = 24): Point2[] {
  if (points.length < 2) return points
  const out: Point2[] = []
  const p = [points[0], ...points, points[points.length - 1]]
  for (let i = 1; i < p.length - 2; i++) {
    const [p0, p1, p2, p3] = [p[i - 1], p[i], p[i + 1], p[i + 2]]
    for (let s = 0; s < segments; s++) {
      const t = s / segments
      const t2 = t * t
      const t3 = t2 * t
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      })
    }
  }
  out.push(points[points.length - 1])
  return out
}

/** Dense spline through control points, in the same coordinate system as the input. */
export function splinePolyline(points: Point2[]): Point2[] {
  return catmullRom(points)
}

export function buildCurvePath(pointsIdx: Point2[], spacingX: number, spacingY: number): CurvePath | null {
  if (pointsIdx.length < 2) return null
  const mm = pointsIdx.map((p) => ({ x: p.x * spacingX, y: p.y * spacingY }))
  const dense = catmullRom(mm)
  const cum = [0]
  for (let i = 1; i < dense.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(dense[i].x - dense[i - 1].x, dense[i].y - dense[i - 1].y))
  }
  const length = cum[cum.length - 1]
  const step = Math.min(spacingX, spacingY)
  const count = Math.max(2, Math.floor(length / step) + 1)
  const px = new Float32Array(count)
  const py = new Float32Array(count)
  let seg = 1
  for (let n = 0; n < count; n++) {
    const s = n * step
    while (seg < dense.length - 1 && cum[seg] < s) seg++
    const span = cum[seg] - cum[seg - 1] || 1
    const t = Math.min(1, Math.max(0, (s - cum[seg - 1]) / span))
    px[n] = dense[seg - 1].x + (dense[seg].x - dense[seg - 1].x) * t
    py[n] = dense[seg - 1].y + (dense[seg].y - dense[seg - 1].y) * t
  }

  const nxs = new Float32Array(count)
  const nys = new Float32Array(count)
  let cx = 0
  let cy = 0
  for (const p of mm) {
    cx += p.x
    cy += p.y
  }
  cx /= mm.length
  cy /= mm.length
  let orientation = 0
  for (let n = 0; n < count; n++) {
    const a = Math.max(0, n - 2)
    const b = Math.min(count - 1, n + 2)
    const tx = px[b] - px[a]
    const ty = py[b] - py[a]
    const len = Math.hypot(tx, ty) || 1
    nxs[n] = -ty / len
    nys[n] = tx / len
    orientation += nxs[n] * (px[n] - cx) + nys[n] * (py[n] - cy)
  }
  if (orientation < 0) {
    for (let n = 0; n < count; n++) {
      nxs[n] = -nxs[n]
      nys[n] = -nys[n]
    }
  }
  return { px, py, nx: nxs, ny: nys, count, step, length }
}

export function pointOnPath(path: CurvePath, s: number) {
  const f = Math.min(path.count - 1, Math.max(0, s / path.step))
  const i0 = Math.floor(f)
  const i1 = Math.min(path.count - 1, i0 + 1)
  const t = f - i0
  const nx = path.nx[i0] * (1 - t) + path.nx[i1] * t
  const ny = path.ny[i0] * (1 - t) + path.ny[i1] * t
  const nl = Math.hypot(nx, ny) || 1
  return {
    x: path.px[i0] * (1 - t) + path.px[i1] * t,
    y: path.py[i0] * (1 - t) + path.py[i1] * t,
    nx: nx / nl,
    ny: ny / nl,
  }
}

/** Average-intensity slab along the curve; rows go superior → inferior. */
export function computePanorama(vol: Volume, path: CurvePath, thicknessMm: number): SliceImage {
  const [nxv, nyv, nz] = vol.dims
  const [sx, sy, sz] = vol.spacing
  const plane = nxv * nyv
  const width = path.count
  const out = new Int16Array(width * nz)
  const tStep = Math.min(sx, sy)
  const nT = Math.max(1, Math.round(thicknessMm / tStep))
  const offsets = new Float32Array(nT)
  for (let t = 0; t < nT; t++) offsets[t] = nT === 1 ? 0 : -thicknessMm / 2 + (t * thicknessMm) / (nT - 1)

  const fxs = new Float32Array(nT)
  const fys = new Float32Array(nT)
  for (let c = 0; c < width; c++) {
    for (let t = 0; t < nT; t++) {
      fxs[t] = (path.px[c] + offsets[t] * path.nx[c]) / sx
      fys[t] = (path.py[c] + offsets[t] * path.ny[c]) / sy
    }
    for (let k = 0; k < nz; k++) {
      const po = k * plane
      let sum = 0
      for (let t = 0; t < nT; t++) sum += sampleBilinear(vol.data, nxv, nyv, po, fxs[t], fys[t])
      out[(nz - 1 - k) * width + c] = sum / nT
    }
  }
  return { data: out, width, height: nz, spacingX: path.step, spacingY: sz }
}

/** Cross-section perpendicular to the curve at arc position s (mm). Left = lingual, right = buccal. */
export function computeCrossSection(vol: Volume, path: CurvePath, s: number, widthMm: number): SliceImage {
  const [nxv, nyv, nz] = vol.dims
  const [sx, sy, sz] = vol.spacing
  const plane = nxv * nyv
  const step = Math.min(sx, sy)
  const width = Math.max(2, Math.round(widthMm / step))
  const out = new Int16Array(width * nz)
  const p = pointOnPath(path, s)
  const inRange = s >= 0 && s <= path.length
  for (let c = 0; c < width; c++) {
    const off = -widthMm / 2 + c * step
    const fx = (p.x + off * p.nx) / sx
    const fy = (p.y + off * p.ny) / sy
    for (let k = 0; k < nz; k++) {
      out[(nz - 1 - k) * width + c] = inRange ? sampleBilinear(vol.data, nxv, nyv, k * plane, fx, fy) : OUTSIDE_VALUE
    }
  }
  return { data: out, width, height: nz, spacingX: step, spacingY: sz }
}
