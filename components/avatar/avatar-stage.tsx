"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, ContactShadows } from "@react-three/drei"
import * as THREE from "three"
import { SignerAvatar } from "./signer-avatar"
import { GLBSigner } from "./glb-signer"
import { PosePlayer } from "@/lib/sign/pose-player"

function ModelWithFallback({
  playerRef,
  url,
  onError,
}: {
  playerRef: React.MutableRefObject<PosePlayer>
  url: string
  onError: () => void
}) {
  useEffect(() => {
    let cancelled = false
    fetch(url, { method: "HEAD" })
      .then((r) => {
        if (!cancelled && !r.ok) onError()
      })
      .catch(() => {
        if (!cancelled) onError()
      })
    return () => {
      cancelled = true
    }
  }, [url, onError])

  return <GLBSigner playerRef={playerRef} url={url} />
}

export function AvatarStage({
  playerRef,
  onProgress,
  glbUrl,
}: {
  playerRef: React.MutableRefObject<PosePlayer>
  onProgress?: (label: string, index: number, total: number) => void
  glbUrl?: string
}) {
  const [useGlb, setUseGlb] = useState(Boolean(glbUrl))

  useEffect(() => {
    playerRef.current.onProgress = (label, i, total) => onProgress?.(label, i, total)
  }, [playerRef, onProgress])

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 1.35, 1.35], fov: 34 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
    >
      <color attach="background" args={["#26232f"]} />
      <fog attach="fog" args={["#26232f", 3.5, 7]} />
      <ambientLight intensity={0.7} />
      <directionalLight
        position={[2, 4, 3]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
      />
      <directionalLight position={[-3, 2, -2]} intensity={0.4} color="#ffd9b0" />
      <hemisphereLight args={["#fff6ea", "#8a7a63", 0.6]} />
      <pointLight position={[0, 2, 2]} intensity={0.5} color="#fff2e0" />

      <group position={[0, -1.0, 0]}>
        <Suspense fallback={null}>
          {useGlb && glbUrl ? (
            <ModelWithFallback
              playerRef={playerRef}
              url={glbUrl}
              onError={() => setUseGlb(false)}
            />
          ) : (
            <SignerAvatar playerRef={playerRef} />
          )}
        </Suspense>
        <ContactShadows
          position={[0, 0.01, 0]}
          opacity={0.35}
          scale={4}
          blur={2.4}
          far={2}
          color="#7a6a55"
        />
      </group>

      <OrbitControls
        enablePan={false}
        minDistance={0.9}
        maxDistance={2.6}
        minPolarAngle={Math.PI * 0.25}
        maxPolarAngle={Math.PI * 0.62}
        target={[0, 0.35, 0]}
      />
    </Canvas>
  )
}
