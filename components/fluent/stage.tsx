"use client"

import { HandCanvas } from "./hand-canvas"
import { Waveform } from "./waveform"
import { CameraIcon, HandIcon, MicIcon, PlayIcon, SpinnerIcon, StopIcon, VideoIcon } from "./icons"
import type { Mode, SessionState } from "./use-fluent-session"

interface StageProps {
  mode: Mode
  state: SessionState
  detect: { gloss: string; conf: number }
  latency: number
  camOff: boolean
  micOff: boolean
  onStart: () => void
  onEnd: () => void
  onMode: (m: Mode) => void
  onToggleCam: () => void
  onToggleMic: () => void
}

const accent = (mode: Mode) => (mode === "sign" ? "text-coral-deep" : "text-violet")

export function Stage({
  mode,
  state,
  detect,
  latency,
  camOff,
  micOff,
  onStart,
  onEnd,
  onMode,
  onToggleCam,
  onToggleMic,
}: StageProps) {
  const running = state === "live"
  const showOverlay = state !== "live"
  const detectLabel = mode === "sign" ? "Recognizing sign" : "Producing sign"
  const dotColor = mode === "sign" ? "bg-coral" : "bg-violet"
  const confFillColor = mode === "sign" ? "bg-coral" : "bg-violet"

  const overlayTitle =
    state === "connecting" ? "Connecting" : state === "ended" ? "Session ended" : "Start a live session"
  const overlayText =
    state === "connecting"
      ? "Calibrating hand tracking and warming up the translation model."
      : state === "ended"
        ? "Your transcript is saved below. Start again whenever you like."
        : "Point a camera at the signer. Fluent tracks 21 hand landmarks and translates in real time. Nothing is recorded."
  const startLabel = state === "ended" ? "Start again" : "Start session"

  return (
    <section className="flex flex-col gap-4">
      {/* viewport */}
      <div className="shadow-stage relative isolate aspect-[16/10] overflow-hidden rounded-lg bg-stage">
        {/* scanning grid backdrop */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(oklch(100% 0 0 / 0.035) 1px, transparent 1px), linear-gradient(90deg, oklch(100% 0 0 / 0.035) 1px, transparent 1px)",
            backgroundSize: "42px 42px",
            maskImage: "radial-gradient(ellipse 90% 90% at 50% 45%, black 40%, transparent 92%)",
            WebkitMaskImage: "radial-gradient(ellipse 90% 90% at 50% 45%, black 40%, transparent 92%)",
          }}
          aria-hidden="true"
        />

        <HandCanvas mode={mode} active={running} />

        {mode === "voice" && running && <Waveform active={running} />}

        {/* HUD */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
          <div className="flex items-start justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-[oklch(18%_0.02_285_/_0.55)] px-3 py-[7px] text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-stage-txt backdrop-blur-md">
              <span className={`size-2 rounded-full ${dotColor} ${running ? "animate-fluent-pulse" : ""}`} />
              Live
            </span>
            <div className="flex gap-2">
              <span className="rounded-lg bg-[oklch(18%_0.02_285_/_0.55)] px-2.5 py-1.5 text-[0.68rem] font-semibold tracking-[0.05em] text-stage-txt tabular-nums backdrop-blur-md">
                720p &middot; 30fps
              </span>
              <span className="rounded-lg bg-[oklch(18%_0.02_285_/_0.55)] px-2.5 py-1.5 text-[0.68rem] font-semibold tracking-[0.05em] text-stage-txt tabular-nums backdrop-blur-md">
                {latency} ms
              </span>
            </div>
          </div>

          <div className="min-w-[210px] max-w-[210px] self-start rounded-md border border-[oklch(100%_0_0_/_0.06)] bg-[oklch(18%_0.02_285_/_0.62)] p-4 backdrop-blur-lg">
            <div className="text-[0.68rem] uppercase tracking-[0.09em] text-[oklch(72%_0.02_285)]">{detectLabel}</div>
            <div className="mb-2.5 mt-0.5 min-h-6 font-display text-2xl font-bold leading-none tracking-[-0.01em] text-white">
              {detect.gloss}
            </div>
            <div className="flex items-center gap-[9px]">
              <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-[oklch(100%_0_0_/_0.14)]">
                <div
                  className={`h-full rounded-full ${confFillColor} transition-[width] duration-500`}
                  style={{ width: `${detect.conf}%` }}
                />
              </div>
              <div className="min-w-[38px] text-right text-[0.76rem] font-semibold tabular-nums text-stage-txt">
                {detect.conf}%
              </div>
            </div>
          </div>
        </div>

        {/* overlay */}
        {showOverlay && (
          <div
            className="absolute inset-0 z-[5] grid place-items-center p-6 text-center"
            style={{
              background:
                "radial-gradient(ellipse 120% 100% at 50% 30%, oklch(30% 0.03 285), oklch(21% 0.028 285))",
            }}
          >
            <div className="max-w-[360px]">
              <div
                className={`mx-auto mb-[18px] grid size-[66px] place-items-center rounded-[20px] border border-[oklch(100%_0_0_/_0.09)] bg-[oklch(100%_0_0_/_0.06)] text-white ${
                  state === "connecting" ? "animate-fluent-spin" : ""
                }`}
              >
                {state === "connecting" ? (
                  <SpinnerIcon className="size-[34px]" />
                ) : (
                  <VideoIcon className="size-[34px]" />
                )}
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

      {/* controls */}
      <div className="shadow-soft flex flex-wrap items-center gap-3 rounded-md border border-line bg-surface px-[14px] py-3">
        <div className="inline-flex gap-[3px] rounded-[10px] border border-line-soft bg-surface-2 p-1" role="group" aria-label="Translation direction">
          <button
            type="button"
            onClick={() => onMode("sign")}
            aria-pressed={mode === "sign"}
            className={`inline-flex cursor-pointer items-center gap-[7px] rounded-[7px] px-[15px] py-2 text-[0.85rem] font-semibold transition-colors ${
              mode === "sign" ? `shadow-soft bg-surface ${accent("sign")}` : "text-ink-soft"
            }`}
          >
            <HandIcon className="size-[15px]" />
            Sign &rarr; Speech
          </button>
          <button
            type="button"
            onClick={() => onMode("voice")}
            aria-pressed={mode === "voice"}
            className={`inline-flex cursor-pointer items-center gap-[7px] rounded-[7px] px-[15px] py-2 text-[0.85rem] font-semibold transition-colors ${
              mode === "voice" ? `shadow-soft bg-surface ${accent("voice")}` : "text-ink-soft"
            }`}
          >
            <MicIcon className="size-[15px]" />
            Speech &rarr; Sign
          </button>
        </div>

        <div className="flex-1" />

        <button
          type="button"
          onClick={onToggleCam}
          title="Toggle camera"
          aria-label="Toggle camera"
          aria-pressed={camOff}
          className={`grid size-[42px] cursor-pointer place-items-center rounded-[11px] border transition-all hover:-translate-y-px ${
            camOff
              ? "border-transparent bg-coral-wash text-coral-deep"
              : "border-line-soft bg-surface-2 text-ink-soft hover:text-ink"
          }`}
        >
          <CameraIcon className="size-[19px]" />
        </button>
        <button
          type="button"
          onClick={onToggleMic}
          title="Toggle microphone"
          aria-label="Toggle microphone"
          aria-pressed={micOff}
          className={`grid size-[42px] cursor-pointer place-items-center rounded-[11px] border transition-all hover:-translate-y-px ${
            micOff
              ? "border-transparent bg-coral-wash text-coral-deep"
              : "border-line-soft bg-surface-2 text-ink-soft hover:text-ink"
          }`}
        >
          <MicIcon className="size-[19px]" />
        </button>
        <button
          type="button"
          onClick={onEnd}
          disabled={!running}
          className="inline-flex cursor-pointer items-center gap-2 rounded-[11px] border border-line bg-surface-2 px-[18px] py-2.5 text-[0.88rem] font-semibold text-ink transition-colors hover:border-transparent hover:bg-coral hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <StopIcon className="size-4" />
          End
        </button>
      </div>
    </section>
  )
}
