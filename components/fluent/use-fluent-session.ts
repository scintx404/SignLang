"use client"

import { useCallback, useRef, useState } from "react"
import { SIGN_SCRIPT, VOICE_SCRIPT, type ScriptEntry } from "@/lib/fluent/scripts"

export type Mode = "sign" | "voice"
export type SessionState = "idle" | "connecting" | "live" | "ended"

export interface TranscriptLine {
  id: number
  mode: Mode
  whoLabel: string
  time: string
  text: string
  glosses: string[]
  conf: number
}

export interface GlossChip {
  label: string
  on: boolean
}

function nowStamp() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export function useFluentSession() {
  const [mode, setMode] = useState<Mode>("sign")
  const [state, setState] = useState<SessionState>("idle")
  const [detect, setDetect] = useState<{ gloss: string; conf: number }>({ gloss: "—", conf: 0 })
  const [latency, setLatency] = useState(38)
  const [live, setLive] = useState<{ text: string; cursor: boolean }>({ text: "", cursor: false })
  const [glossRow, setGlossRow] = useState<GlossChip[]>([])
  const [transcript, setTranscript] = useState<TranscriptLine[]>([])
  const [stats, setStats] = useState({ words: 0, signs: 0 })
  const [camOff, setCamOff] = useState(false)
  const [micOff, setMicOff] = useState(false)

  const runningRef = useRef(false)
  const seqRef = useRef(0)
  const modeRef = useRef<Mode>("sign")
  const lineId = useRef(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const statsRef = useRef({ words: 0, signs: 0 })

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }, [])

  const wait = useCallback(
    (ms: number) =>
      new Promise<void>((res) => {
        timers.current.push(setTimeout(res, ms))
      }),
    [],
  )

  const commitLine = useCallback((entry: ScriptEntry, conf: number, activeMode: Mode) => {
    const line: TranscriptLine = {
      id: lineId.current++,
      mode: activeMode,
      whoLabel: activeMode === "sign" ? "Signer" : "Speaker",
      time: nowStamp(),
      text: entry.text,
      glosses: entry.glosses,
      conf,
    }
    setTranscript((prev) => [...prev, line])
    statsRef.current = {
      words: statsRef.current.words + entry.text.split(/\s+/).length,
      signs: statsRef.current.signs + entry.glosses.length,
    }
    setStats({ ...statsRef.current })
  }, [])

  const runScript = useCallback(
    async (seq: number) => {
      let i = 0
      while (runningRef.current && seq === seqRef.current) {
        const activeMode = modeRef.current
        const script = activeMode === "sign" ? SIGN_SCRIPT : VOICE_SCRIPT
        const entry = script[i % script.length]
        const words = entry.text.split(" ")
        const finalConf = 88 + Math.floor(Math.random() * 11)

        setLive({ text: "", cursor: true })
        if (activeMode === "voice") {
          setGlossRow(entry.glosses.map((g) => ({ label: g, on: false })))
        } else {
          setGlossRow([])
        }

        let built = ""
        for (let w = 0; w < words.length; w++) {
          if (!runningRef.current || seq !== seqRef.current) return
          const gi = Math.min(Math.floor((w / words.length) * entry.glosses.length), entry.glosses.length - 1)
          setDetect({ gloss: entry.glosses[gi], conf: 80 + Math.floor(Math.random() * 18) })
          if (activeMode === "voice") {
            setGlossRow(entry.glosses.map((g, gIdx) => ({ label: g, on: gIdx <= gi })))
          }
          setLatency(34 + Math.floor(Math.random() * 16))
          built += (w ? " " : "") + words[w]
          setLive({ text: built, cursor: true })
          await wait(150 + Math.random() * 130)
        }
        if (!runningRef.current || seq !== seqRef.current) return

        setDetect({ gloss: entry.glosses[entry.glosses.length - 1], conf: finalConf })
        if (activeMode === "voice") {
          setGlossRow(entry.glosses.map((g) => ({ label: g, on: true })))
        }
        setLive({ text: built, cursor: false })
        await wait(650)

        commitLine(entry, finalConf, activeMode)
        i++
        await wait(1100)
      }
    },
    [wait, commitLine],
  )

  const start = useCallback(async () => {
    setState("connecting")
    await wait(1400)
    if (state === "live") return
    runningRef.current = true
    setState("live")
    seqRef.current++
    runScript(seqRef.current)
  }, [wait, runScript, state])

  const end = useCallback(() => {
    runningRef.current = false
    seqRef.current++
    clearTimers()
    setState("ended")
    setDetect({ gloss: "—", conf: 0 })
    setLive({ text: "", cursor: false })
    setGlossRow([])
  }, [clearTimers])

  const switchMode = useCallback(
    (next: Mode) => {
      if (modeRef.current === next) return
      modeRef.current = next
      setMode(next)
      if (runningRef.current) {
        seqRef.current++
        clearTimers()
        setLive({ text: "", cursor: true })
        setGlossRow([])
        setDetect({ gloss: "—", conf: 0 })
        runScript(seqRef.current)
      }
    },
    [clearTimers, runScript],
  )

  const toggleCam = useCallback(() => setCamOff((v) => !v), [])
  const toggleMic = useCallback(() => setMicOff((v) => !v), [])

  return {
    mode,
    state,
    detect,
    latency,
    live,
    glossRow,
    transcript,
    stats,
    camOff,
    micOff,
    start,
    end,
    switchMode,
    toggleCam,
    toggleMic,
  }
}
