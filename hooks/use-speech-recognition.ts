'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type SpeechStatus = 'idle' | 'listening' | 'unsupported' | 'error'

interface UseSpeechRecognitionOptions {
  onFinal: (text: string) => void
}

export function useSpeechRecognition({ onFinal }: UseSpeechRecognitionOptions) {
  const recognitionRef = useRef<any>(null)
  const holdingRef = useRef(false)
  const onFinalRef = useRef(onFinal)
  onFinalRef.current = onFinal

  const [status, setStatus] = useState<SpeechStatus>('idle')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)

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
      if (finalText.trim()) {
        onFinalRef.current(finalText.trim())
      }
    }

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        setError('Microphone permission denied. Allow mic access and try again.')
        setStatus('error')
      } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
        setError('Speech recognition error. Please try again.')
        setStatus('error')
      }
    }

    recognition.onend = () => {
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

  const start = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition) return
    holdingRef.current = true
    setError(null)
    setInterim('')
    try {
      recognition.start()
      setStatus('listening')
    } catch {
      /* already started */
    }
  }, [])

  const stop = useCallback(() => {
    holdingRef.current = false
    const recognition = recognitionRef.current
    if (!recognition) return
    try {
      recognition.stop()
    } catch {
      /* noop */
    }
    setInterim('')
    setStatus((s) => (s === 'listening' ? 'idle' : s))
  }, [])

  return { status, interim, error, start, stop, listening: status === 'listening' }
}
