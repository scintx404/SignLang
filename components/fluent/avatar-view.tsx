"use client"

import dynamic from "next/dynamic"
import type { PosePlayer } from "@/lib/sign/pose-player"

// The 3D signer relies on WebGL / browser globals, so load it client-only.
const AvatarStage = dynamic(() => import("@/components/avatar/avatar-stage").then((m) => m.AvatarStage), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center">
      <div className="flex flex-col items-center gap-3 text-stage-txt/70">
        <span className="size-6 animate-fluent-spin rounded-full border-2 border-stage-txt/30 border-t-stage-txt" />
        <span className="text-sm">Loading signer&hellip;</span>
      </div>
    </div>
  ),
})

export function AvatarView({
  playerRef,
  onProgress,
  modelUrl,
}: {
  playerRef: React.MutableRefObject<PosePlayer>
  onProgress?: (label: string, index: number, total: number) => void
  modelUrl?: string
}) {
  return <AvatarStage playerRef={playerRef} onProgress={onProgress} modelUrl={modelUrl} />
}
