'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { SiteHeader } from '@/components/site-header'
import { WebcamPanel, type TrackerStatus } from '@/components/webcam-panel'
import { SignPlayer } from '@/components/sign-player'
import { ControlBar } from '@/components/control-bar'
import { TranslationPanel } from '@/components/translation-panel'
import { useSpeechRecognition } from '@/hooks/use-speech-recognition'
import { transcriptToSigns, type SignSequenceItem } from '@/lib/sign-dictionary'

export type Mode = 'sign' | 'speech'

export interface TranscriptEntry {
  id: string
  speaker: 'signer' | 'voice'
  text: string
  time: string
  confidence?: number
  glosses?: string[]
}

const PHRASE_FINALIZE_MS = 3000

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

let entryCounter = 0
function nextId() {
  entryCounter += 1
  return `entry-${entryCounter}-${Date.now()}`
}

export function Dashboard() {
  const [mode, setMode] = useState<Mode>('sign')
  const [entries, setEntries] = useState<TranscriptEntry[]>([])

  // --- Sign → Speech state ---
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraStatus, setCameraStatus] = useState<TrackerStatus>('idle')
  const [liveText, setLiveText] = useState('')
  const pendingRef = useRef<{ signs: string[]; confs: number[] }>({ signs: [], confs: [] })
  const finalizeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // --- Speech → Sign state ---
  const [sequence, setSequence] = useState<SignSequenceItem[]>([])
  const [typed, setTyped] = useState('')

  const speakText = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.95
    window.speechSynthesis.speak(utterance)
  }, [])

  const finalizePhrase = useCallback(() => {
    clearTimeout(finalizeTimerRef.current)
    const pending = pendingRef.current
    if (pending.signs.length === 0) return

    const text = pending.signs.join(', ')
    const confidence =
      pending.confs.reduce((sum, c) => sum + c, 0) / Math.max(pending.confs.length, 1)

    setEntries((prev) => [
      {
        id: nextId(),
        speaker: 'signer' as const,
        text,
        time: nowTime(),
        confidence,
        glosses: pending.signs.map((s) => s.toUpperCase()),
      },
      ...prev,
    ])
    speakText(text)

    pendingRef.current = { signs: [], confs: [] }
    setLiveText('')
  }, [speakText])

  const handleSignCommitted = useCallback(
    (sign: string, confidence: number) => {
      const pending = pendingRef.current
      // Avoid immediate duplicates within a phrase
      if (pending.signs[pending.signs.length - 1] !== sign) {
        pending.signs.push(sign)
        pending.confs.push(confidence)
        setLiveText(pending.signs.join(', '))
      }
      clearTimeout(finalizeTimerRef.current)
      finalizeTimerRef.current = setTimeout(finalizePhrase, PHRASE_FINALIZE_MS)
    },
    [finalizePhrase]
  )

  const handleCameraActiveChange = useCallback(
    (active: boolean) => {
      setCameraActive(active)
      if (!active) finalizePhrase()
    },
    [finalizePhrase]
  )

  // --- Speech recognition ---
  const handleSpokenPhrase = useCallback((text: string) => {
    setSequence(transcriptToSigns(text))
    setEntries((prev) => [
      { id: nextId(), speaker: 'voice' as const, text, time: nowTime() },
      ...prev,
    ])
  }, [])

  const speech = useSpeechRecognition({ onFinal: handleSpokenPhrase })

  const handleModeChange = useCallback(
    (next: Mode) => {
      if (next === mode) return
      // Wind down whatever the previous mode was doing
      if (mode === 'sign') {
        finalizePhrase()
        setCameraActive(false)
      } else {
        speech.stop()
      }
      setMode(next)
    },
    [mode, finalizePhrase, speech]
  )

  const handleSubmitTyped = useCallback(() => {
    const value = typed.trim()
    if (!value) return
    handleSpokenPhrase(value)
    setTyped('')
  }, [typed, handleSpokenPhrase])

  useEffect(() => {
    return () => clearTimeout(finalizeTimerRef.current)
  }, [])

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <SiteHeader mode={mode} cameraLive={cameraActive} listening={speech.listening} />

      <main className="grid min-h-0 flex-1 gap-4 p-4 md:p-5 lg:grid-cols-[1.6fr_1fr] lg:overflow-hidden">
        {/* Left: stage + floating controls */}
        <div className="flex min-h-0 flex-col gap-3">
          <div className="min-h-[340px] flex-1 sm:min-h-[420px] lg:min-h-0">
            {mode === 'sign' ? (
              <WebcamPanel
                active={cameraActive}
                onActiveChange={handleCameraActiveChange}
                onStatusChange={setCameraStatus}
                onSignCommitted={handleSignCommitted}
              />
            ) : (
              <SignPlayer
                sequence={sequence}
                listening={speech.listening}
                interim={speech.interim}
              />
            )}
          </div>

          <ControlBar
            mode={mode}
            onModeChange={handleModeChange}
            cameraActive={cameraActive}
            cameraLoading={cameraStatus === 'loading'}
            onToggleCamera={() => handleCameraActiveChange(!cameraActive)}
            speechSupported={speech.status !== 'unsupported'}
            listening={speech.listening}
            onMicDown={speech.start}
            onMicUp={speech.stop}
            typed={typed}
            onTypedChange={setTyped}
            onSubmitTyped={handleSubmitTyped}
          />

          {mode === 'speech' && speech.error && (
            <p className="px-1 text-xs text-destructive animate-fade-in">{speech.error}</p>
          )}
          {mode === 'speech' && speech.status === 'unsupported' && (
            <p className="px-1 text-xs text-muted-foreground animate-fade-in">
              Speech recognition is not supported in this browser — type a phrase instead.
            </p>
          )}
        </div>

        {/* Right: translation feed */}
        <div className="flex min-h-[360px] flex-col lg:min-h-0">
          <TranslationPanel
            mode={mode}
            entries={entries}
            liveText={mode === 'sign' ? liveText : ''}
            onClear={() => setEntries([])}
          />
        </div>
      </main>
    </div>
  )
}
