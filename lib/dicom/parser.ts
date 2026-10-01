const TS_IMPLICIT_LE = '1.2.840.10008.1.2'
const TS_EXPLICIT_LE = '1.2.840.10008.1.2.1'
const TS_EXPLICIT_BE = '1.2.840.10008.1.2.2'

const LONG_VRS = new Set(['OB', 'OD', 'OF', 'OL', 'OV', 'OW', 'SQ', 'UC', 'UR', 'UT', 'UN', 'SV', 'UV'])

const IMPLICIT_US_TAGS = new Set([
  0x00280002, 0x00280006, 0x00280010, 0x00280011, 0x00280100, 0x00280101, 0x00280102, 0x00280103,
])

const ITEM = 0xfffee000
const ITEM_DELIM = 0xfffee00d
const SEQ_DELIM = 0xfffee0dd
const PIXEL_DATA = 0x7fe00010

interface ElementRef {
  vr: string
  offset: number
  length: number
}

export class DicomParseError extends Error {}

export interface ParsedDicom {
  transferSyntax: string
  littleEndian: boolean
  encapsulated: boolean
  pixelOffset: number
  pixelLength: number
  getString(tag: number): string | undefined
  getNumber(tag: number, index?: number): number | undefined
  getNumbers(tag: number): number[] | undefined
  getUint16(tag: number): number | undefined
}

export const Tags = {
  SpecificCharacterSet: 0x00080005,
  StudyDate: 0x00080020,
  Modality: 0x00080060,
  Manufacturer: 0x00080070,
  StudyDescription: 0x00081030,
  SeriesDescription: 0x0008103e,
  PatientName: 0x00100010,
  PatientID: 0x00100020,
  PatientBirthDate: 0x00100030,
  PatientSex: 0x00100040,
  SliceThickness: 0x00180050,
  SpacingBetweenSlices: 0x00180088,
  StudyInstanceUID: 0x0020000d,
  SeriesInstanceUID: 0x0020000e,
  InstanceNumber: 0x00200013,
  ImagePositionPatient: 0x00200032,
  ImageOrientationPatient: 0x00200037,
  SamplesPerPixel: 0x00280002,
  NumberOfFrames: 0x00280008,
  Rows: 0x00280010,
  Columns: 0x00280011,
  PixelSpacing: 0x00280030,
  BitsAllocated: 0x00280100,
  PixelRepresentation: 0x00280103,
  WindowCenter: 0x00281050,
  WindowWidth: 0x00281051,
  RescaleIntercept: 0x00281052,
  RescaleSlope: 0x00281053,
} as const

function charsetDecoder(charset: string | undefined): TextDecoder {
  const cs = (charset ?? '').toUpperCase()
  try {
    if (cs.includes('ISO_IR 192')) return new TextDecoder('utf-8')
    if (cs.includes('ISO_IR 144')) return new TextDecoder('iso-8859-5')
    if (cs.includes('ISO_IR 100')) return new TextDecoder('windows-1252')
  } catch {
    // fall through to default decoder
  }
  return new TextDecoder('windows-1252')
}

export function parseDicom(buffer: ArrayBuffer): ParsedDicom {
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  const top = new Map<number, ElementRef>()
  const nested = new Map<number, ElementRef>()

  let pos = 0
  let transferSyntax = TS_IMPLICIT_LE
  const hasPreamble =
    bytes.length > 132 && bytes[128] === 0x44 && bytes[129] === 0x49 && bytes[130] === 0x43 && bytes[131] === 0x4d

  const ascii = (offset: number, length: number) => {
    let s = ''
    for (let i = 0; i < length; i++) s += String.fromCharCode(bytes[offset + i])
    return s
  }

  if (hasPreamble) {
    pos = 132
    while (pos + 8 <= bytes.length) {
      const group = view.getUint16(pos, true)
      if (group !== 0x0002) break
      const element = view.getUint16(pos + 2, true)
      const vr = ascii(pos + 4, 2)
      let length: number
      let valueOffset: number
      if (LONG_VRS.has(vr)) {
        length = view.getUint32(pos + 8, true)
        valueOffset = pos + 12
      } else {
        length = view.getUint16(pos + 6, true)
        valueOffset = pos + 8
      }
      const tag = ((group << 16) | element) >>> 0
      if (tag === 0x00020010) transferSyntax = ascii(valueOffset, length).replace(/[\0\s]+$/g, '')
      pos = valueOffset + length
    }
  } else {
    const firstGroup = bytes.length > 4 ? view.getUint16(0, true) : 0
    if (firstGroup !== 0x0008 && firstGroup !== 0x0002) {
      throw new DicomParseError('Not a DICOM file')
    }
  }

  const littleEndian = transferSyntax !== TS_EXPLICIT_BE
  const explicit = transferSyntax !== TS_IMPLICIT_LE
  if (transferSyntax === '1.2.840.10008.1.2.1.99') {
    throw new DicomParseError('Deflated transfer syntax is not supported')
  }

  let encapsulated = false
  let pixelOffset = -1
  let pixelLength = 0

  const readTag = (p: number) => {
    const g = view.getUint16(p, littleEndian)
    const e = view.getUint16(p + 2, littleEndian)
    return ((g << 16) | e) >>> 0
  }

  // Item and delimiter tags are always encoded implicitly regardless of VR mode.
  const skipUndefinedSequence = (start: number, depth: number): number => {
    let p = start
    while (p + 8 <= bytes.length) {
      const tag = readTag(p)
      const len = view.getUint32(p + 4, littleEndian)
      p += 8
      if (tag === SEQ_DELIM) return p
      if (tag === ITEM) {
        if (len === 0xffffffff) {
          p = parseDataset(p, bytes.length, depth + 1, true)
        } else {
          parseDataset(p, p + len, depth + 1, false)
          p += len
        }
      } else {
        return p
      }
    }
    return p
  }

  const skipEncapsulated = (start: number): number => {
    let p = start
    while (p + 8 <= bytes.length) {
      const tag = readTag(p)
      const len = view.getUint32(p + 4, littleEndian)
      p += 8
      if (tag === SEQ_DELIM) return p
      p += len
    }
    return p
  }

  function parseDataset(start: number, end: number, depth: number, untilItemDelim: boolean): number {
    let p = start
    const target = depth === 0 ? top : nested
    while (p + 8 <= end) {
      const tag = readTag(p)
      if (tag === ITEM_DELIM) {
        p += 8
        if (untilItemDelim) return p
        continue
      }
      if (tag === SEQ_DELIM) {
        p += 8
        continue
      }
      let vr: string
      let length: number
      let valueOffset: number
      if (explicit) {
        vr = ascii(p + 4, 2)
        if (LONG_VRS.has(vr)) {
          length = view.getUint32(p + 8, littleEndian)
          valueOffset = p + 12
        } else if (/^[A-Z]{2}$/.test(vr)) {
          length = view.getUint16(p + 6, littleEndian)
          valueOffset = p + 8
        } else {
          // Malformed VR — fall back to implicit interpretation for this element.
          vr = 'UN'
          length = view.getUint32(p + 4, littleEndian)
          valueOffset = p + 8
        }
      } else {
        vr = IMPLICIT_US_TAGS.has(tag) ? 'US' : tag === PIXEL_DATA ? 'OW' : 'UN'
        length = view.getUint32(p + 4, littleEndian)
        valueOffset = p + 8
      }

      if (tag === PIXEL_DATA && depth === 0) {
        if (length === 0xffffffff) {
          encapsulated = true
          pixelOffset = valueOffset
          return skipEncapsulated(valueOffset)
        }
        pixelOffset = valueOffset
        pixelLength = length
        p = valueOffset + length
        continue
      }

      if (length === 0xffffffff) {
        p = skipUndefinedSequence(valueOffset, depth)
        continue
      }

      if (vr === 'SQ' || (!explicit && length > 0 && isLikelySequence(valueOffset))) {
        let q = valueOffset
        const seqEnd = valueOffset + length
        while (q + 8 <= seqEnd) {
          const itemTag = readTag(q)
          const itemLen = view.getUint32(q + 4, littleEndian)
          q += 8
          if (itemTag !== ITEM) break
          if (itemLen === 0xffffffff) {
            q = parseDataset(q, seqEnd, depth + 1, true)
          } else {
            parseDataset(q, q + itemLen, depth + 1, false)
            q += itemLen
          }
        }
        p = seqEnd
        continue
      }

      if (!target.has(tag)) target.set(tag, { vr, offset: valueOffset, length })
      p = valueOffset + length
    }
    return p
  }

  function isLikelySequence(offset: number) {
    return offset + 4 <= bytes.length && readTag(offset) === ITEM
  }

  parseDataset(pos, bytes.length, 0, false)

  const lookup = (tag: number) => top.get(tag) ?? nested.get(tag)
  const decoder = charsetDecoder(
    (() => {
      const ref = top.get(Tags.SpecificCharacterSet)
      return ref ? ascii(ref.offset, ref.length) : undefined
    })(),
  )

  const getString = (tag: number) => {
    const ref = lookup(tag)
    if (!ref || ref.length === 0) return undefined
    const s = decoder.decode(bytes.subarray(ref.offset, ref.offset + ref.length))
    return s.replace(/[\0\s]+$/g, '').trim()
  }

  const getUint16 = (tag: number) => {
    const ref = lookup(tag)
    if (!ref || ref.length < 2) return undefined
    return view.getUint16(ref.offset, littleEndian)
  }

  const getNumbers = (tag: number) => {
    const s = getString(tag)
    if (!s) return undefined
    const values = s
      .split('\\')
      .map((v) => Number.parseFloat(v))
      .filter((v) => Number.isFinite(v))
    return values.length ? values : undefined
  }

  return {
    transferSyntax,
    littleEndian,
    encapsulated,
    pixelOffset,
    pixelLength,
    getString,
    getUint16,
    getNumbers,
    getNumber: (tag, index = 0) => getNumbers(tag)?.[index],
  }
}

export function formatPersonName(raw: string | undefined) {
  if (!raw) return ''
  return raw
    .split('=')[0]
    .split('^')
    .filter(Boolean)
    .join(' ')
    .trim()
}

export function formatDicomDate(raw: string | undefined) {
  if (!raw || raw.length < 8) return raw ?? ''
  return `${raw.slice(6, 8)}.${raw.slice(4, 6)}.${raw.slice(0, 4)}`
}
