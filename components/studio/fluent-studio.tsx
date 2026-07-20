"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Hand, Mic, MicOff, Play, Square, Type } from "lucide-react"
import { PosePlayer } from "@/lib/sign/pose-player"
import { buildSignSequence, KNOWN_WORDS, type SignToken } from "@/lib/sign"
import { StageView } from "./stage-view"

const QUICK_PHRASES = [
  "Hello",
  "Thank you",
  "How are you",
  "Nice to meet you",
  "I love you",
  "Please help me",
  "What is your name",
  "Good morning",
]

const SPEEDS = [
  { label: "0.5×", value: 0.5 },
  { label: "0.75×", value: 0.75 },
  { label: "1×", value: 1 },
  { label: "1.5×", value: 1.5 },
]

export function FluentStudio() {
  // One PosePlayer instance shared with the render loop inside the stage.
  const playerRef = useRef<PosePlayer | null>(null)
  if (!playerRef.current) playerRef.current = new PosePlayer()

  const [text, setText] = useState("Hello, nice to meet you")
  const [tokens, setTokens] = useState<SignToken[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)

  const [listening, setListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const recognitionRef = useRef<any>(null)

  // Preview of how the current text will be broken into signs.
  const preview = useMemo(() => buildSignSequence(text), [text])

  useEffect(() => {
    playerRef.current!.speed = speed
  }, [speed])

  const handleProgress = useCallback((_label: string, index: number) => {
    setActiveIndex(index)
  }, [])

  useEffect(() => {
    const player = playerRef.current!
    player.onDone = () => {
      setIsPlaying(false)
      setActiveIndex(-1)
    }
    return () => {
      player.onDone = undefined
    }
  }, [])

  const play = useCallback(
    (input?: string) => {
      const source = input ?? text
      const seq = buildSignSequence(source)
      if (seq.length === 0) return
      setTokens(seq)
      setActiveIndex(0)
      setIsPlaying(true)
      playerRef.current!.speed = speed
      playerRef.current!.load(seq)
    },
    [text, speed],
  )

  const stop = useCallback(() => {
    playerRef.current!.stop()
    setIsPlaying(false)
    setActiveIndex(-1)
  }, [])

  // ---- Voice input (Web Speech API) ----
  useEffect(() => {
    if (typeof window === "undefined") return
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    setVoiceSupported(true)
    const rec = new SR()
    rec.continuous = false
    rec.interimResults = true
    rec.lang = "en-US"
    rec.onresult = (e: any) => {
      let transcript = ""
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript
      }
      setText(transcript)
      if (e.results[e.results.length - 1].isFinal) {
        play(transcript)
      }
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recognitionRef.current = rec
    return () => {
      rec.onresult = null
      rec.onend = null
      rec.onerror = null
      try {
        rec.abort()
      } catch {
        /* noop */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleMic = useCallback(() => {
    const rec = recognitionRef.current
    if (!rec) return
    if (listening) {
      rec.stop()
      setListening(false)
    } else {
      setText("")
      try {
        rec.start()
        setListening(true)
      } catch {
        /* already started */
      }
    }
  }, [listening])

  const onTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      if (e.nativeEvent.isComposing || e.keyCode === 229) return
      e.preventDefault()
      play()
    }
  }

  const activeToken = activeIndex >= 0 ? tokens[activeIndex] : undefined
  const displayTokens = isPlaying || tokens.length ? tokens : preview

  return (
    <main className="min-h-screen">
      <header className="border-b border-line bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-coral text-surface shadow-soft">
              <Hand className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="leading-tight">
              <p className="font-display text-lg font-semibold tracking-tight text-ink">Fluent</p>
              <p className="text-xs text-ink-faint">Sign language studio</p>
            </div>
          </div>
          <a
            href="#vocabulary"
            className="rounded-full border border-line px-3 py-1.5 text-sm text-ink-soft transition-colors hover:bg-surface-2"
          >
            {KNOWN_WORDS.length} signs
          </a>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* Input panel */}
        <section className="flex flex-col gap-5">
          <div className="rounded-lg border border-line bg-surface p-4 shadow-soft sm:p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-ink-soft">
              <Type className="h-4 w-4" aria-hidden="true" />
              <span>Type or speak — the signer translates it</span>
            </div>

            <label htmlFor="fluent-input" className="sr-only">
              Text to translate into sign language
            </label>
            <textarea
              id="fluent-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onTextareaKeyDown}
              rows={3}
              placeholder="Say hello…"
              className="w-full resize-none rounded-md border border-line bg-surface-2 px-3.5 py-3 font-sans text-lg text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-coral"
            />

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {!isPlaying ? (
                <button
                  type="button"
                  onClick={() => play()}
                  disabled={preview.length === 0}
                  className="inline-flex items-center gap-2 rounded-full bg-coral px-4 py-2 text-sm font-semibold text-surface shadow-soft transition-colors hover:bg-coral-deep disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Play className="h-4 w-4" aria-hidden="true" />
                  Translate
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stop}
                  className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-surface shadow-soft transition-colors hover:bg-ink-soft"
                >
                  <Square className="h-4 w-4" aria-hidden="true" />
                  Stop
                </button>
              )}

              {voiceSupported && (
                <button
                  type="button"
                  onClick={toggleMic}
                  aria-pressed={listening}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                    listening
                      ? "border-violet bg-violet-wash text-violet"
                      : "border-line bg-surface text-ink-soft hover:bg-surface-2"
                  }`}
                >
                  {listening ? (
                    <>
                      <Mic className="h-4 w-4 animate-fluent-pulse" aria-hidden="true" />
                      Listening…
                    </>
                  ) : (
                    <>
                      <MicOff className="h-4 w-4" aria-hidden="true" />
                      Speak
                    </>
                  )}
                </button>
              )}

              <span className="ml-auto hidden text-xs text-ink-faint sm:inline">⌘/Ctrl + Enter</span>
            </div>

            {/* Speed */}
            <div className="mt-4 flex items-center gap-2 border-t border-line-soft pt-4">
              <span className="text-xs font-medium text-ink-faint">Speed</span>
              <div className="flex gap-1">
                {SPEEDS.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSpeed(s.value)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                      speed === s.value
                        ? "bg-ink text-surface"
                        : "bg-surface-2 text-ink-soft hover:bg-line-soft"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quick phrases */}
          <div className="rounded-lg border border-line bg-surface p-4 shadow-soft sm:p-5">
            <p className="mb-3 text-sm font-medium text-ink-soft">Quick phrases</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_PHRASES.map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  onClick={() => {
                    setText(phrase)
                    play(phrase)
                  }}
                  className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink transition-colors hover:border-coral hover:text-coral-deep"
                >
                  {phrase}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Stage panel */}
        <section className="flex flex-col gap-4">
          <div className="relative aspect-[4/5] overflow-hidden rounded-lg border border-stage-line bg-stage shadow-stage sm:aspect-[5/4]">
            <StageView playerRef={playerRef as React.MutableRefObject<PosePlayer>} onProgress={handleProgress} />

            {/* Now-signing overlay */}
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
              <span className="rounded-full bg-stage-2/80 px-3 py-1 text-xs font-medium text-stage-txt backdrop-blur">
                {isPlaying ? "Signing" : "Ready"}
              </span>
              {activeToken && (
                <span className="animate-rise rounded-full bg-coral px-3 py-1 text-sm font-semibold text-surface">
                  {activeToken.kind === "letter" ? `Letter ${activeToken.label}` : activeToken.label}
                </span>
              )}
            </div>

            <p className="pointer-events-none absolute bottom-3 left-4 text-xs text-stage-txt/50">
              Drag to rotate · scroll to zoom
            </p>
          </div>

          {/* Caption / token strip */}
          <div className="min-h-[4.5rem] rounded-lg border border-line bg-surface p-4 shadow-soft">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">Sign breakdown</p>
            {displayTokens.length === 0 ? (
              <p className="text-sm text-ink-faint">Enter some text to see how it maps to signs.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {displayTokens.map((t, i) => (
                  <span
                    key={`${t.label}-${i}`}
                    className={`rounded-md px-2 py-1 text-sm transition-colors ${
                      i === activeIndex
                        ? "bg-coral text-surface"
                        : t.kind === "word"
                          ? "bg-surface-2 text-ink"
                          : "bg-surface-2 text-ink-soft"
                    }`}
                  >
                    {t.label}
                    {t.kind === "letter" && (
                      <span className="ml-1 text-[10px] uppercase opacity-50">spell</span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Vocabulary */}
      <section id="vocabulary" className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <div className="rounded-lg border border-line bg-surface p-4 shadow-soft sm:p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-semibold text-ink">Known signs</h2>
              <p className="text-sm text-ink-soft">
                Tap a word to translate it. Anything outside this list is fingerspelled letter by letter.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {KNOWN_WORDS.map((word) => (
              <button
                key={word}
                type="button"
                onClick={() => {
                  const label = word.toLowerCase()
                  setText(label)
                  play(label)
                }}
                className="rounded-md border border-line bg-surface-2 px-2.5 py-1 text-sm font-medium text-ink-soft transition-colors hover:border-coral hover:text-coral-deep"
              >
                {word}
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
