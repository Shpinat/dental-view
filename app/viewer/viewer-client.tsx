'use client'

import { useSearchParams } from 'next/navigation'
import { Viewer } from '@/components/viewer/viewer'

export function ViewerClient() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? ''

  return <Viewer key={id} id={id} />
}
