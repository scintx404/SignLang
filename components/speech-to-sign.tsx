'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Hand, Mic, Send } from 'lucide-react'
import { transcriptToSigns, type SignSequenceItem } from '@/lib/sign-dictionary'
import { SignPlayer } from '@/components/sign-player'
import { cn } from '@/lib/utils'

type SpeechStatus = 'idle' | 'listening' | 'unsupported' | 'error'

export function SpeechToSign() {
  const recognitionRef = useRef<any>(null)
  const holdingRef = useRef(false)

  const [status, setStatus] = useState<SpeechStatus>('idle')
  const [interim, setInterim] = useState('')
  const [transcript, setTranscript] = useState('')
  const [sequence, setSequence] = useState<SignSequenceItem[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [typed, setTyped] = useState('')

  useEffect(() => {
    const SR =
      typeof window !== 'undefined' &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    if (!SR) {
      setStatus('unsupported')
      return
    }

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: any) => {
      let finalText = ''
      let interimText = ''
      for (let i = 0; i < event.results.length; i++) {
        const res = event.results[i]
        if (res.isFinal) finalText += res[0].transcript
        else interimText += res[0].transcript
      }
      setInterim(interimText)
      if (finalText) setTranscript(finalText.trim())
    }

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        setErrorMsg('Microphone permission denied. Allow mic access and try again.')
        setStatus('error')
      } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
        setErrorMsg('Speech recognition error. Please try again.')
        setStatus('error')
      }
    }

    recognition.onend = () => {
      // If user is still holding, Chrome sometimes auto-stops; restart
      if (holdingRef.current) {
        try {
          recognition.start()
        } catch {
          /* already started */
        }
      } else {
        setStatus((s) => (s === 'listening' ? 'idle' : s))
      }
    }

    recognitionRef.current = recognition
    return () => {
      holdingRef.current = false
      try {
        recognition.abort()
      } catch {
        /* noop */
      }
    }
  }, [])

  // When a final transcript lands after release, build the sign sequence
  useEffect(() => {
    if (transcript) {
      setSequence(transcriptToSigns(transcript))
    }
  }, [transcript])

  const startListening = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition || status === 'unsupported') return
    holdingRef.current = true
    setErrorMsg(null)
    setInterim('')
    setTranscript('')
    setSequence([])
    try {
      recognition.start()
      setStatus('listening')
    } catch {
      /* already started */
    }
  }, [status])

  const stopListening = useCallback(() => {
    holdingRef.current = false
    const recognition = recognitionRef.current
    if (!recognition) return
    try {
      recognition.stop()
    } catch {
      /* noop */
    }
    setStatus((s) => (s === 'listening' ? 'idle' : s))
  }, [])

  const listening = status === 'listening'

  return (
    <section
      aria-label="Speech to sign language translation"
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card"
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Hand className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold">Speech-to-Sign</h2>
        </div>
        {listening && (
          <span className="flex items-center gap-1.5 text-xs text-destructive">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-destructive" />
            </span>
            Listening...
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
        {/* Sign player area */}
        <div className="min-h-0 flex-1">
          <SignPlayer sequence={sequence} />
        </div>

        {/* Live/final transcript */}
        {(interim || transcript) && (
          <p className="shrink-0 truncate rounded-md bg-muted px-3 py-2 text-sm" aria-live="polite">
            <span className="text-foreground">{transcript}</span>
            {interim && <span className="text-muted-foreground"> {interim}</span>}
          </p>
        )}

        {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}
        {status === 'unsupported' && (
          <p className="text-xs text-muted-foreground">
            Speech recognition is not supported in this browser — type a phrase below instead.
          </p>
        )}

        {/* Controls: hold-to-speak mic + type-to-sign input on one row */}
        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            disabled={status === 'unsupported'}
            onPointerDown={(e) => {
              e.preventDefault()
              startListening()
            }}
            onPointerUp={stopListening}
            onPointerLeave={() => holdingRef.current && stopListening()}
            onKeyDown={(e) => {
              if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                e.preventDefault()
                startListening()
              }
            }}
            onKeyUp={(e) => {
              if (e.key === ' ' || e.key === 'Enter') stopListening()
            }}
            aria-pressed={listening}
            title={listening ? 'Release to translate' : 'Hold to speak'}
            className={cn(
              'flex size-11 shrink-0 touch-none select-none items-center justify-center rounded-full transition-all',
              listening
                ? 'pulse-ring-red scale-110 bg-destructive text-destructive-foreground'
                : 'pulse-ring bg-primary text-primary-foreground hover:bg-primary/90',
              status === 'unsupported' && 'opacity-40'
            )}
          >
            <Mic className="size-5" aria-hidden="true" />
            <span className="sr-only">Hold to speak</span>
          </button>

          <form
            className="flex min-w-0 flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const value = typed.trim()
              if (!value) return
              setTranscript(value)
              setInterim('')
              setTyped('')
            }}
          >
            <label htmlFor="type-to-sign" className="sr-only">
              Type a phrase to translate to sign language
            </label>
            <input
              id="type-to-sign"
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={listening ? 'Release to translate...' : 'Hold mic to speak, or type a phrase'}
              className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button
              type="submit"
              disabled={!typed.trim()}
              className={cn(
                'flex items-center gap-1.5 rounded-md bg-muted px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-border',
                !typed.trim() && 'opacity-40'
              )}
            >
              <Send className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Sign it</span>
              <span className="sr-only sm:hidden">Sign it</span>
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
