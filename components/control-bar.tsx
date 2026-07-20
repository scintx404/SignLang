'use client'

import { Camera, Hand, Loader2, Mic, Send, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Mode } from '@/components/dashboard'

interface ControlBarProps {
  mode: Mode
  onModeChange: (mode: Mode) => void
  // Sign mode
  cameraActive: boolean
  cameraLoading: boolean
  onToggleCamera: () => void
  // Speech mode
  speechSupported: boolean
  listening: boolean
  onMicDown: () => void
  onMicUp: () => void
  typed: string
  onTypedChange: (value: string) => void
  onSubmitTyped: () => void
}

export function ControlBar({
  mode,
  onModeChange,
  cameraActive,
  cameraLoading,
  onToggleCamera,
  speechSupported,
  listening,
  onMicDown,
  onMicUp,
  typed,
  onTypedChange,
  onSubmitTyped,
}: ControlBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_-12px_rgb(0_0_0/0.12)]">
      {/* Mode toggle */}
      <div
        role="tablist"
        aria-label="Translation direction"
        className="flex shrink-0 rounded-full bg-muted p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'sign'}
          onClick={() => onModeChange('sign')}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-all duration-200',
            mode === 'sign'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Hand className="size-3.5" aria-hidden="true" />
          <span className="whitespace-nowrap">{'Sign → Speech'}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'speech'}
          onClick={() => onModeChange('speech')}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-all duration-200',
            mode === 'speech'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Mic className="size-3.5" aria-hidden="true" />
          <span className="whitespace-nowrap">{'Speech → Sign'}</span>
        </button>
      </div>

      {mode === 'sign' ? (
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleCamera}
            disabled={cameraLoading}
            aria-label={cameraActive ? 'Stop camera' : 'Start camera'}
            className={cn(
              'flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-medium transition-all duration-200 active:scale-[0.97]',
              cameraActive
                ? 'border bg-card text-foreground hover:bg-muted'
                : 'bg-primary text-primary-foreground hover:opacity-90',
              cameraLoading && 'opacity-60'
            )}
          >
            {cameraLoading ? (
              <>
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                Starting...
              </>
            ) : cameraActive ? (
              <>
                <Square className="size-3 fill-current" aria-hidden="true" />
                End
              </>
            ) : (
              <>
                <Camera className="size-3.5" aria-hidden="true" />
                Start camera
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            disabled={!speechSupported}
            onPointerDown={(e) => {
              e.preventDefault()
              onMicDown()
            }}
            onPointerUp={onMicUp}
            onPointerLeave={() => listening && onMicUp()}
            onKeyDown={(e) => {
              if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                e.preventDefault()
                onMicDown()
              }
            }}
            onKeyUp={(e) => {
              if (e.key === ' ' || e.key === 'Enter') onMicUp()
            }}
            aria-pressed={listening}
            title={listening ? 'Release to translate' : 'Hold to speak'}
            className={cn(
              'flex size-10 shrink-0 touch-none select-none items-center justify-center rounded-full transition-all duration-200',
              listening
                ? 'pulse-ring-red scale-110 bg-destructive text-destructive-foreground'
                : 'pulse-ring bg-primary text-primary-foreground hover:opacity-90',
              !speechSupported && 'opacity-40'
            )}
          >
            <Mic className="size-4.5" aria-hidden="true" />
            <span className="sr-only">Hold to speak</span>
          </button>

          <form
            className="flex min-w-0 flex-1 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              onSubmitTyped()
            }}
          >
            <label htmlFor="type-to-sign" className="sr-only">
              Type a phrase to translate to sign language
            </label>
            <input
              id="type-to-sign"
              type="text"
              value={typed}
              onChange={(e) => onTypedChange(e.target.value)}
              placeholder={listening ? 'Release to translate...' : 'Hold mic or type a phrase'}
              className="min-w-0 flex-1 rounded-full border bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              type="submit"
              disabled={!typed.trim()}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-xs font-medium text-primary-foreground transition-all duration-200 hover:opacity-90 active:scale-[0.97]',
                !typed.trim() && 'opacity-40'
              )}
            >
              <Send className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Sign it</span>
              <span className="sr-only sm:hidden">Sign it</span>
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
