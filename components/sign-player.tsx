'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Pause, Play, RotateCcw } from 'lucide-react'
import type { SignSequenceItem } from '@/lib/sign-dictionary'
import { cn } from '@/lib/utils'

interface SignPlayerProps {
  sequence: SignSequenceItem[]
}

const SIGN_DURATION_MS = 1800
const LETTER_DURATION_MS = 650

export function SignPlayer({ sequence }: SignPlayerProps) {
  const [index, setIndex] = useState(0)
  const [letterIndex, setLetterIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Reset when a new sequence arrives
  useEffect(() => {
    setIndex(0)
    setLetterIndex(0)
    setPlaying(true)
  }, [sequence])

  useEffect(() => {
    clearTimeout(timerRef.current)
    if (!playing || sequence.length === 0 || index >= sequence.length) return

    const current = sequence[index]

    if (current.type === 'fingerspell') {
      const letters = current.word.length
      if (letterIndex < letters - 1) {
        timerRef.current = setTimeout(() => setLetterIndex((l) => l + 1), LETTER_DURATION_MS)
      } else {
        timerRef.current = setTimeout(() => {
          setLetterIndex(0)
          setIndex((i) => i + 1)
        }, LETTER_DURATION_MS)
      }
    } else {
      timerRef.current = setTimeout(() => {
        setLetterIndex(0)
        setIndex((i) => i + 1)
      }, SIGN_DURATION_MS)
    }

    return () => clearTimeout(timerRef.current)
  }, [playing, sequence, index, letterIndex])

  const finished = sequence.length > 0 && index >= sequence.length
  const current = !finished && sequence.length > 0 ? sequence[index] : null

  if (sequence.length === 0) {
    return (
      <div className="flex h-full min-h-32 flex-col items-center justify-center gap-2 rounded-md border border-dashed p-6 text-center">
        <p className="text-sm font-medium">Sign player</p>
        <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
          Hold the microphone button and speak. Your words will be performed as sign cards —
          known phrases use dictionary signs, everything else is fingerspelled.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-32 flex-col gap-3 overflow-hidden">
      {/* Stage */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md border bg-background">
        {finished ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground">Playback complete</p>
            <button
              type="button"
              onClick={() => {
                setIndex(0)
                setLetterIndex(0)
                setPlaying(true)
              }}
              className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Replay
            </button>
          </div>
        ) : current?.type === 'sign' && current.entry ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-3">
            <div className="relative min-h-0 w-full flex-1">
              <Image
                src={current.entry.image || '/placeholder.svg'}
                alt={`Sign for ${current.entry.word}: ${current.entry.description}`}
                fill
                sizes="400px"
                className="rounded object-contain"
              />
            </div>
            <p className="font-mono text-lg font-semibold capitalize text-primary">
              {current.entry.word}
            </p>
            <p className="max-w-xs text-center text-xs text-muted-foreground">
              {current.entry.description}
            </p>
          </div>
        ) : current ? (
          <div className="flex flex-col items-center gap-3 p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Fingerspelling
            </p>
            <p className="font-mono text-6xl font-bold uppercase text-primary">
              {current.word[letterIndex]}
            </p>
            <div className="flex gap-1" aria-hidden="true">
              {current.word.split('').map((ch, i) => (
                <span
                  key={`${ch}-${i}`}
                  className={cn(
                    'font-mono text-sm uppercase',
                    i === letterIndex ? 'font-bold text-primary' : 'text-muted-foreground'
                  )}
                >
                  {ch}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {/* Pause/play */}
        {!finished && (
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? 'Pause sign playback' : 'Resume sign playback'}
            className="absolute right-2 top-2 rounded-md bg-muted/80 p-1.5 text-foreground backdrop-blur-sm hover:bg-muted"
          >
            {playing ? (
              <Pause className="size-3.5" aria-hidden="true" />
            ) : (
              <Play className="size-3.5" aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {/* Word timeline */}
      <div className="flex shrink-0 flex-wrap gap-1.5" aria-label="Sign sequence timeline">
        {sequence.map((item, i) => (
          <span
            key={`${item.word}-${i}`}
            className={cn(
              'rounded px-2 py-0.5 font-mono text-xs capitalize',
              i === index && !finished
                ? 'bg-primary text-primary-foreground'
                : i < index || finished
                  ? 'bg-muted text-muted-foreground line-through decoration-border'
                  : 'bg-muted text-foreground'
            )}
          >
            {item.word}
          </span>
        ))}
      </div>
    </div>
  )
}
