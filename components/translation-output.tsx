'use client'

import { useCallback, useState } from 'react'
import { Trash2, Volume2, VolumeX, Type } from 'lucide-react'
import { SUPPORTED_SIGNS } from '@/lib/gesture-classifier'
import { cn } from '@/lib/utils'

interface TranslationOutputProps {
  transcript: string[]
  onClear: () => void
}

export function TranslationOutput({ transcript, onClear }: TranslationOutputProps) {
  const [speaking, setSpeaking] = useState(false)

  const speak = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    const text = transcript.join('. ')
    if (!text) return
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.95
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    setSpeaking(true)
  }, [speaking, transcript])

  return (
    <section
      aria-label="Recognized sign translation output"
      className="flex flex-col overflow-hidden rounded-lg border bg-card"
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Type className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold">Recognized Text</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={speak}
            disabled={transcript.length === 0}
            aria-label={speaking ? 'Stop reading aloud' : 'Read translation aloud'}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
              speaking
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground hover:bg-border',
              transcript.length === 0 && 'opacity-40'
            )}
          >
            {speaking ? (
              <VolumeX className="size-3.5" aria-hidden="true" />
            ) : (
              <Volume2 className="size-3.5" aria-hidden="true" />
            )}
            {speaking ? 'Stop' : 'Speak'}
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={transcript.length === 0}
            aria-label="Clear translation"
            className={cn(
              'flex items-center rounded-md bg-muted p-1.5 text-muted-foreground transition-colors hover:bg-border hover:text-foreground',
              transcript.length === 0 && 'opacity-40'
            )}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="min-h-24 p-4" aria-live="polite">
        {transcript.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {transcript.map((sign, i) => (
              <span
                key={`${sign}-${i}`}
                className={cn(
                  'rounded-md border px-3 py-1.5 font-mono text-sm',
                  i === transcript.length - 1
                    ? 'border-primary/50 bg-primary/10 text-primary'
                    : 'border-border bg-muted text-foreground'
                )}
              >
                {sign}
              </span>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <p className="text-xs text-muted-foreground">
              Recognized signs appear here. Try these signs:
            </p>
            <ul className="flex flex-col gap-1.5">
              {SUPPORTED_SIGNS.map((s) => (
                <li key={s.sign} className="flex items-baseline gap-2 text-xs">
                  <span className="w-20 shrink-0 font-mono font-semibold text-primary">
                    {s.sign}
                  </span>
                  <span className="text-muted-foreground">{s.hint}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
