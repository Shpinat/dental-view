export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`
  const units = ['КБ', 'МБ', 'ГБ', 'ТБ']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`
}

export function formatMm(mm: number) {
  return `${mm.toFixed(mm < 10 ? 2 : 1)} мм`
}

export function viewerUrl(id: string) {
  return `/viewer?id=${encodeURIComponent(id)}`
}
