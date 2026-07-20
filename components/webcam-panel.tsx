'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, Loader2, ScanLine } from 'lucide-react'
import { classifyGesture, type Landmark } from '@/lib/gesture-classifier'
import { cn } from '@/lib/utils'

type TrackerStatus = 'idle' | 'loading' | 'running' | 'error'

interface WebcamPanelProps {
  onSignRecognized: (sign: string) => void
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

export function WebcamPanel({ onSignRecognized }: WebcamPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const landmarkerRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const lastVideoTimeRef = useRef(-1)

  const candidateRef = useRef<{ sign: string; frames: number }>({ sign: '', frames: 0 })
  const lastCommitRef = useRef<{ sign: string; at: number }>({ sign: '', at: 0 })

  const [status, setStatus] = useState<TrackerStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [liveSign, setLiveSign] = useState<string | null>(null)
  const [handCount, setHandCount] = useState(0)

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    const canvas = canvasRef.current
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    setStatus('idle')
    setLiveSign(null)
    setHandCount(0)
  }, [])

  const drawHands = useCallback((landmarksList: Landmark[][], canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    for (const lm of landmarksList) {
      // Connections
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.9)'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      for (const [a, b] of HAND_CONNECTIONS) {
        ctx.beginPath()
        ctx.moveTo(lm[a].x * canvas.width, lm[a].y * canvas.height)
        ctx.lineTo(lm[b].x * canvas.width, lm[b].y * canvas.height)
        ctx.stroke()
      }
      // Joints
      for (let i = 0; i < lm.length; i++) {
        const isTip = [4, 8, 12, 16, 20].includes(i)
        ctx.beginPath()
        ctx.arc(lm[i].x * canvas.width, lm[i].y * canvas.height, isTip ? 6 : 4, 0, Math.PI * 2)
        ctx.fillStyle = isTip ? '#ffffff' : '#10b981'
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

      // Stability gate: same sign for N consecutive frames before committing
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
          onSignRecognized(gesture.sign)
        }
      } else {
        candidateRef.current = { sign: '', frames: 0 }
      }
    }

    rafRef.current = requestAnimationFrame(predictLoop)
  }, [drawHands, onSignRecognized])

  const startCamera = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      // Lazy-load MediaPipe (WASM) only when the camera starts
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
      setStatus('error')
      stopCamera()
      setStatus('error')
    }
  }, [predictLoop, stopCamera])

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
      className="flex h-full flex-col overflow-hidden rounded-lg border bg-card"
    >
      {/* Panel header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <ScanLine className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold">Sign-to-Text</h2>
        </div>
        <div className="flex items-center gap-3">
          {running && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
              {handCount > 0 ? `Tracking ${handCount} hand${handCount > 1 ? 's' : ''}` : 'Live'}
            </span>
          )}
          <button
            type="button"
            onClick={running ? stopCamera : startCamera}
            disabled={status === 'loading'}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              running
                ? 'bg-muted text-foreground hover:bg-border'
                : 'bg-primary text-primary-foreground hover:bg-primary/90',
              status === 'loading' && 'opacity-70'
            )}
          >
            {status === 'loading' ? (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                Loading model...
              </>
            ) : running ? (
              <>
                <CameraOff className="size-3.5" aria-hidden="true" />
                Stop
              </>
            ) : (
              <>
                <Camera className="size-3.5" aria-hidden="true" />
                Start Camera
              </>
            )}
          </button>
        </div>
      </div>

      {/* Video area */}
      <div className="relative flex-1 bg-background">
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

        {/* Live recognized sign overlay */}
        {running && liveSign && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <div className="rounded-md border border-primary/40 bg-background/85 px-5 py-2.5 backdrop-blur-sm">
              <p className="font-mono text-lg font-semibold text-primary">{liveSign}</p>
            </div>
          </div>
        )}

        {/* Idle / error states */}
        {!running && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            {status === 'error' ? (
              <>
                <CameraOff className="size-10 text-destructive" aria-hidden="true" />
                <p className="max-w-xs text-sm text-muted-foreground">{error}</p>
              </>
            ) : status === 'loading' ? (
              <>
                <Loader2 className="size-10 animate-spin text-primary" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">Loading hand-tracking model...</p>
              </>
            ) : (
              <>
                <div className="flex size-16 items-center justify-center rounded-full bg-muted">
                  <Camera className="size-7 text-muted-foreground" aria-hidden="true" />
                </div>
                <p className="text-sm font-medium">Camera is off</p>
                <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                  Start the camera to translate sign language in real time with hand-skeleton
                  tracking.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
