"use client"

import { Component, Suspense, useEffect, type ReactNode } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, ContactShadows } from "@react-three/drei"
import * as THREE from "three"
import { SignerAvatar } from "./signer-avatar"
import { FBXSigner } from "./fbx-signer"
import { PosePlayer } from "@/lib/sign/pose-player"

// Default rigged signer shipped with the app.
const DEFAULT_MODEL_URL = "/models/SignerModelRigged7.fbx"

/**
 * Catches errors thrown while loading/parsing the rigged model (e.g. a missing
 * or corrupt FBX) and renders the procedural avatar instead so the stage never
 * goes blank.
 */
class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error("Rigged model failed to load, using procedural fallback:", error)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export function AvatarStage({
  playerRef,
  onProgress,
  modelUrl = DEFAULT_MODEL_URL,
}: {
  playerRef: React.MutableRefObject<PosePlayer>
  onProgress?: (label: string, index: number, total: number) => void
  modelUrl?: string
}) {
  useEffect(() => {
    playerRef.current.onProgress = (label, i, total) => onProgress?.(label, i, total)
  }, [playerRef, onProgress])

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 0.6, 3.1], fov: 32 }}
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
        {/* Rigged FBX signer is the default character; the procedural avatar is
            only used if the model fails to load. */}
        <ModelBoundary fallback={<SignerAvatar playerRef={playerRef} />}>
          <Suspense fallback={null}>
            <FBXSigner playerRef={playerRef} url={modelUrl} />
          </Suspense>
        </ModelBoundary>
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
        minDistance={1.2}
        maxDistance={4}
        minPolarAngle={Math.PI * 0.25}
        maxPolarAngle={Math.PI * 0.62}
        target={[0, 0.3, 0]}
      />
    </Canvas>
  )
}
