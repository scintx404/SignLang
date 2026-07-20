'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Hand, Pause, Play, RotateCcw } from 'lucide-react'
import type { SignSequenceItem } from '@/lib/sign-dictionary'
import { cn } from '@/lib/utils'

interface SignPlayerProps {
  sequence: SignSequenceItem[]
  listening?: boolean
  interim?: string
}

const SIGN_DURATION_MS = 1800
const LETTER_DURATION_MS = 650

export function SignPlayer({ sequence, listening = false, interim = '' }: SignPlayerProps) {
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

  return (
    <section
      aria-label="Sign language player"
      className="relative flex h-full flex-col overflow-hidden rounded-lg bg-stage shadow-[0_1px_2px_rgb(0_0_0/0.06),0_8px_32px_-12px_rgb(0_0_0/0.25)]"
    >
      {/* Listening indicator */}
      {listening && (
        <div className="absolute left-4 top-4 z-10 animate-fade-in">
          <span className="flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium text-stage-foreground backdrop-blur-md">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-70" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            Listening...
          </span>
        </div>
      )}

      {/* Stage */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
        {sequence.length === 0 ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-white/10">
              <Hand className="size-7 text-stage-foreground/60" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-stage-foreground">
                {listening ? 'Listening — release to translate' : 'Sign player'}
              </p>
              <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-stage-foreground/60">
                Hold the microphone and speak, or type a phrase. Known words are performed as
                dictionary signs — everything else is fingerspelled.
              </p>
            </div>
            {interim && (
              <p className="max-w-sm text-sm italic text-stage-foreground/80 animate-fade-in">
                &ldquo;{interim}&rdquo;
              </p>
            )}
          </div>
        ) : finished ? (
          <div className="flex flex-col items-center gap-4 animate-scale-in">
            <p className="text-sm text-stage-foreground/70">Playback complete</p>
            <button
              type="button"
              onClick={() => {
                setIndex(0)
                setLetterIndex(0)
                setPlaying(true)
              }}
              className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.03] active:scale-[0.98]"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Replay
            </button>
          </div>
        ) : current?.type === 'sign' && current.entry ? (
          <div
            key={`sign-${index}`}
            className="flex h-full w-full flex-col items-center justify-center gap-3 animate-scale-in"
          >
            <div className="relative min-h-0 w-full max-w-sm flex-1 overflow-hidden rounded-lg bg-white">
              <Image
                src={current.entry.image || '/placeholder.svg'}
                alt={`Sign for ${current.entry.word}: ${current.entry.description}`}
                fill
                sizes="400px"
                className="object-contain p-2"
              />
            </div>
            <p className="text-xl font-semibold capitalize text-stage-foreground">
              {current.entry.word}
            </p>
            <p className="max-w-xs text-center text-xs leading-relaxed text-stage-foreground/60">
              {current.entry.description}
            </p>
          </div>
        ) : current ? (
          <div key={`spell-${index}`} className="flex flex-col items-center gap-4 animate-scale-in">
            <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-stage-foreground/70">
              Fingerspelling
            </span>
            <p
              key={letterIndex}
              className="font-mono text-7xl font-bold uppercase text-stage-foreground animate-scale-in"
            >
              {current.word[letterIndex]}
            </p>
            <div className="flex gap-1.5" aria-hidden="true">
              {current.word.split('').map((ch, i) => (
                <span
                  key={`${ch}-${i}`}
                  className={cn(
                    'font-mono text-sm uppercase transition-colors duration-200',
                    i === letterIndex
                      ? 'font-bold text-primary'
                      : i < letterIndex
                        ? 'text-stage-foreground/40'
                        : 'text-stage-foreground/70'
                  )}
                >
                  {ch}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {/* Pause/play */}
        {!finished && sequence.length > 0 && (
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? 'Pause sign playback' : 'Resume sign playback'}
            className="absolute right-4 top-4 rounded-full bg-black/40 p-2.5 text-stage-foreground backdrop-blur-md transition-colors hover:bg-black/60"
          >
            {playing ? (
              <Pause className="size-4" aria-hidden="true" />
            ) : (
              <Play className="size-4" aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {/* Word timeline */}
      {sequence.length > 0 && (
        <div
          className="flex shrink-0 flex-wrap gap-1.5 px-4 pb-4"
          aria-label="Sign sequence timeline"
        >
          {sequence.map((item, i) => (
            <span
              key={`${item.word}-${i}`}
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-all duration-300',
                i === index && !finished
                  ? 'bg-primary text-primary-foreground'
                  : i < index || finished
                    ? 'bg-white/10 text-stage-foreground/40 line-through'
                    : 'bg-white/10 text-stage-foreground/80'
              )}
            >
              {item.word}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}
