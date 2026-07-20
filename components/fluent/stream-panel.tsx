"use client"

import { useEffect, useRef } from "react"
import { ArrowIcon, ChatIcon, SpeakerIcon } from "./icons"
import type { GlossChip, TranscriptLine } from "./use-fluent-session"

interface StreamPanelProps {
  live: { text: string; cursor: boolean }
  glossRow: GlossChip[]
  transcript: TranscriptLine[]
  onSpeak: (value: string) => void
}

export function StreamPanel({ live, glossRow, transcript, onSpeak }: StreamPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [transcript])

  const hasLive = live.text.length > 0 || live.cursor

  return (
    <aside className="shadow-soft flex min-h-[520px] flex-col overflow-hidden rounded-lg border border-line bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-line-soft px-5 pb-4 pt-[18px]">
        <h2 className="text-[1.02rem] tracking-[-0.01em]">Translation</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-coral-wash px-[11px] py-1.5 text-[0.72rem] font-semibold tracking-[0.03em] text-coral-deep">
          <ArrowIcon className="size-[13px]" />
          <span>English to ASL</span>
        </span>
      </div>

      {/* live caption */}
      <div className="flex min-h-[118px] flex-col justify-center border-b border-line-soft bg-surface-2 px-5 py-[22px]">
        <div className="mb-2 flex items-center gap-[7px] text-[0.7rem] font-bold uppercase tracking-[0.08em] text-ink-faint">
          <span className="rounded-[5px] bg-coral-wash px-[7px] py-0.5 tracking-[0.05em] text-coral-deep">Signing</span>
          <span>on stage now</span>
        </div>
        <div className="font-display text-[clamp(1.28rem,2.4vw,1.65rem)] font-medium leading-[1.25] tracking-[-0.015em] text-ink text-pretty">
          {hasLive ? (
            <>
              {live.text}
              {live.cursor && (
                <span className="ml-[3px] inline-block h-[1.1em] w-[3px] animate-blink rounded-sm bg-coral align-[-0.16em]" />
              )}
            </>
          ) : (
            <span className="font-sans text-[1rem] font-normal tracking-normal text-ink-faint">Waiting for input&hellip;</span>
          )}
        </div>
        {glossRow.length > 0 && (
          <div className="mt-3.5 flex flex-wrap gap-[7px]">
            {glossRow.map((g, i) => (
              <span
                key={`${g.label}-${i}`}
                className={`rounded-[7px] border px-2.5 py-[5px] text-[0.72rem] font-semibold tracking-[0.06em] transition-all duration-300 ${
                  g.on
                    ? "translate-y-0 border-transparent bg-coral-wash text-coral-deep opacity-100"
                    : "translate-y-1 border-line bg-surface text-ink-soft opacity-40"
                }`}
              >
                {g.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* transcript */}
      <div ref={scrollRef} className="transcript-scroll flex flex-1 flex-col gap-0.5 overflow-y-auto px-5 pb-5 pt-2">
        {transcript.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2.5 p-[30px] text-center text-ink-faint">
            <ChatIcon className="size-[30px] opacity-50" />
            <p className="max-w-[26ch] text-[0.9rem]">Everything you translate appears here, line by line.</p>
          </div>
        ) : (
          transcript.map((line, idx) => (
            <div key={line.id} className={`animate-rise py-3.5 ${idx === 0 ? "" : "border-t border-line-soft"}`}>
              <div className="mb-[5px] flex items-center gap-2">
                <span className="rounded-[5px] bg-coral-wash px-2 py-[3px] text-[0.68rem] font-bold uppercase tracking-[0.06em] text-coral-deep">
                  You
                </span>
                <span className="text-[0.72rem] tabular-nums text-ink-faint">{line.time}</span>
                <button
                  type="button"
                  onClick={() => onSpeak(line.text)}
                  title="Play audio"
                  aria-label={`Play "${line.text}" as audio`}
                  className="ml-auto inline-flex items-center gap-[5px] rounded-full px-2 py-1 text-[0.72rem] text-coral transition-colors hover:bg-coral-wash"
                >
                  <SpeakerIcon className="size-[15px]" />
                  Play
                </button>
              </div>
              <div className="text-[0.98rem] leading-[1.5] text-ink text-pretty">{line.text}</div>
              <div className="mt-[5px] text-[0.74rem] tracking-[0.04em] text-ink-faint">Signed: {line.glosses.join(" · ")}</div>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
