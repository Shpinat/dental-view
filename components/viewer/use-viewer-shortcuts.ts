'use client'

import { useEffect } from 'react'
import { useViewer } from '@/lib/viewer-store'
import type { Tool } from '@/lib/types'

const TOOL_KEYS: Record<string, Tool> = { v: 'crosshair', w: 'wl', p: 'pan', z: 'zoom', m: 'measure', c: 'curve' }

export function useViewerShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
      const s = useViewer.getState()
      const key = e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && key === 'z') {
        e.preventDefault()
        s.undoMeasurement()
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (TOOL_KEYS[key]) {
        if (key === 'c' && s.layout !== 'panorama') return
        s.setTool(TOOL_KEYS[key])
      } else if (key === 'i') s.toggleInvert()
      else if (key === 'r') {
        s.resetViews()
        s.resetWl()
      } else if ((key === 'enter' || key === 'escape') && s.tool === 'curve' && s.curve.length >= 2) {
        s.setCurve(s.curve, true)
        s.setTool('crosshair')
      } else if (key === 'tab' && !e.shiftKey) {
        e.preventDefault()
        s.setLayout(s.layout === 'mpr' ? 'panorama' : 'mpr')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
