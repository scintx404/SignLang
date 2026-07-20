"use client"

import { TopBar } from "./top-bar"
import { Stage } from "./stage"
import { StreamPanel } from "./stream-panel"
import { StatStrip } from "./stat-strip"
import { useFluentSession } from "./use-fluent-session"

export function FluentStudio() {
  const s = useFluentSession()

  return (
    <div className="mx-auto max-w-[1220px] px-[clamp(18px,3vw,34px)] py-[clamp(18px,3vw,34px)]">
      <TopBar state={s.state} />

      <main className="mt-[26px] grid items-start gap-[22px] lg:grid-cols-[minmax(0,1.5fr)_minmax(340px,1fr)]">
        <Stage
          mode={s.mode}
          state={s.state}
          detect={s.detect}
          latency={s.latency}
          camOff={s.camOff}
          micOff={s.micOff}
          onStart={s.start}
          onEnd={s.end}
          onMode={s.switchMode}
          onToggleCam={s.toggleCam}
          onToggleMic={s.toggleMic}
        />
        <StreamPanel mode={s.mode} live={s.live} glossRow={s.glossRow} transcript={s.transcript} />
      </main>

      <StatStrip words={s.stats.words} signs={s.stats.signs} />
    </div>
  )
}
