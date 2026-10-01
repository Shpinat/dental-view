'use client'

import useSWR from 'swr'
import { formatBytes } from '@/lib/format'

async function estimate() {
  if (!navigator.storage?.estimate) return null
  const [est, persisted] = await Promise.all([
    navigator.storage.estimate(),
    navigator.storage.persisted?.() ?? Promise.resolve(false),
  ])
  if (!persisted) navigator.storage.persist?.().catch(() => {})
  return { usage: est.usage ?? 0, quota: est.quota ?? 0 }
}

export function StorageIndicator({ count }: { count: number }) {
  const { data } = useSWR(['storage', count], estimate)
  if (!data || !data.quota) return null
  const pct = Math.min(100, (data.usage / data.quota) * 100)
  return (
    <div className="flex items-center gap-2" title="Использование локального хранилища браузера">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
      <span className="font-mono tabular-nums">
        {formatBytes(data.usage)}
        <span className="sr-only"> из {formatBytes(data.quota)} использовано</span>
      </span>
    </div>
  )
}
