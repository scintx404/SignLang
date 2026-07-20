'use client'

import { useCallback, useState } from 'react'
import { ArrowRight, Check, Trash2, Volume2 } from 'lucide-react'
import { SUPPORTED_SIGNS } from '@/lib/gesture-classifier'
import { cn } from '@/lib/utils'
import type { Mode, TranscriptEntry } from '@/components/dashboard'

interface TranslationPanelProps {
  mode: Mode
  entries: TranscriptEntry[]
  liveText: string
  onClear: () => void
}

function SpeakerTag({ speaker }: { speaker: TranscriptEntry['speaker'] }) {
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        speaker === 'signer'
          ? 'bg-accent text-accent-foreground'
          : 'bg-muted text-muted-foreground'
      )}
    >
      {speaker === 'signer' ? 'Signer' : 'Voice'}
    </span>
  )
}

export function TranslationPanel({ mode, entries, liveText, onClear }: TranslationPanelProps) {
  const [speakingId, setSpeakingId] = useState<string | null>(null)

  const speakEntry = useCallback((entry: TranscriptEntry) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(entry.text)
    utterance.rate = 0.95
    utterance.onend = () => setSpeakingId(null)
    utterance.onerror = () => setSpeakingId(null)
    setSpeakingId(entry.id)
    window.speechSynthesis.speak(utterance)
  }, [])

  const isEmpty = entries.length === 0 && !liveText

  return (
    <section
      aria-label="Translation transcript"
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_-12px_rgb(0_0_0/0.12)]"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-5 py-4">
        <h2 className="text-base font-bold tracking-tight">Translation</h2>
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground">
            <ArrowRight className="size-3" aria-hidden="true" />
            {mode === 'sign' ? 'ASL to spoken English' : 'English to ASL'}
          </span>
          {entries.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear transcript"
              className="flex items-center rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Live interpreting strip */}
      {liveText && (
        <div className="shrink-0 border-b bg-muted/50 px-5 py-4 animate-fade-in" aria-live="polite">
          <div className="flex items-center gap-2">
            <SpeakerTag speaker="signer" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Interpreting live
            </span>
          </div>
          <p className="mt-2 text-pretty text-2xl font-semibold leading-snug tracking-tight">
            {liveText}
            <span className="animate-caret ml-0.5 inline-block h-6 w-0.5 translate-y-1 rounded-full bg-primary" />
          </p>
        </div>
      )}

      {/* Feed */}
      <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        {isEmpty ? (
          <div className="flex flex-col gap-4 p-5">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {mode === 'sign'
                ? 'Start the camera and sign — the interpretation appears here. Try these signs:'
                : 'Hold the mic and speak, or type a phrase — everything you say appears here and is performed in the sign player.'}
            </p>
            {mode === 'sign' && (
              <ul className="flex flex-col gap-2">
                {SUPPORTED_SIGNS.map((s, i) => (
                  <li
                    key={s.sign}
                    className="flex items-center gap-3 rounded-md border bg-background px-3.5 py-2.5 animate-fade-up"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
                      {s.sign}
                    </span>
                    <span className="text-xs leading-relaxed text-muted-foreground">{s.hint}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <ul className="flex flex-col">
            {entries.map((entry) => (
              <li key={entry.id} className="border-b px-5 py-4 last:border-b-0 animate-fade-up">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <SpeakerTag speaker={entry.speaker} />
                    <span className="text-xs text-muted-foreground">{entry.time}</span>
                  </div>
                  {entry.confidence != null && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Check className="size-3.5" aria-hidden="true" />
                      {Math.round(entry.confidence * 100)}%
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => speakEntry(entry)}
                    aria-label={`Read aloud: ${entry.text}`}
                    className={cn(
                      'mt-0.5 shrink-0 rounded-full p-1 transition-colors',
                      speakingId === entry.id
                        ? 'text-primary'
                        : 'text-muted-foreground hover:text-primary'
                    )}
                  >
                    <Volume2 className="size-4" aria-hidden="true" />
                  </button>
                  <p className="text-pretty text-base font-medium leading-relaxed">{entry.text}</p>
                </div>
                {entry.glosses && entry.glosses.length > 0 && (
                  <p className="mt-1.5 pl-8 text-xs tracking-wide text-muted-foreground">
                    Recognized: {entry.glosses.join(' · ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
