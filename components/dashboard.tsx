'use client'

import { useCallback, useState } from 'react'
import { WebcamPanel } from '@/components/webcam-panel'
import { TranslationOutput } from '@/components/translation-output'
import { SpeechToSign } from '@/components/speech-to-sign'

export function Dashboard() {
  const [transcript, setTranscript] = useState<string[]>([])

  const handleSignRecognized = useCallback((sign: string) => {
    setTranscript((prev) => {
      // Avoid immediate duplicates
      if (prev[prev.length - 1] === sign) return prev
      return [...prev, sign].slice(-24)
    })
  }, [])

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6 lg:flex-row">
      {/* Left: webcam feed */}
      <div className="min-h-[420px] lg:min-h-0 lg:flex-[3]">
        <WebcamPanel onSignRecognized={handleSignRecognized} />
      </div>

      {/* Right: outputs and controls */}
      <div className="flex min-h-0 flex-col gap-4 lg:flex-[2]">
        <TranslationOutput transcript={transcript} onClear={() => setTranscript([])} />
        <SpeechToSign />
      </div>
    </main>
  )
}
