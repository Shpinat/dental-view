import { create } from 'zustand'
import type { Measurement, Point2, Tool, Vec3, WindowLevel } from './types'

export type Layout = 'mpr' | 'panorama'

interface ViewerState {
  dims: Vec3
  cursor: Vec3
  wl: WindowLevel
  defaultWl: WindowLevel
  invert: boolean
  tool: Tool
  layout: Layout
  curve: Point2[]
  curveDone: boolean
  slabThickness: number
  crossPos: number
  crossCount: number
  crossInterval: number
  crossWidth: number
  measurements: Record<string, Measurement[]>
  viewToken: number
  resetViews: () => void
  init: (dims: Vec3, wl: WindowLevel) => void
  setCursor: (patch: Partial<{ x: number; y: number; z: number }>) => void
  setWl: (wl: WindowLevel) => void
  resetWl: () => void
  toggleInvert: () => void
  setTool: (tool: Tool) => void
  setLayout: (layout: Layout) => void
  setCurve: (curve: Point2[], done?: boolean) => void
  resetCurve: () => void
  setPano: (patch: Partial<Pick<ViewerState, 'slabThickness' | 'crossPos' | 'crossCount' | 'crossInterval' | 'crossWidth'>>) => void
  addMeasurement: (key: string, m: Measurement) => void
  clearMeasurements: () => void
  undoMeasurement: () => void
}

let lastMeasurementKey: string[] = []

export const useViewer = create<ViewerState>((set, get) => ({
  dims: [1, 1, 1],
  cursor: [0, 0, 0],
  wl: { center: 0, width: 1 },
  defaultWl: { center: 0, width: 1 },
  invert: false,
  tool: 'crosshair',
  layout: 'mpr',
  curve: [],
  curveDone: false,
  slabThickness: 12,
  crossPos: 0,
  crossCount: 5,
  crossInterval: 1,
  crossWidth: 36,
  measurements: {},
  viewToken: 0,
  resetViews: () => set({ viewToken: get().viewToken + 1 }),
  init: (dims, wl) => {
    lastMeasurementKey = []
    set({
      dims,
      cursor: [(dims[0] - 1) / 2, (dims[1] - 1) / 2, Math.round((dims[2] - 1) / 2)],
      wl,
      defaultWl: wl,
      invert: false,
      tool: 'crosshair',
      curve: [],
      curveDone: false,
      measurements: {},
      crossPos: 0,
    })
  },
  setCursor: (patch) => {
    const [x, y, z] = get().cursor
    const d = get().dims
    const c = (v: number, max: number) => Math.min(max - 1, Math.max(0, v))
    set({ cursor: [c(patch.x ?? x, d[0]), c(patch.y ?? y, d[1]), c(patch.z ?? z, d[2])] })
  },
  setWl: (wl) => set({ wl: { center: Math.round(wl.center), width: Math.max(1, Math.round(wl.width)) } }),
  resetWl: () => set({ wl: get().defaultWl }),
  toggleInvert: () => set({ invert: !get().invert }),
  setTool: (tool) => set({ tool }),
  setLayout: (layout) =>
    set({ layout, tool: layout === 'panorama' && !get().curveDone ? 'curve' : get().tool === 'curve' ? 'crosshair' : get().tool }),
  setCurve: (curve, done) => set({ curve, curveDone: done ?? get().curveDone }),
  resetCurve: () => set({ curve: [], curveDone: false, tool: 'curve', crossPos: 0 }),
  setPano: (patch) => set(patch),
  addMeasurement: (key, m) => {
    lastMeasurementKey.push(key)
    const list = get().measurements[key] ?? []
    set({ measurements: { ...get().measurements, [key]: [...list, m] } })
  },
  clearMeasurements: () => {
    lastMeasurementKey = []
    set({ measurements: {} })
  },
  undoMeasurement: () => {
    const key = lastMeasurementKey.pop()
    if (!key) return
    const list = get().measurements[key] ?? []
    set({ measurements: { ...get().measurements, [key]: list.slice(0, -1) } })
  },
}))
