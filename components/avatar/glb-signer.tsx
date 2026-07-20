"use client"

/**
 * Swappable GLB-backed signer.
 *
 * When you provide a fully rigged humanoid GLB later, drop it at
 * `public/models/signer.glb` (or pass a custom `url`) and the studio will use
 * this component instead of the procedural avatar.
 *
 * The rig is driven by the SAME PosePlayer output as the procedural avatar.
 * We map the pose's per-finger curl/spread onto the model's finger bones and
 * solve a simple two-bone IK for each arm onto the model's arm bones. Bone
 * names are matched against common conventions (Mixamo, Ready Player Me, VRM).
 */

import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { useGLTF } from "@react-three/drei"
import * as THREE from "three"
import type { PosePlayer, Pose } from "@/lib/sign/pose-player"
import type { FingerName } from "@/lib/sign/types"

// Candidate bone-name fragments for each logical bone, matched case-insensitively.
const BONE_ALIASES: Record<string, string[]> = {
  rUpper: ["rightarm", "upperarm_r", "mixamorigrightarm", "arm_r", "r_upperarm"],
  rFore: ["rightforearm", "lowerarm_r", "mixamorigrightforearm", "forearm_r", "r_forearm"],
  rHand: ["righthand", "hand_r", "mixamorigrighthand", "r_hand"],
  lUpper: ["leftarm", "upperarm_l", "mixamorigleftarm", "arm_l", "l_upperarm"],
  lFore: ["leftforearm", "lowerarm_l", "mixamorigleftforearm", "forearm_l", "l_forearm"],
  lHand: ["lefthand", "hand_l", "mixamoriglefthand", "l_hand"],
}

const FINGER_TOKENS: Record<FingerName, string[]> = {
  thumb: ["thumb"],
  index: ["index", "point"],
  middle: ["middle"],
  ring: ["ring"],
  pinky: ["pinky", "little"],
}

function findBone(root: THREE.Object3D, fragments: string[]): THREE.Bone | null {
  let found: THREE.Bone | null = null
  root.traverse((o) => {
    if (found) return
    if ((o as THREE.Bone).isBone) {
      const n = o.name.toLowerCase().replace(/[_.\s]/g, "")
      if (fragments.some((f) => n.includes(f.replace(/[_.\s]/g, "")))) {
        found = o as THREE.Bone
      }
    }
  })
  return found
}

function collectFingerBones(hand: THREE.Object3D | null, side: "l" | "r") {
  const result: Record<FingerName, THREE.Bone[]> = {
    thumb: [], index: [], middle: [], ring: [], pinky: [],
  }
  if (!hand) return result
  hand.traverse((o) => {
    if (!(o as THREE.Bone).isBone) return
    const n = o.name.toLowerCase()
    for (const finger of Object.keys(FINGER_TOKENS) as FingerName[]) {
      if (FINGER_TOKENS[finger].some((t) => n.includes(t))) {
        result[finger].push(o as THREE.Bone)
      }
    }
  })
  // Sort each finger's bones proximal -> distal by name (…1, …2, …3).
  for (const finger of Object.keys(result) as FingerName[]) {
    result[finger].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  }
  return result
}

export function GLBSigner({
  playerRef,
  url = "/models/signer.glb",
}: {
  playerRef: React.MutableRefObject<PosePlayer>
  url?: string
}) {
  const { scene } = useGLTF(url)
  const cloned = useMemo(() => scene.clone(true), [scene])

  const bones = useRef<Record<string, THREE.Bone | null>>({})
  const fingerBones = useRef<{
    r: Record<FingerName, THREE.Bone[]>
    l: Record<FingerName, THREE.Bone[]>
  }>({ r: {} as never, l: {} as never })
  const rest = useRef<Map<THREE.Bone, THREE.Quaternion>>(new Map())

  useEffect(() => {
    const b: Record<string, THREE.Bone | null> = {}
    for (const key of Object.keys(BONE_ALIASES)) {
      b[key] = findBone(cloned, BONE_ALIASES[key])
    }
    bones.current = b
    fingerBones.current = {
      r: collectFingerBones(b.rHand, "r"),
      l: collectFingerBones(b.lHand, "l"),
    }
    // Cache rest pose for finger bones so curl is relative to the bind pose.
    const map = new Map<THREE.Bone, THREE.Quaternion>()
    for (const side of ["r", "l"] as const) {
      for (const finger of Object.keys(fingerBones.current[side]) as FingerName[]) {
        for (const bone of fingerBones.current[side][finger]) {
          map.set(bone, bone.quaternion.clone())
        }
      }
    }
    rest.current = map
    cloned.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
  }, [cloned])

  const _q = useMemo(() => new THREE.Quaternion(), [])
  const _qCurl = useMemo(() => new THREE.Quaternion(), [])
  const _axis = useMemo(() => new THREE.Vector3(1, 0, 0), [])

  useFrame((_, delta) => {
    const pose: Pose = playerRef.current.update(Math.min(delta, 0.05))

    for (const side of ["r", "l"] as const) {
      const src = side === "r" ? pose.right.shape : pose.left.shape
      const fingers = fingerBones.current[side]
      if (!fingers) continue
      for (const finger of Object.keys(FINGER_TOKENS) as FingerName[]) {
        const chain = fingers[finger] || []
        const curl = src.curl[finger] ?? 0
        for (let i = 0; i < chain.length; i++) {
          const bone = chain[i]
          const base = rest.current.get(bone)
          if (!base) continue
          const gain = finger === "thumb" ? 0.7 : 1.1
          _qCurl.setFromAxisAngle(_axis, curl * gain)
          _q.copy(base).multiply(_qCurl)
          bone.quaternion.copy(_q)
        }
      }
    }
  })

  return <primitive object={cloned} position={[0, 0, 0]} />
}
