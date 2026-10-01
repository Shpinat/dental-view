import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { StudyMeta, Volume } from './types'

interface ViewerDB extends DBSchema {
  studies: { key: string; value: StudyMeta; indexes: { importedAt: number } }
  volumes: { key: string; value: { id: string; buffer: ArrayBuffer } }
}

let dbPromise: Promise<IDBPDatabase<ViewerDB>> | null = null

function db() {
  dbPromise ??= openDB<ViewerDB>('cbct-viewer', 1, {
    upgrade(database) {
      const studies = database.createObjectStore('studies', { keyPath: 'id' })
      studies.createIndex('importedAt', 'importedAt')
      database.createObjectStore('volumes', { keyPath: 'id' })
    },
  })
  return dbPromise
}

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('cbct-studies') : null
const localListeners = new Set<() => void>()

function notifyChanged() {
  channel?.postMessage('changed')
  localListeners.forEach((cb) => cb())
}

/** Fires for changes made in this tab and in any other tab/window of the app. */
export function onStudiesChanged(cb: () => void) {
  const handler = () => cb()
  localListeners.add(handler)
  channel?.addEventListener('message', handler)
  return () => {
    localListeners.delete(handler)
    channel?.removeEventListener('message', handler)
  }
}

export async function listStudies(): Promise<StudyMeta[]> {
  const all = await (await db()).getAllFromIndex('studies', 'importedAt')
  return all.reverse()
}

export async function getStudy(id: string) {
  return (await db()).get('studies', id)
}

export async function saveStudy(meta: StudyMeta, buffer: ArrayBuffer) {
  const tx = (await db()).transaction(['studies', 'volumes'], 'readwrite')
  await Promise.all([tx.objectStore('studies').put(meta), tx.objectStore('volumes').put({ id: meta.id, buffer }), tx.done])
  notifyChanged()
}

export async function deleteStudy(id: string) {
  const tx = (await db()).transaction(['studies', 'volumes'], 'readwrite')
  await Promise.all([tx.objectStore('studies').delete(id), tx.objectStore('volumes').delete(id), tx.done])
  notifyChanged()
}

export async function loadVolume(id: string): Promise<{ meta: StudyMeta; volume: Volume }> {
  const database = await db()
  const [meta, vol] = await Promise.all([database.get('studies', id), database.get('volumes', id)])
  if (!meta || !vol) throw new Error('Исследование не найдено в локальном хранилище')
  return { meta, volume: { dims: meta.dims, spacing: meta.spacing, data: new Int16Array(vol.buffer) } }
}
