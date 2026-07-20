// Heuristic gesture classifier operating on MediaPipe HandLandmarker output.
// 21 landmarks per hand. We derive a per-finger "extended" state and match
// against a small dictionary of static signs.

export interface Landmark {
  x: number
  y: number
  z: number
}

export interface RecognizedGesture {
  sign: string
  confidence: number
}

// Landmark indices (MediaPipe hand model)
const WRIST = 0
const THUMB = { cmc: 1, mcp: 2, ip: 3, tip: 4 }
const FINGERS = [
  { name: 'index', mcp: 5, pip: 6, dip: 7, tip: 8 },
  { name: 'middle', mcp: 9, pip: 10, dip: 11, tip: 12 },
  { name: 'ring', mcp: 13, pip: 14, dip: 15, tip: 16 },
  { name: 'pinky', mcp: 17, pip: 18, dip: 19, tip: 20 },
]

function dist(a: Landmark, b: Landmark) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * A finger is "extended" when its tip is significantly farther from the
 * wrist than its PIP joint. This is rotation-invariant, so it works even
 * when the hand is tilted.
 */
function fingerStates(lm: Landmark[]): boolean[] {
  const wrist = lm[WRIST]

  // Thumb: compare tip distance from pinky MCP (thumb tucks across the palm)
  const palmRef = lm[17]
  const thumbExtended =
    dist(lm[THUMB.tip], palmRef) > dist(lm[THUMB.mcp], palmRef) * 1.15

  const states = [thumbExtended]
  for (const f of FINGERS) {
    const tipDist = dist(lm[f.tip], wrist)
    const pipDist = dist(lm[f.pip], wrist)
    states.push(tipDist > pipDist * 1.08)
  }
  return states // [thumb, index, middle, ring, pinky]
}

interface SignPattern {
  sign: string
  pattern: boolean[] // [thumb, index, middle, ring, pinky]
}

// Static sign dictionary (hackathon heuristics; approximations of ASL signs)
const SIGN_PATTERNS: SignPattern[] = [
  { sign: 'Hello', pattern: [true, true, true, true, true] },
  { sign: 'Yes', pattern: [false, false, false, false, false] },
  { sign: 'Thank You', pattern: [true, false, false, false, false] },
  { sign: 'No', pattern: [false, true, true, false, false] },
  { sign: 'I Love You', pattern: [true, true, false, false, true] },
]

export function classifyGesture(landmarks: Landmark[]): RecognizedGesture | null {
  if (!landmarks || landmarks.length < 21) return null

  const states = fingerStates(landmarks)

  let best: SignPattern | null = null
  let bestScore = 0

  for (const sp of SIGN_PATTERNS) {
    let matches = 0
    for (let i = 0; i < 5; i++) {
      if (sp.pattern[i] === states[i]) matches++
    }
    const score = matches / 5
    if (score > bestScore) {
      bestScore = score
      best = sp
    }
  }

  // Require an exact 5/5 finger-state match for demo reliability
  if (best && bestScore === 1) {
    return { sign: best.sign, confidence: bestScore }
  }
  return null
}

/** Human-readable description of what each supported sign looks like. */
export const SUPPORTED_SIGNS: { sign: string; hint: string }[] = [
  { sign: 'Hello', hint: 'Open palm, all fingers extended' },
  { sign: 'Yes', hint: 'Closed fist' },
  { sign: 'Thank You', hint: 'Thumbs up' },
  { sign: 'No', hint: 'Index + middle fingers only' },
  { sign: 'I Love You', hint: 'Thumb, index and pinky extended' },
]
