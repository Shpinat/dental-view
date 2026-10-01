import type { ImportedSeries } from './types'

/**
 * Synthetic dental CBCT phantom: mandible + maxilla arches, 28 teeth with enamel/dentin/pulp,
 * mandibular canal and a titanium implant in place of a missing tooth.
 */
export function generatePhantom(onProgress?: (p: number) => void): ImportedSeries {
  const nx = 256
  const ny = 256
  const nz = 200
  const s = 0.4
  const data = new Int16Array(nx * ny * nz)

  const cx = (nx * s) / 2
  const yFront = 26
  const k = 0.052
  const pts: [number, number][] = []
  for (let x = -27; x <= 27.001; x += 0.5) pts.push([cx + x, yFront + k * x * x])
  const cum = [0]
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  }
  const L = cum[cum.length - 1]

  const plane = nx * ny
  const vMap = new Float32Array(plane).fill(1e9)
  const tMap = new Float32Array(plane)
  const inside = new Uint8Array(plane)

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const px = (i + 0.5) * s
      const py = (j + 0.5) * s
      let best = 1e9
      let bestT = 0
      let bestSign = 1
      for (let q = 1; q < pts.length; q++) {
        const [ax, ay] = pts[q - 1]
        const [bx, by] = pts[q]
        const dx = bx - ax
        const dy = by - ay
        const len2 = dx * dx + dy * dy
        let u = ((px - ax) * dx + (py - ay) * dy) / len2
        u = u < 0 ? 0 : u > 1 ? 1 : u
        const qx = ax + u * dx - px
        const qy = ay + u * dy - py
        const d = qx * qx + qy * qy
        if (d < best) {
          best = d
          bestT = cum[q - 1] + u * Math.sqrt(len2)
          const cross = dx * (py - ay) - dy * (px - ax)
          bestSign = cross < 0 ? 1 : -1
        }
      }
      const idx = j * nx + i
      const relX = px - cx
      if (Math.abs(relX) < 27) inside[idx] = py > yFront + k * relX * relX ? 1 : 0
      if (bestT <= 0.01 || bestT >= L - 0.01) continue
      vMap[idx] = bestSign * Math.sqrt(best)
      tMap[idx] = bestT
    }
  }

  let seed = 1234567
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296 - 0.5
  }

  const teeth = 14
  const toothLen = L / teeth
  const missingLower = 3
  const occlusal = 41.5

  for (let kz = 0; kz < nz; kz++) {
    const z = (kz + 0.5) * s
    const zOff = kz * plane
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const idx = j * nx + i
        const px = (i + 0.5) * s
        const py = (j + 0.5) * s
        const ex = (px - cx) / 47
        const ey = (py - 50) / 46
        let val = ex * ex + ey * ey < 1 ? 35 + rand() * 40 : -1000 + rand() * 20

        const v = vMap[idx]
        const t = tMap[idx]
        const av = Math.abs(v)

        if (av < 12) {
          const along = Math.abs(t - L / 2) / (L / 2)

          if (z > 3 && z < 35) {
            const half = 5.8 - Math.max(0, z - 26) * 0.18 + along * 1.2
            if (av < half) {
              const cortical = av > half - 1.3 || z < 4.6
              val = cortical ? 1450 + rand() * 120 : 520 + rand() * 160
              const dz = z - 12.5
              if (along > 0.35 && v * v + dz * dz < 1.6 * 1.6) val = 60 + rand() * 40
            }
          }

          if (z > 46 && z < 70) {
            const half = 6.4 + along * 1.4 - Math.max(0, 52 - z) * 0.2
            if (av < half) {
              const cortical = av > half - 1.1
              val = cortical ? 1150 + rand() * 120 : 420 + rand() * 150
            }
          }

          const ti = Math.min(teeth - 1, Math.floor(t / toothLen))
          const u = t - (ti + 0.5) * toothLen
          const sideFactor = Math.abs((ti + 0.5) / teeth - 0.5) * 2
          const aw = toothLen * 0.43
          const bw = 2.6 + sideFactor * 2.4
          const rootDepth = 15 + (1 - sideFactor) * 4

          const lowerCrownTop = occlusal - 0.5
          const lowerCervical = lowerCrownTop - 7
          const upperCrownTop = occlusal + 0.5
          const upperCervical = upperCrownTop + 7.5

          let f = 0
          let crown = false
          let fromTop = 0
          if (z <= lowerCrownTop && z > lowerCervical - rootDepth && ti !== missingLower) {
            if (z >= lowerCervical) {
              crown = true
              fromTop = lowerCrownTop - z
              f = fromTop < 1.5 ? 0.75 + fromTop * 0.17 : 1 - (fromTop - 1.5) * 0.03
            } else {
              f = 0.8 - ((lowerCervical - z) / rootDepth) * 0.6
            }
          } else if (z >= upperCrownTop && z < upperCervical + rootDepth) {
            if (z <= upperCervical) {
              crown = true
              fromTop = z - upperCrownTop
              f = fromTop < 1.5 ? 0.75 + fromTop * 0.17 : 1 - (fromTop - 1.5) * 0.03
            } else {
              f = 0.8 - ((z - upperCervical) / rootDepth) * 0.6
            }
          }

          if (f > 0) {
            const nu = u / (aw * f)
            const nv = v / (bw * f)
            const r = Math.sqrt(nu * nu + nv * nv)
            if (r < 1) {
              if (crown && (r > 0.78 || fromTop < 1.2)) val = 2700 + rand() * 150
              else if (r < (crown ? 0.38 : 0.28) && fromTop > 2.2) val = 110 + rand() * 50
              else val = 1650 + rand() * 120
            } else if (!crown && r < 1.12) {
              val = Math.min(val, 200 + rand() * 60)
            }
          }

          if (ti === missingLower && z > 18 && z < 34) {
            const ur = Math.sqrt(u * u + v * v)
            const thread = 1.85 + 0.15 * Math.sin(z * 7)
            if (ur < thread) val = 3600 + rand() * 80
          }
        }

        if (inside[idx] && z > 63 && z < 66.5 && py < 78) val = 1100 + rand() * 120

        data[zOff + idx] = val
      }
    }
    if (onProgress && kz % 10 === 0) onProgress(kz / nz)
  }

  return {
    patientName: 'Демо Фантом',
    patientId: 'DEMO-0001',
    birthDate: '19850412',
    sex: 'O',
    studyDate: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
    studyDescription: 'КЛКТ челюстей (синтетический фантом)',
    seriesDescription: 'Phantom 0.4 mm',
    modality: 'CT',
    manufacturer: 'Synthetic',
    dims: [nx, ny, nz],
    spacing: [s, s, s],
    window: { center: 900, width: 3600 },
    range: [-1020, 3700],
    fileCount: 0,
    sizeBytes: data.byteLength,
    buffer: data.buffer,
  }
}
