import type { HandShape, SignToken } from "./types"
import { REST_SHAPE } from "./alphabet"

// Absolute runtime state for one hand.
export interface HandRuntime {
  pos: [number, number, number]
  shape: HandShape
}

export interface Pose {
  right: HandRuntime
  left: HandRuntime
}

interface TimelineFrame {
  right: HandRuntime
  left: HandRuntime
  hold: number
  tokenIndex: number
}

// Where the two hands rest relative to the body, and the anchor that per-frame
// offsets are measured from. Tuned for the avatar in avatar units.
const ANCHOR_R: [number, number, number] = [0.14, 0.98, 0.16]
const ANCHOR_L: [number, number, number] = [-0.14, 0.98, 0.16]
// Idle rest: hands hang at the thighs, slightly forward of the hip plane.
// World-space derivation from FBX rig data:
//   shoulder world: [±0.30, 0.148, -0.308], arm reach: 0.712 m
//   group offset y=-1.0, SIZE=0.82, X_GAIN=1.25, zShift≈0
//   group-local → world: x*0.82*1.25,  y*0.82 - 1.0,  z*0.82 + zShift
// Target world [±0.32, -0.23, -0.16] → group-local [±0.313, 0.936, -0.204]
// A slightly-forward z (-0.16 world vs shoulder -0.308) lets the arm hang with
// a natural slight forward drape rather than jamming straight back behind the hip.
const REST_R: [number, number, number] = [0.313, 0.936, -0.204]
const REST_L: [number, number, number] = [-0.313, 0.936, -0.204]

function add(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

function withWrist(shape: HandShape, wrist?: [number, number, number]): HandShape {
  if (!wrist) return shape
  return { ...shape, wrist }
}

function restHand(side: "right" | "left"): HandRuntime {
  return { pos: side === "right" ? REST_R : REST_L, shape: REST_SHAPE }
}

let _idleLogCount = 0
function idlePose(): Pose {
  if (_idleLogCount < 3) {
    console.log("[v0] idlePose REST_R", REST_R, "REST_L", REST_L)
    _idleLogCount++
  }
  return { right: restHand("right"), left: restHand("left") }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpTriple(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
}

function lerpShape(a: HandShape, b: HandShape, t: number): HandShape {
  return {
    curl: {
      thumb: lerp(a.curl.thumb, b.curl.thumb, t),
      index: lerp(a.curl.index, b.curl.index, t),
      middle: lerp(a.curl.middle, b.curl.middle, t),
      ring: lerp(a.curl.ring, b.curl.ring, t),
      pinky: lerp(a.curl.pinky, b.curl.pinky, t),
    },
    spread: lerp(a.spread, b.spread, t),
    thumbSide: lerp(a.thumbSide, b.thumbSide, t),
    wrist: [
      lerp(a.wrist?.[0] ?? 0, b.wrist?.[0] ?? 0, t),
      lerp(a.wrist?.[1] ?? 0, b.wrist?.[1] ?? 0, t),
      lerp(a.wrist?.[2] ?? 0, b.wrist?.[2] ?? 0, t),
    ],
  }
}

function lerpHand(a: HandRuntime, b: HandRuntime, t: number): HandRuntime {
  return { pos: lerpTriple(a.pos, b.pos, t), shape: lerpShape(a.shape, b.shape, t) }
}

/**
 * Drives smooth playback of a sign sequence. Frame-rate independent: call
 * `update(dt)` every frame with seconds elapsed and read the returned Pose.
 */
export class PosePlayer {
  private timeline: TimelineFrame[] = []
  private tokens: SignToken[] = []
  private idx = 0
  private elapsed = 0
  private playing = false
  private displayed: Pose = clonePose(idlePose())
  private lastToken = -1

  /** Playback rate multiplier. 1 = normal, <1 slower, >1 faster. */
  speed = 1

  onToken?: (tokenIndex: number) => void
  onProgress?: (label: string, index: number, total: number) => void
  onDone?: () => void

  get isPlaying() {
    return this.playing
  }

  load(tokens: SignToken[]) {
    this.tokens = tokens
    const timeline: TimelineFrame[] = []
    tokens.forEach((token, tokenIndex) => {
      for (const frame of token.sign.frames) {
        const right: HandRuntime = frame.right
          ? {
              pos: frame.rightPos ? add(ANCHOR_R, frame.rightPos) : ANCHOR_R,
              shape: withWrist(frame.right, frame.wrist),
            }
          : restHand("right")
        const left: HandRuntime = frame.left
          ? {
              pos: frame.leftPos ? add(ANCHOR_L, frame.leftPos) : ANCHOR_L,
              shape: frame.left,
            }
          : restHand("left")
        timeline.push({ right, left, hold: frame.hold ?? 380, tokenIndex })
      }
      // Brief relaxed gap between adjacent fingerspelled letters for legibility.
      if (token.kind === "letter") {
        timeline.push({
          right: { pos: add(ANCHOR_R, [0, -0.02, 0]), shape: REST_SHAPE },
          left: restHand("left"),
          hold: 90,
          tokenIndex,
        })
      }
    })
    this.timeline = timeline
    this.idx = 0
    this.elapsed = 0
    this.lastToken = -1
    this.playing = timeline.length > 0
  }

  stop() {
    this.playing = false
    this.timeline = []
    this.idx = 0
    this.elapsed = 0
  }

  update(dt: number): Pose {
    let target: Pose
    if (this.playing && this.idx < this.timeline.length) {
      const frame = this.timeline[this.idx]
      target = { right: frame.right, left: frame.left }

      if (frame.tokenIndex !== this.lastToken) {
        this.lastToken = frame.tokenIndex
        this.onToken?.(frame.tokenIndex)
        const token = this.tokens[frame.tokenIndex]
        if (token) this.onProgress?.(token.label, frame.tokenIndex, this.tokens.length)
      }

      this.elapsed += dt * 1000 * this.speed
      if (this.elapsed >= frame.hold) {
        this.elapsed = 0
        this.idx++
        if (this.idx >= this.timeline.length) {
          this.playing = false
          this.onDone?.()
        }
      }
    } else {
      target = idlePose()
    }

    // Smoothly approach the target (frame-rate independent easing).
    const k = 1 - Math.exp(-dt / 0.075)
    this.displayed = {
      right: lerpHand(this.displayed.right, target.right, k),
      left: lerpHand(this.displayed.left, target.left, k),
    }
    return this.displayed
  }
}

function clonePose(p: Pose): Pose {
  return {
    right: { pos: [...p.right.pos] as [number, number, number], shape: cloneShape(p.right.shape) },
    left: { pos: [...p.left.pos] as [number, number, number], shape: cloneShape(p.left.shape) },
  }
}

function cloneShape(s: HandShape): HandShape {
  return { curl: { ...s.curl }, spread: s.spread, thumbSide: s.thumbSide, wrist: s.wrist ? [...s.wrist] : undefined }
}
