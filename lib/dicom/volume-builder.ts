import type { ImportedSeries, Vec3 } from '../types'
import { formatPersonName, parseDicom, Tags, type ParsedDicom } from './parser'

interface ParsedSlice {
  seriesUid: string
  rows: number
  columns: number
  frames: Int16Array[]
  position?: Vec3
  orientation?: number[]
  instance: number
  pixelSpacing: [number, number]
  sliceSpacing?: number
  window?: { center: number; width: number }
  meta: SliceMeta
}

interface SliceMeta {
  patientName: string
  patientId: string
  birthDate: string
  sex: string
  studyDate: string
  studyDescription: string
  seriesDescription: string
  modality: string
  manufacturer: string
}

function readFrames(ds: ParsedDicom, buffer: ArrayBuffer, rows: number, columns: number): Int16Array[] {
  if (ds.encapsulated) {
    throw new Error(
      `Сжатый формат (${ds.transferSyntax}) не поддерживается — экспортируйте исследование без компрессии`,
    )
  }
  if (ds.pixelOffset < 0) throw new Error('Нет пиксельных данных')
  const samples = ds.getUint16(Tags.SamplesPerPixel) ?? 1
  if (samples !== 1) throw new Error('Поддерживаются только монохромные изображения')
  const bits = ds.getUint16(Tags.BitsAllocated) ?? 16
  const signed = (ds.getUint16(Tags.PixelRepresentation) ?? 0) === 1
  const slope = ds.getNumber(Tags.RescaleSlope) ?? 1
  const intercept = ds.getNumber(Tags.RescaleIntercept) ?? 0
  const frameCount = Math.max(1, Math.round(ds.getNumber(Tags.NumberOfFrames) ?? 1))
  const pixelsPerFrame = rows * columns
  const bytesPerPixel = bits / 8
  const view = new DataView(buffer, ds.pixelOffset)
  const le = ds.littleEndian
  const frames: Int16Array[] = []

  for (let f = 0; f < frameCount; f++) {
    const out = new Int16Array(pixelsPerFrame)
    const base = f * pixelsPerFrame * bytesPerPixel
    if (base + pixelsPerFrame * bytesPerPixel > view.byteLength) break
    for (let i = 0; i < pixelsPerFrame; i++) {
      const o = base + i * bytesPerPixel
      let raw: number
      if (bits === 16) raw = signed ? view.getInt16(o, le) : view.getUint16(o, le)
      else if (bits === 8) raw = signed ? view.getInt8(o) : view.getUint8(o)
      else if (bits === 32) raw = signed ? view.getInt32(o, le) : view.getUint32(o, le)
      else throw new Error(`Bits Allocated = ${bits} не поддерживается`)
      const v = raw * slope + intercept
      out[i] = v > 32767 ? 32767 : v < -32768 ? -32768 : v
    }
    frames.push(out)
  }
  return frames
}

export function parseSliceFile(buffer: ArrayBuffer): ParsedSlice | null {
  let ds: ParsedDicom
  try {
    ds = parseDicom(buffer)
  } catch {
    return null
  }
  const rows = ds.getUint16(Tags.Rows)
  const columns = ds.getUint16(Tags.Columns)
  if (!rows || !columns || ds.pixelOffset < 0) return null
  const frames = readFrames(ds, buffer, rows, columns)
  const ps = ds.getNumbers(Tags.PixelSpacing)
  const pos = ds.getNumbers(Tags.ImagePositionPatient)
  const wc = ds.getNumber(Tags.WindowCenter)
  const ww = ds.getNumber(Tags.WindowWidth)
  return {
    seriesUid: ds.getString(Tags.SeriesInstanceUID) ?? 'default',
    rows,
    columns,
    frames,
    position: pos && pos.length >= 3 ? [pos[0], pos[1], pos[2]] : undefined,
    orientation: ds.getNumbers(Tags.ImageOrientationPatient),
    instance: ds.getNumber(Tags.InstanceNumber) ?? 0,
    pixelSpacing: ps && ps.length >= 2 ? [ps[0], ps[1]] : [1, 1],
    sliceSpacing: ds.getNumber(Tags.SpacingBetweenSlices) ?? ds.getNumber(Tags.SliceThickness),
    window: wc !== undefined && ww !== undefined && ww > 1 ? { center: wc, width: ww } : undefined,
    meta: {
      patientName: formatPersonName(ds.getString(Tags.PatientName)) || 'Без имени',
      patientId: ds.getString(Tags.PatientID) ?? '',
      birthDate: ds.getString(Tags.PatientBirthDate) ?? '',
      sex: ds.getString(Tags.PatientSex) ?? '',
      studyDate: ds.getString(Tags.StudyDate) ?? '',
      studyDescription: ds.getString(Tags.StudyDescription) ?? '',
      seriesDescription: ds.getString(Tags.SeriesDescription) ?? '',
      modality: ds.getString(Tags.Modality) ?? 'CT',
      manufacturer: ds.getString(Tags.Manufacturer) ?? '',
    },
  }
}

function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

export function computeRange(data: Int16Array): { range: [number, number]; window: { center: number; width: number } } {
  const hist = new Uint32Array(65536)
  let min = 32767
  let max = -32768
  const step = Math.max(1, Math.floor(data.length / 4_000_000))
  let count = 0
  for (let i = 0; i < data.length; i += step) {
    const v = data[i]
    hist[v + 32768]++
    if (v < min) min = v
    if (v > max) max = v
    count++
  }
  const percentile = (p: number) => {
    const target = count * p
    let acc = 0
    for (let i = 0; i < hist.length; i++) {
      acc += hist[i]
      if (acc >= target) return i - 32768
    }
    return max
  }
  const lo = percentile(0.02)
  const hi = percentile(0.998)
  return {
    range: [min, max],
    window: { center: Math.round((lo + hi) / 2), width: Math.max(1, Math.round(hi - lo)) },
  }
}

export function assembleSeries(slices: ParsedSlice[], warnings: string[]): ImportedSeries[] {
  const groups = new Map<string, ParsedSlice[]>()
  for (const s of slices) {
    const g = groups.get(s.seriesUid) ?? []
    g.push(s)
    groups.set(s.seriesUid, g)
  }

  const result: ImportedSeries[] = []
  for (const [uid, group] of groups) {
    const sizeKey = (s: ParsedSlice) => `${s.rows}x${s.columns}`
    const counts = new Map<string, number>()
    for (const s of group) counts.set(sizeKey(s), (counts.get(sizeKey(s)) ?? 0) + 1)
    const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
    const items = group.filter((s) => sizeKey(s) === dominant)
    if (items.length !== group.length) warnings.push(`Серия ${uid}: пропущены срезы другого размера`)

    const first = items[0]
    const iop = first.orientation
    let normal: Vec3 = [0, 0, 1]
    if (iop && iop.length >= 6) {
      normal = [
        iop[1] * iop[5] - iop[2] * iop[4],
        iop[2] * iop[3] - iop[0] * iop[5],
        iop[0] * iop[4] - iop[1] * iop[3],
      ]
    }
    const project = (s: ParsedSlice) =>
      s.position ? s.position[0] * normal[0] + s.position[1] * normal[1] + s.position[2] * normal[2] : s.instance

    let frames: Int16Array[]
    let sliceSpacing: number | undefined
    if (items.length === 1 && first.frames.length > 1) {
      frames = first.frames
      sliceSpacing = first.sliceSpacing
    } else {
      const hasPositions = items.every((s) => s.position)
      items.sort((a, b) => (hasPositions ? project(a) - project(b) : a.instance - b.instance))
      if (hasPositions && items.length > 1) {
        const diffs: number[] = []
        for (let i = 1; i < items.length; i++) diffs.push(Math.abs(project(items[i]) - project(items[i - 1])))
        const m = median(diffs)
        if (m > 1e-4) sliceSpacing = m
      }
      sliceSpacing ??= first.sliceSpacing
      frames = items.flatMap((s) => s.frames)
    }

    if (frames.length < 2) {
      warnings.push(`Серия ${uid}: менее 2 срезов — пропущена (не объёмное исследование)`)
      continue
    }

    const nx = first.columns
    const ny = first.rows
    const nz = frames.length
    const data = new Int16Array(nx * ny * nz)
    for (let k = 0; k < nz; k++) {
      const frame = frames[k]
      // Flip the frame vertically to match standard screen coordinates
      for (let y = 0; y < ny; y++) {
        data.set(
          frame.subarray(y * nx, (y + 1) * nx),
          k * nx * ny + (ny - 1 - y) * nx
        )
      }
    }

    const [rowSpacing, colSpacing] = first.pixelSpacing
    const spacing: Vec3 = [colSpacing, rowSpacing, sliceSpacing && sliceSpacing > 0 ? sliceSpacing : colSpacing]
    const stats = computeRange(data)

    result.push({
      ...first.meta,
      dims: [nx, ny, nz],
      spacing,
      window: first.window ?? stats.window,
      range: stats.range,
      fileCount: items.length,
      sizeBytes: data.byteLength,
      buffer: data.buffer,
    })
  }
  return result
}
