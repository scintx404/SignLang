"use client"

import type React from "react"
import { Keyboard, Send, Type } from "lucide-react"
import { AvatarView } from "./avatar-view"
import { HandIcon, MicIcon, PlayIcon, SpinnerIcon, StopIcon, VideoIcon } from "./icons"
import { QUICK_PHRASES, SPEEDS, type Mode, type SessionState } from "./use-fluent-session"
import type { PosePlayer } from "@/lib/sign/pose-player"

interface StageProps {
  playerRef: React.MutableRefObject<PosePlayer>
  onProgress: (label: string, index: number, total: number) => void
  mode: Mode
  state: SessionState
  detect: { gloss: string; index: number; total: number }
  isSigning: boolean
  text: string
  setText: (v: string) => void
  speed: number
  setSpeed: (v: number) => void
  listening: boolean
  voiceSupported: boolean
  onStart: () => void
  onEnd: () => void
  onSubmit: (input?: string) => void
  onStopSigning: () => void
  onMode: (m: Mode) => void
  onToggleMic: () => void
}

export function Stage({
  playerRef,
  onProgress,
  mode,
  state,
  detect,
  isSigning,
  text,
  setText,
  speed,
  setSpeed,
  listening,
  voiceSupported,
  onStart,
  onEnd,
  onSubmit,
  onStopSigning,
  onMode,
  onToggleMic,
}: StageProps) {
  const live = state === "live"
  const showOverlay = state !== "live"
  const pct = detect.total > 0 ? Math.round((detect.index / detect.total) * 100) : 0

  const overlayTitle = state === "connecting" ? "Waking the signer" : state === "ended" ? "Session ended" : "Start a live session"
  const overlayText =
    state === "connecting"
      ? "Warming up the 3D signer and the translation engine."
      : state === "ended"
        ? "Your transcript is saved beside the stage. Start again whenever you like."
        : "Type or speak in English and the 3D avatar signs it back in real time — fingerspelling anything outside its vocabulary."
  const startLabel = state === "ended" ? "Start again" : "Start session"

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    e.preventDefault()
    onSubmit()
  }

  return (
    <section className="flex flex-col gap-4">
      {/* viewport */}
      <div className="shadow-stage relative isolate aspect-[16/10] overflow-hidden rounded-lg bg-stage">
        <AvatarView playerRef={playerRef} onProgress={onProgress} />

        {/* HUD */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
          <div className="flex items-start justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-[oklch(18%_0.02_285_/_0.55)] px-3 py-[7px] text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-stage-txt backdrop-blur-md">
              <span className={`size-2 rounded-full bg-coral ${live && isSigning ? "animate-fluent-pulse" : ""}`} />
              {live ? "Live" : "Idle"}
            </span>
            <span className="rounded-lg bg-[oklch(18%_0.02_285_/_0.55)] px-2.5 py-1.5 text-[0.68rem] font-semibold tracking-[0.05em] text-stage-txt tabular-nums backdrop-blur-md">
              English &rarr; ASL
            </span>
          </div>

          <div className="min-w-[210px] max-w-[210px] self-start rounded-md border border-[oklch(100%_0_0_/_0.06)] bg-[oklch(18%_0.02_285_/_0.62)] p-4 backdrop-blur-lg">
            <div className="text-[0.68rem] uppercase tracking-[0.09em] text-[oklch(72%_0.02_285)]">Now signing</div>
            <div className="mb-2.5 mt-0.5 min-h-6 font-display text-2xl font-bold leading-none tracking-[-0.01em] text-white">
              {detect.gloss}
            </div>
            <div className="flex items-center gap-[9px]">
              <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-[oklch(100%_0_0_/_0.14)]">
                <div
                  className="h-full rounded-full bg-coral transition-[width] duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="min-w-[52px] text-right text-[0.76rem] font-semibold tabular-nums text-stage-txt">
                {detect.total > 0 ? `${detect.index}/${detect.total}` : "—"}
              </div>
            </div>
          </div>
        </div>

        <p className="pointer-events-none absolute bottom-3 right-4 z-[4] text-[0.72rem] text-stage-txt/45">
          Drag to rotate &middot; scroll to zoom
        </p>

        {/* overlay */}
        {showOverlay && (
          <div
            className="absolute inset-0 z-[5] grid place-items-center p-6 text-center"
            style={{ background: "radial-gradient(ellipse 120% 100% at 50% 30%, oklch(30% 0.03 285), oklch(21% 0.028 285))" }}
          >
            <div className="max-w-[360px]">
              <div
                className={`mx-auto mb-[18px] grid size-[66px] place-items-center rounded-[20px] border border-[oklch(100%_0_0_/_0.09)] bg-[oklch(100%_0_0_/_0.06)] text-white ${
                  state === "connecting" ? "animate-fluent-spin" : ""
                }`}
              >
                {state === "connecting" ? <SpinnerIcon className="size-[34px]" /> : <VideoIcon className="size-[34px]" />}
              </div>
              <h2 className="mb-2 text-2xl text-white">
                {overlayTitle}
                {state === "connecting" && <span className="animate-pulse">&hellip;</span>}
              </h2>
              <p className="mb-[22px] text-[0.92rem] text-[oklch(74%_0.02_285)]">{overlayText}</p>
              {state !== "connecting" && (
                <button
                  type="button"
                  onClick={onStart}
                  className="inline-flex cursor-pointer items-center gap-[9px] rounded-full bg-coral px-7 py-[13px] text-[0.95rem] font-semibold text-white transition-transform hover:-translate-y-0.5 hover:bg-coral-deep active:translate-y-0"
                  style={{ boxShadow: "0 8px 22px oklch(63% 0.2 28 / 0.4)" }}
                >
                  <PlayIcon className="size-[18px]" />
                  {startLabel}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* input + controls */}
      <div className="shadow-soft flex flex-col gap-3 rounded-md border border-line bg-surface px-[14px] py-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* input-method toggle */}
          <div
            className="inline-flex gap-[3px] rounded-[10px] border border-line-soft bg-surface-2 p-1"
            role="group"
            aria-label="Input method"
          >
            <button
              type="button"
              onClick={() => onMode("text")}
              aria-pressed={mode === "text"}
              className={`inline-flex cursor-pointer items-center gap-[7px] rounded-[7px] px-[15px] py-2 text-[0.85rem] font-semibold transition-colors ${
                mode === "text" ? "shadow-soft bg-surface text-coral-deep" : "text-ink-soft"
              }`}
            >
              <Type className="size-[15px]" aria-hidden="true" />
              Type
            </button>
            <button
              type="button"
              onClick={() => onMode("voice")}
              aria-pressed={mode === "voice"}
              disabled={!voiceSupported}
              title={voiceSupported ? undefined : "Voice input isn't supported in this browser"}
              className={`inline-flex cursor-pointer items-center gap-[7px] rounded-[7px] px-[15px] py-2 text-[0.85rem] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                mode === "voice" ? "shadow-soft bg-surface text-coral-deep" : "text-ink-soft"
              }`}
            >
              <MicIcon className="size-[15px]" />
              Speak
            </button>
          </div>

          <div className="flex-1" />

          {/* speed */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-ink-faint">Speed</span>
            <div className="flex gap-1">
              {SPEEDS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSpeed(s.value)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    speed === s.value ? "bg-ink text-surface" : "bg-surface-2 text-ink-soft hover:bg-line-soft"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onEnd}
            disabled={!live}
            className="inline-flex cursor-pointer items-center gap-2 rounded-[11px] border border-line bg-surface-2 px-[18px] py-2.5 text-[0.88rem] font-semibold text-ink transition-colors hover:border-transparent hover:bg-coral hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <StopIcon className="size-4" />
            End
          </button>
        </div>

        {/* the actual input surface */}
        {mode === "text" ? (
          <div className="flex items-center gap-2">
            <label htmlFor="fluent-input" className="sr-only">
              English text to translate into sign language
            </label>
            <span className="grid size-9 flex-none place-items-center rounded-md bg-surface-2 text-ink-faint">
              <Keyboard className="size-[18px]" aria-hidden="true" />
            </span>
            <input
              id="fluent-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!live}
              placeholder={live ? "Type something and press Enter…" : "Start the session to begin"}
              className="min-w-0 flex-1 rounded-md border border-line bg-surface-2 px-3.5 py-2.5 text-[0.95rem] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-coral disabled:opacity-50"
            />
            {isSigning ? (
              <button
                type="button"
                onClick={onStopSigning}
                className="inline-flex flex-none items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-surface transition-colors hover:bg-ink-soft"
              >
                <StopIcon className="size-4" />
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSubmit()}
                disabled={!live || text.trim().length === 0}
                className="inline-flex flex-none items-center gap-2 rounded-full bg-coral px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-coral-deep disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="size-4" aria-hidden="true" />
                Sign it
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleMic}
              disabled={!live}
              aria-pressed={listening}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                listening ? "border-coral bg-coral-wash text-coral-deep" : "border-line bg-surface text-ink-soft hover:bg-surface-2"
              }`}
            >
              <MicIcon className={`size-4 ${listening ? "animate-fluent-pulse" : ""}`} />
              {listening ? "Listening…" : "Tap to speak"}
            </button>
            <span className="truncate text-sm text-ink-faint">{text || "Say a phrase and the signer will translate it."}</span>
          </div>
        )}

        {/* quick phrases */}
        <div className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-3">
          <span className="text-xs font-medium text-ink-faint">Quick</span>
          {QUICK_PHRASES.map((phrase) => (
            <button
              key={phrase}
              type="button"
              onClick={() => {
                setText(phrase)
                onSubmit(phrase)
              }}
              disabled={!live}
              className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink transition-colors hover:border-coral hover:text-coral-deep disabled:cursor-not-allowed disabled:opacity-40"
            >
              {phrase}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
