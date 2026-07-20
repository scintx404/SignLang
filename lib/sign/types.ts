// Shared vocabulary for describing hand shapes.
//
// A HandShape is an abstract, rig-agnostic description of one hand. It is
// consumed by the procedural avatar today, and the SAME data can drive a
// rigged GLB later (map each finger curl / spread onto the corresponding
// finger bone rotations of the imported model).

export type FingerName = "thumb" | "index" | "middle" | "ring" | "pinky"

export interface HandShape {
  /**
   * Per-finger curl, 0 = fully extended, 1 = fully closed into the palm.
   * The renderer distributes this across the finger's joints.
   */
  curl: Record<FingerName, number>
  /**
   * Finger spread (abduction) for index..pinky. 0 = together, 1 = fanned out.
   */
  spread: number
  /**
   * Thumb lateral position. -1 = tucked across the palm, 0 = neutral beside
   * the hand, 1 = abducted out to the side (as in "L" or "Y").
   */
  thumbSide: number
  /**
   * Wrist rotation in degrees [pitch(x), yaw(y), roll(z)]. Optional; defaults
   * to a neutral palm-forward orientation.
   */
  wrist?: [number, number, number]
}

// One keyframe of a sign: the shape of each hand plus an overall position for
// the whole hand in front of the body (in avatar-local units).
export interface SignFrame {
  right?: HandShape
  left?: HandShape
  /** Right-hand root offset [x, y, z] from the neutral rest position. */
  rightPos?: [number, number, number]
  /** Left-hand root offset [x, y, z] from the neutral rest position. */
  leftPos?: [number, number, number]
  /** Convenience right-hand wrist rotation override (degrees) for this frame. */
  wrist?: [number, number, number]
  /** How long to hold / travel to this frame, in ms. */
  hold?: number
}

// A full sign is an ordered list of frames. A static letter is a single frame;
// motion letters (J, Z) and words use several.
export interface Sign {
  gloss: string
  frames: SignFrame[]
  /** Whether this sign is two-handed (affects camera/framing hints). */
  twoHanded?: boolean
}

// A token in a rendered sign sequence, so the UI can highlight what is playing.
export interface SignToken {
  /** The gloss/letter being shown. */
  label: string
  /** "letter" when fingerspelled, "word" when a lexical sign. */
  kind: "letter" | "word"
  sign: Sign
}
