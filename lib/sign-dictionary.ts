// Dictionary-based sign player data. Each known word/phrase maps to an
// illustration and a short description of how the sign is performed.

export interface SignEntry {
  word: string
  image: string
  description: string
  aliases?: string[]
}

export const SIGN_DICTIONARY: SignEntry[] = [
  {
    word: 'hello',
    image: '/signs/hello.png',
    description: 'Flat hand near forehead, moving outward in a small salute.',
    aliases: ['hi', 'hey'],
  },
  {
    word: 'thank you',
    image: '/signs/thank-you.png',
    description: 'Flat hand at the chin, moving forward and down.',
    aliases: ['thanks', 'thankyou'],
  },
  {
    word: 'yes',
    image: '/signs/yes.png',
    description: 'A closed fist nodding up and down, like a head nod.',
    aliases: ['yeah', 'yep'],
  },
  {
    word: 'no',
    image: '/signs/no.png',
    description: 'Index and middle finger snapping closed against the thumb.',
    aliases: ['nope'],
  },
  {
    word: 'i love you',
    image: '/signs/i-love-you.png',
    description: 'Thumb, index, and pinky extended — the ILY handshape.',
    aliases: ['love'],
  },
  {
    word: 'please',
    image: '/signs/please.png',
    description: 'Flat hand rubbing a circle on the chest.',
  },
]

const lookup = new Map<string, SignEntry>()
for (const entry of SIGN_DICTIONARY) {
  lookup.set(entry.word, entry)
  for (const alias of entry.aliases ?? []) lookup.set(alias, entry)
}

export interface SignSequenceItem {
  type: 'sign' | 'fingerspell'
  word: string
  entry?: SignEntry
}

/**
 * Convert a spoken transcript into a sequence of sign cards.
 * Known words/phrases map to dictionary signs; unknown words are
 * fingerspelled letter by letter.
 */
export function transcriptToSigns(transcript: string): SignSequenceItem[] {
  const cleaned = transcript
    .toLowerCase()
    .replace(/[^a-z\s']/g, '')
    .trim()
  if (!cleaned) return []

  const words = cleaned.split(/\s+/)
  const result: SignSequenceItem[] = []
  let i = 0

  while (i < words.length) {
    // Greedy multi-word phrase match (up to 3 words, e.g. "i love you")
    let matched = false
    for (let len = 3; len >= 1; len--) {
      if (i + len > words.length) continue
      const phrase = words.slice(i, i + len).join(' ')
      const entry = lookup.get(phrase)
      if (entry) {
        result.push({ type: 'sign', word: entry.word, entry })
        i += len
        matched = true
        break
      }
    }
    if (!matched) {
      result.push({ type: 'fingerspell', word: words[i] })
      i += 1
    }
  }

  return result
}
