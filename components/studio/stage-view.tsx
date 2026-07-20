"use client"

import dynamic from "next/dynamic"
import type { PosePlayer } from "@/lib/sign/pose-player"

// The 3D avatar relies on WebGL / browser globals, so load it client-only.
const AvatarStage = dynamic(
  () => import("@/components/avatar/avatar-stage").then((m) => m.AvatarStage),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-stage-txt/70">
          <span className="h-6 w-6 rounded-full border-2 border-stage-txt/30 border-t-stage-txt animate-fluent-spin" />
          <span className="text-sm">Loading signer…</span>
        </div>
      </div>
    ),
  },
)

export function StageView({
  playerRef,
  onProgress,
  glbUrl,
}: {
  playerRef: React.MutableRefObject<PosePlayer>
  onProgress?: (label: string, index: number, total: number) => void
  glbUrl?: string
}) {
  return <AvatarStage playerRef={playerRef} onProgress={onProgress} glbUrl={glbUrl} />
}
