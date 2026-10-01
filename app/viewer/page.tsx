import type { Metadata } from 'next'
import { Viewer } from '@/components/viewer/viewer'

export const metadata: Metadata = {
  title: 'Просмотр исследования · ДентаВью',
}

export default async function ViewerPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams
  return <Viewer key={id} id={id ?? ''} />
}
