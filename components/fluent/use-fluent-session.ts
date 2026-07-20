"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { PosePlayer } from "@/lib/sign/pose-player"
import { buildSignSequence, KNOWN_WORDS, type SignToken } from "@/lib/sign"

// Input method. "voice" = speak (Web Speech API), "text" = type.
export type Mode = "voice" | "text"
export type SessionState = "idle" | "connecting" | "live" | "ended"

export interface TranscriptLine {
  id: number
  time: string
  text: string
  glosses: string[]
}

export interface GlossChip {
  label: string
  on: boolean
}

export const SPEEDS = [
  { label: "0.5×", value: 0.5 },
  { label: "0.75×", value: 0.75 },
  { label: "1×", value: 1 },
  { label: "1.5×", value: 1.5 },
]

export const QUICK_PHRASES = ["Hello", "Thank you", "How are you", "Nice to meet you", "Please help me", "Good morning"]

function nowStamp() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export function useFluentSession() {
  // A single PosePlayer instance shared with the 3D avatar's render loop.
  const playerRef = useRef<PosePlayer | null>(null)
  if (!playerRef.current) playerRef.current = new PosePlayer()

  const [mode, setMode] = useState<Mode>("text")
  const [state, setState] = useState<SessionState>("idle")
  const [text, setText] = useState("")
  const [speed, setSpeed] = useState(1)

  // What the signer is currently producing.
  const [detect, setDetect] = useState<{ gloss: string; index: number; total: number }>({
    gloss: "—",
    index: 0,
    total: 0,
  })
  const [isSigning, setIsSigning] = useState(false)
  const [live, setLive] = useState<{ text: string; cursor: boolean }>({ text: "", cursor: false })
  const [glossRow, setGlossRow] = useState<GlossChip[]>([])
  const [transcript, setTranscript] = useState<TranscriptLine[]>([])
  const [stats, setStats] = useState({ words: 0, signs: 0 })

  const [listening, setListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const recognitionRef = useRef<any>(null)

  const stateRef = useRef<SessionState>("idle")
  const connectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lineId = useRef(0)
  const statsRef = useRef({ words: 0, signs: 0 })
  const pendingRef = useRef<{ text: string; tokens: SignToken[] } | null>(null)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    playerRef.current!.speed = speed
  }, [speed])

  // Preview of how the current input maps to signs (before playing).
  const preview = useMemo(() => buildSignSequence(text), [text])

  // Progress + completion wiring for the shared PosePlayer.
  const handleProgress = useCallback((label: string, index: number, total: number) => {
    setDetect({ gloss: label, index: index + 1, total })
    setGlossRow((prev) => prev.map((g, i) => ({ ...g, on: i <= index })))
  }, [])

  useEffect(() => {
    const player = playerRef.current!
    player.onDone = () => {
      setIsSigning(false)
      setLive((l) => ({ ...l, cursor: false }))
      const done = pendingRef.current
      if (done) {
        setTranscript((prev) => [
          ...prev,
          { id: lineId.current++, time: nowStamp(), text: done.text, glosses: done.tokens.map((t) => t.label) },
        ])
        statsRef.current = {
          words: statsRef.current.words + done.text.trim().split(/\s+/).filter(Boolean).length,
          signs: statsRef.current.signs + done.tokens.length,
        }
        setStats({ ...statsRef.current })
        pendingRef.current = null
      }
      setDetect({ gloss: "—", index: 0, total: 0 })
    }
    return () => {
      player.onDone = undefined
    }
  }, [])

  // Translate a phrase: build the sign sequence and drive the avatar.
  const submit = useCallback(
    (input?: string) => {
      const source = (input ?? text).trim()
      if (!source) return
      const tokens = buildSignSequence(source)
      if (tokens.length === 0) return

      pendingRef.current = { text: source, tokens }
      setLive({ text: source, cursor: true })
      setGlossRow(tokens.map((t) => ({ label: t.label, on: false })))
      setDetect({ gloss: tokens[0].label, index: 1, total: tokens.length })
      setIsSigning(true)

      const player = playerRef.current!
      player.speed = speed
      player.load(tokens)
    },
    [text, speed],
  )

  const start = useCallback(() => {
    if (stateRef.current === "live") return
    setState("connecting")
    connectTimer.current = setTimeout(() => setState("live"), 700)
  }, [])

  const stopSigning = useCallback(() => {
    playerRef.current!.stop()
    pendingRef.current = null
    setIsSigning(false)
    setLive({ text: "", cursor: false })
    setGlossRow([])
    setDetect({ gloss: "—", index: 0, total: 0 })
  }, [])

  const end = useCallback(() => {
    if (connectTimer.current) clearTimeout(connectTimer.current)
    const rec = recognitionRef.current
    if (rec && listening) {
      try {
        rec.stop()
      } catch {
        /* noop */
      }
    }
    setListening(false)
    stopSigning()
    setState("ended")
  }, [listening, stopSigning])

  const switchMode = useCallback(
    (next: Mode) => {
      if (next === mode) return
      if (mode === "voice" && listening) {
        const rec = recognitionRef.current
        try {
          rec?.stop()
        } catch {
          /* noop */
        }
        setListening(false)
      }
      setMode(next)
    },
    [mode, listening],
  )

  // ---- Real voice input via the Web Speech API ----
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
      let transcriptText = ""
      for (let i = 0; i < e.results.length; i++) transcriptText += e.results[i][0].transcript
      setText(transcriptText)
      if (e.results[e.results.length - 1].isFinal) submit(transcriptText)
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

  // Speak an English line back using the browser's speech synthesis.
  const speak = useCallback((value: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(value))
  }, [])

  return {
    playerRef: playerRef as React.MutableRefObject<PosePlayer>,
    handleProgress,
    mode,
    state,
    text,
    setText,
    speed,
    setSpeed,
    preview,
    detect,
    isSigning,
    live,
    glossRow,
    transcript,
    stats,
    listening,
    voiceSupported,
    knownCount: KNOWN_WORDS.length,
    start,
    end,
    submit,
    stopSigning,
    switchMode,
    toggleMic,
    speak,
  }
}
