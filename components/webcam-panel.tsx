'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, Loader2, Video } from 'lucide-react'
import { classifyGesture, type Landmark } from '@/lib/gesture-classifier'

export type TrackerStatus = 'idle' | 'loading' | 'running' | 'error'

interface WebcamPanelProps {
  active: boolean
  onActiveChange: (active: boolean) => void
  onStatusChange?: (status: TrackerStatus) => void
  onLiveSign?: (sign: string | null) => void
  onSignCommitted: (sign: string, confidence: number) => void
}

// MediaPipe hand skeleton connections
const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
]

const STABLE_FRAMES = 8
const COMMIT_COOLDOWN_MS = 1800
const CONFIDENCE_WINDOW = 30

export function WebcamPanel({
  active,
  onActiveChange,
  onStatusChange,
  onLiveSign,
  onSignCommitted,
}: WebcamPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const landmarkerRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const lastVideoTimeRef = useRef(-1)

  const candidateRef = useRef<{ sign: string; frames: number }>({ sign: '', frames: 0 })
  const lastCommitRef = useRef<{ sign: string; at: number }>({ sign: '', at: 0 })
  const recentRef = useRef<(string | null)[]>([])

  const [status, setStatusState] = useState<TrackerStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [liveSign, setLiveSignState] = useState<string | null>(null)
  const [handCount, setHandCount] = useState(0)

  const onStatusChangeRef = useRef(onStatusChange)
  onStatusChangeRef.current = onStatusChange
  const onLiveSignRef = useRef(onLiveSign)
  onLiveSignRef.current = onLiveSign
  const onSignCommittedRef = useRef(onSignCommitted)
  onSignCommittedRef.current = onSignCommitted

  const setStatus = useCallback((s: TrackerStatus) => {
    setStatusState(s)
    onStatusChangeRef.current?.(s)
  }, [])

  const setLiveSign = useCallback((sign: string | null) => {
    setLiveSignState(sign)
    onLiveSignRef.current?.(sign)
  }, [])

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    const canvas = canvasRef.current
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    recentRef.current = []
    candidateRef.current = { sign: '', frames: 0 }
    setLiveSign(null)
    setHandCount(0)
  }, [setLiveSign])

  const drawHands = useCallback((landmarksList: Landmark[][], canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    for (const lm of landmarksList) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      for (const [a, b] of HAND_CONNECTIONS) {
        ctx.beginPath()
        ctx.moveTo(lm[a].x * canvas.width, lm[a].y * canvas.height)
        ctx.lineTo(lm[b].x * canvas.width, lm[b].y * canvas.height)
        ctx.stroke()
      }
      for (let i = 0; i < lm.length; i++) {
        const isTip = [4, 8, 12, 16, 20].includes(i)
        ctx.beginPath()
        ctx.arc(lm[i].x * canvas.width, lm[i].y * canvas.height, isTip ? 6 : 4, 0, Math.PI * 2)
        ctx.fillStyle = isTip ? '#e5482e' : '#ffffff'
        ctx.fill()
      }
    }
  }, [])

  const predictLoop = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const landmarker = landmarkerRef.current
    if (!video || !canvas || !landmarker) return

    if (video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
      }

      const results = landmarker.detectForVideo(video, performance.now())
      const hands: Landmark[][] = results?.landmarks ?? []

      drawHands(hands, canvas)
      setHandCount(hands.length)

      const gesture = hands.length > 0 ? classifyGesture(hands[0]) : null
      setLiveSign(gesture?.sign ?? null)

      // Rolling window of recent classifications for a confidence estimate
      recentRef.current.push(gesture?.sign ?? null)
      if (recentRef.current.length > CONFIDENCE_WINDOW) recentRef.current.shift()

      if (gesture) {
        const cand = candidateRef.current
        if (cand.sign === gesture.sign) {
          cand.frames++
        } else {
          candidateRef.current = { sign: gesture.sign, frames: 1 }
        }

        const now = Date.now()
        const last = lastCommitRef.current
        const cooled = now - last.at > COMMIT_COOLDOWN_MS || last.sign !== gesture.sign

        if (candidateRef.current.frames >= STABLE_FRAMES && cooled) {
          lastCommitRef.current = { sign: gesture.sign, at: now }
          candidateRef.current = { sign: gesture.sign, frames: 0 }

          const matches = recentRef.current.filter((s) => s === gesture.sign).length
          const window = Math.max(recentRef.current.length, 1)
          const confidence = Math.min(0.99, Math.max(0.7, matches / window))

          onSignCommittedRef.current(gesture.sign, confidence)
        }
      } else {
        candidateRef.current = { sign: '', frames: 0 }
      }
    }

    rafRef.current = requestAnimationFrame(predictLoop)
  }, [drawHands, setLiveSign])

  const startCamera = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      if (!landmarkerRef.current) {
        const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision')
        const fileset = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm'
        )
        landmarkerRef.current = await HandLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
        })
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream

      const video = videoRef.current
      if (!video) throw new Error('Video element unavailable')
      video.srcObject = stream
      await video.play()

      setStatus('running')
      rafRef.current = requestAnimationFrame(predictLoop)
    } catch (err) {
      console.error('[v0] Camera/tracker init failed:', err)
      const name = err instanceof DOMException ? err.name : ''
      setError(
        name === 'NotAllowedError'
          ? 'Camera permission denied. Allow camera access and try again.'
          : name === 'NotFoundError' || name === 'OverconstrainedError'
            ? 'No camera detected. Connect a webcam and try again.'
            : 'Failed to start hand tracking. Check your camera and connection.'
      )
      stopCamera()
      setStatus('error')
      onActiveChange(false)
    }
  }, [predictLoop, setStatus, stopCamera, onActiveChange])

  // Controlled start/stop
  useEffect(() => {
    if (active) {
      startCamera()
    } else {
      stopCamera()
      setStatusState((s) => (s === 'error' ? s : 'idle'))
      onStatusChangeRef.current?.('idle')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      landmarkerRef.current?.close?.()
    }
  }, [])

  const running = status === 'running'

  return (
    <section
      aria-label="Webcam sign language input"
      className="relative h-full overflow-hidden rounded-lg bg-stage shadow-[0_1px_2px_rgb(0_0_0/0.06),0_8px_32px_-12px_rgb(0_0_0/0.25)]"
    >
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 size-full -scale-x-100 object-cover"
        aria-label="Live webcam feed"
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full -scale-x-100 object-cover"
        aria-hidden="true"
      />

      {/* Top status overlay */}
      {running && (
        <div className="absolute left-4 top-4 flex items-center gap-2 animate-fade-in">
          <span className="flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium text-stage-foreground backdrop-blur-md">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-70" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            {handCount > 0
              ? `Tracking ${handCount} hand${handCount > 1 ? 's' : ''}`
              : 'Camera live'}
          </span>
        </div>
      )}

      {/* Live recognized sign overlay */}
      {running && liveSign && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 animate-scale-in">
          <div className="rounded-full bg-black/50 px-6 py-2.5 backdrop-blur-md">
            <p className="text-lg font-semibold text-stage-foreground">{liveSign}</p>
          </div>
        </div>
      )}

      {/* Idle / loading / error states */}
      {!running && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
          {status === 'loading' ? (
            <>
              <div className="flex size-16 items-center justify-center rounded-full bg-white/10">
                <Loader2 className="size-7 animate-spin text-stage-foreground" aria-hidden="true" />
              </div>
              <p className="text-sm text-stage-foreground/70">Loading hand-tracking model...</p>
            </>
          ) : status === 'error' ? (
            <>
              <div className="flex size-16 items-center justify-center rounded-full bg-white/10">
                <CameraOff className="size-7 text-primary" aria-hidden="true" />
              </div>
              <p className="max-w-xs text-sm leading-relaxed text-stage-foreground/70">{error}</p>
              <button
                type="button"
                onClick={() => onActiveChange(true)}
                className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.03] active:scale-[0.98]"
              >
                Try again
              </button>
            </>
          ) : (
            <>
              <div className="flex size-16 items-center justify-center rounded-full bg-white/10">
                <Video className="size-7 text-stage-foreground/60" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-stage-foreground">Camera is off</p>
                <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-stage-foreground/60">
                  Start the camera to interpret sign language in real time with on-device hand
                  tracking.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onActiveChange(true)}
                className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.03] active:scale-[0.98]"
              >
                <Camera className="size-4" aria-hidden="true" />
                Start camera
              </button>
            </>
          )}
        </div>
      )}
    </section>
  )
}
