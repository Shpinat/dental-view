import type { SliceImage, Volume, WindowLevel } from './types'

export const OUTSIDE_VALUE = -1000

export function extractAxial(vol: Volume, k: number): SliceImage {
  const [nx, ny, nz] = vol.dims
  const kk = clampInt(k, 0, nz - 1)
  const plane = nx * ny
  return {
    data: vol.data.subarray(kk * plane, (kk + 1) * plane),
    width: nx,
    height: ny,
    spacingX: vol.spacing[0],
    spacingY: vol.spacing[1],
  }
}

export function extractCoronal(vol: Volume, j: number): SliceImage {
  const [nx, ny, nz] = vol.dims
  const jj = clampInt(j, 0, ny - 1)
  const out = new Int16Array(nx * nz)
  const plane = nx * ny
  for (let k = 0; k < nz; k++) {
    const src = k * plane + jj * nx
    out.set(vol.data.subarray(src, src + nx), (nz - 1 - k) * nx)
  }
  return { data: out, width: nx, height: nz, spacingX: vol.spacing[0], spacingY: vol.spacing[2] }
}

export function extractSagittal(vol: Volume, i: number): SliceImage {
  const [nx, ny, nz] = vol.dims
  const ii = clampInt(i, 0, nx - 1)
  const out = new Int16Array(ny * nz)
  const plane = nx * ny
  const d = vol.data
  for (let k = 0; k < nz; k++) {
    const row = (nz - 1 - k) * ny
    const base = k * plane + ii
    for (let j = 0; j < ny; j++) out[row + j] = d[base + j * nx]
  }
  return { data: out, width: ny, height: nz, spacingX: vol.spacing[1], spacingY: vol.spacing[2] }
}

export function sampleBilinear(
  data: Int16Array,
  nx: number,
  ny: number,
  planeOffset: number,
  fx: number,
  fy: number,
): number {
  if (fx < 0 || fy < 0 || fx > nx - 1 || fy > ny - 1) return OUTSIDE_VALUE
  const x0 = fx | 0
  const y0 = fy | 0
  const x1 = x0 < nx - 1 ? x0 + 1 : x0
  const y1 = y0 < ny - 1 ? y0 + 1 : y0
  const ax = fx - x0
  const ay = fy - y0
  const r0 = planeOffset + y0 * nx
  const r1 = planeOffset + y1 * nx
  const top = data[r0 + x0] * (1 - ax) + data[r0 + x1] * ax
  const bottom = data[r1 + x0] * (1 - ax) + data[r1 + x1] * ax
  return top * (1 - ay) + bottom * ay
}

export function clampInt(v: number, min: number, max: number) {
  const r = Math.round(v)
  return r < min ? min : r > max ? max : r
}

export function clamp(v: number, min: number, max: number) {
  return v < min ? min : v > max ? max : v
}

export function buildLut(wl: WindowLevel, invert = false): Uint32Array {
  const lut = new Uint32Array(65536)
  const lo = wl.center - wl.width / 2
  const scale = 255 / Math.max(1, wl.width)
  for (let i = 0; i < 65536; i++) {
    let g = ((i - 32768 - lo) * scale) | 0
    g = g < 0 ? 0 : g > 255 ? 255 : g
    if (invert) g = 255 - g
    lut[i] = 0xff000000 | (g << 16) | (g << 8) | g
  }
  return lut
}

export function renderToImageData(img: SliceImage, lut: Uint32Array, target: ImageData) {
  const out = new Uint32Array(target.data.buffer)
  const src = img.data
  const n = img.width * img.height
  for (let i = 0; i < n; i++) out[i] = lut[src[i] + 32768]
}
