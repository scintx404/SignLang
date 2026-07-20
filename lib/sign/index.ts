import type { SignToken } from "./types"
import { letterSign, isFingerspellable } from "./alphabet"
import { wordSign, hasWordSign } from "./words"

export * from "./types"
export { REST_SHAPE } from "./alphabet"
export { KNOWN_WORDS } from "./words"

// Multi-word lexical entries (e.g. "thank you") we try to match greedily.
const MULTIWORD = ["thank you"]

/**
 * Convert a line of English/gloss text into an ordered list of sign tokens.
 * Known words map to lexical signs; everything else is fingerspelled.
 */
export function buildSignSequence(text: string): SignToken[] {
  const tokens: SignToken[] = []
  const normalized = text.trim().replace(/\s+/g, " ")
  if (!normalized) return tokens

  const words = normalized.split(" ")
  let i = 0

  while (i < words.length) {
    // Try two-word lexical match first.
    if (i + 1 < words.length) {
      const pair = `${words[i]} ${words[i + 1]}`.toLowerCase().replace(/[.,!?;:]/g, "")
      if (MULTIWORD.includes(pair)) {
        const s = wordSign(pair)
        if (s) {
          tokens.push({ label: s.gloss, kind: "word", sign: s })
          i += 2
          continue
        }
      }
    }

    const raw = words[i]
    const clean = raw.replace(/[.,!?;:]/g, "")
    i++

    if (!clean) continue

    if (hasWordSign(clean)) {
      const s = wordSign(clean)!
      tokens.push({ label: s.gloss, kind: "word", sign: s })
      continue
    }

    // Fingerspell the word letter by letter.
    for (const ch of clean) {
      if (!isFingerspellable(ch)) continue
      const s = letterSign(ch)
      if (s) tokens.push({ label: ch.toUpperCase(), kind: "letter", sign: s })
    }
  }

  return tokens
}
