export type Vec3 = [number, number, number]

export interface WindowLevel {
  center: number
  width: number
}

export interface StudyMeta {
  id: string
  patientName: string
  patientId: string
  birthDate: string
  sex: string
  studyDate: string
  studyDescription: string
  seriesDescription: string
  modality: string
  manufacturer: string
  dims: Vec3
  spacing: Vec3
  window: WindowLevel
  range: [number, number]
  fileCount: number
  sizeBytes: number
  importedAt: number
  thumbnail?: string
}

export interface Volume {
  dims: Vec3
  spacing: Vec3
  data: Int16Array
}

export interface SliceImage {
  data: Int16Array
  width: number
  height: number
  spacingX: number
  spacingY: number
}

export interface Point2 {
  x: number
  y: number
}

export interface Measurement {
  id: string
  a: Point2
  b: Point2
}

export type Tool = 'crosshair' | 'wl' | 'pan' | 'zoom' | 'measure' | 'curve'

export type ImportedSeries = Omit<StudyMeta, 'id' | 'importedAt' | 'thumbnail'> & {
  buffer: ArrayBuffer
}

export type ImportWorkerMessage =
  | { type: 'progress'; done: number; total: number; stage: string }
  | { type: 'series'; series: ImportedSeries }
  | { type: 'done'; count: number; warnings: string[] }
  | { type: 'error'; message: string }
