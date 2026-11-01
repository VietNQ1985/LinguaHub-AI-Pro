export interface OcrLine {
  text: string
  confidence: number
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

export interface SegmentedOcrMessage {
  text: string
  confidence: number
  side: 'left' | 'right' | 'center'
}

export function segmentOcrLines(lines: OcrLine[], width: number, height: number) {
  const clean = lines
    .map(line => ({ ...line, text: line.text.replace(/\s+/g, ' ').trim() }))
    .filter(line => line.text && Number.isFinite(line.bbox.y0) && Number.isFinite(line.bbox.y1) && line.bbox.y1 > line.bbox.y0)
    .sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0)
  const headerBoundary = Math.max(1, height * 0.13)
  const headerText = clean.filter(line => line.bbox.y0 < headerBoundary).map(line => line.text).join(' ').replace(/\s+/g, ' ').trim()
  const body = clean.filter(line => line.bbox.y0 >= headerBoundary)
  const heights = body.map(line => line.bbox.y1 - line.bbox.y0).sort((a, b) => a - b)
  const medianHeight = heights.length ? heights[Math.floor(heights.length / 2)] : 16
  const groups: Array<{ lines: typeof body; side: SegmentedOcrMessage['side'] }> = []
  for (const line of body) {
    const center = (line.bbox.x0 + line.bbox.x1) / 2
    const side = center < width * 0.44 ? 'left' : center > width * 0.56 ? 'right' : 'center'
    const previousGroup = groups.at(-1)
    const previousLine = previousGroup?.lines.at(-1)
    const gap = previousLine ? line.bbox.y0 - previousLine.bbox.y1 : Number.POSITIVE_INFINITY
    const horizontalShift = previousLine ? Math.abs(line.bbox.x0 - previousLine.bbox.x0) : 0
    const newMessage = !previousGroup || !previousLine || gap > Math.max(12, medianHeight * 0.8) ||
      (previousGroup.side !== side && gap > medianHeight * 0.2) ||
      (horizontalShift > width * 0.1 && gap > medianHeight * 0.25)
    if (newMessage) groups.push({ lines: [line], side })
    else previousGroup.lines.push(line)
  }
  const messages = groups.map(group => ({
    text: group.lines.map(line => line.text).join(' ').replace(/\s+/g, ' ').trim(),
    confidence: group.lines.reduce((total, line) => total + line.confidence, 0) / group.lines.length,
    side: group.side,
  })).filter(message => message.text).slice(-40)
  return { headerText, messages }
}

export function conversationFingerprint(headerText: string) {
  const normalized = headerText.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  if (normalized.length < 2) return null
  // This local fingerprint is only an ephemeral conversation-change signal; the source text is discarded.
  let hash = 2166136261
  for (const character of normalized) hash = Math.imul(hash ^ character.codePointAt(0)!, 16777619)
  return (hash >>> 0).toString(16).padStart(8, '0')
}
