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
      <TopBar state={s.state} knownCount={s.knownCount} />

      <main className="mt-[26px] grid items-start gap-[22px] lg:grid-cols-[minmax(0,1.5fr)_minmax(340px,1fr)]">
        <Stage
          playerRef={s.playerRef}
          onProgress={s.handleProgress}
          mode={s.mode}
          state={s.state}
          detect={s.detect}
          isSigning={s.isSigning}
          text={s.text}
          setText={s.setText}
          speed={s.speed}
          setSpeed={s.setSpeed}
          listening={s.listening}
          voiceSupported={s.voiceSupported}
          onStart={s.start}
          onEnd={s.end}
          onSubmit={s.submit}
          onStopSigning={s.stopSigning}
          onMode={s.switchMode}
          onToggleMic={s.toggleMic}
        />
        <StreamPanel live={s.live} glossRow={s.glossRow} transcript={s.transcript} onSpeak={s.speak} />
      </main>

      <StatStrip words={s.stats.words} signs={s.stats.signs} knownCount={s.knownCount} speed={s.speed} />
    </div>
  )
}
