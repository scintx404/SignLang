"use client"

import { forwardRef, useImperativeHandle, useMemo, useRef } from "react"
import * as THREE from "three"
import type { HandShape, FingerName } from "@/lib/sign/types"

export interface HandHandle {
  applyShape: (shape: HandShape) => void
}

interface FingerConfig {
  name: FingerName
  knuckle: [number, number, number]
  segments: number[]
  spreadDir: number // sign for fanning (index positive .. pinky negative)
  isThumb?: boolean
}

const SKIN = "#e2a17a"
const SKIN_DARK = "#c98a63"

// Right-hand finger layout. Palm centered so the wrist sits at the group origin
// (y = 0) and the knuckles are along the top edge (y ~ 0.1). Fingers extend +Y.
const FINGERS: FingerConfig[] = [
  { name: "index", knuckle: [-0.03, 0.1, 0.004], segments: [0.04, 0.026, 0.02], spreadDir: 1 },
  { name: "middle", knuckle: [-0.009, 0.104, 0.004], segments: [0.045, 0.03, 0.022], spreadDir: 0.4 },
  { name: "ring", knuckle: [0.012, 0.1, 0.004], segments: [0.04, 0.027, 0.02], spreadDir: -0.4 },
  { name: "pinky", knuckle: [0.032, 0.092, 0.004], segments: [0.031, 0.021, 0.017], spreadDir: -1 },
  { name: "thumb", knuckle: [-0.042, 0.028, 0.02], segments: [0.034, 0.028, 0.022], spreadDir: 0, isThumb: true },
]

// Per-joint curl gain (MCP, PIP, DIP). PIP bends the most.
const CURL_GAIN = [1.25, 1.6, 1.0]
const THUMB_GAIN = [0.9, 1.0, 0.8]

interface JointRefs {
  groups: THREE.Group[] // [mcp, pip, dip]
  config: FingerConfig
}

export const Hand = forwardRef<HandHandle, { side: "right" | "left" }>(function Hand({ side }, ref) {
  const jointStore = useRef<Record<string, JointRefs>>({})

  // Build the finger hierarchy once as THREE objects, so we can mutate joint
  // rotations imperatively every frame without React re-renders.
  const { palm, fingerRoots } = useMemo(() => {
    const skinMat = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.72, metalness: 0.02 })
    const skinMatDark = new THREE.MeshStandardMaterial({ color: SKIN_DARK, roughness: 0.72, metalness: 0.02 })

    // Palm block.
    const palmGeo = new THREE.BoxGeometry(0.084, 0.1, 0.03)
    const palmMesh = new THREE.Mesh(palmGeo, skinMat)
    palmMesh.position.set(0, 0.05, 0)
    palmMesh.castShadow = true
    const palmGroup = new THREE.Group()
    palmGroup.add(palmMesh)

    const roots: THREE.Group[] = []
    const store: Record<string, JointRefs> = {}

    for (const cfg of FINGERS) {
      const groups: THREE.Group[] = []
      let parent: THREE.Object3D | null = null
      const mcp = new THREE.Group()
      mcp.position.set(cfg.knuckle[0], cfg.knuckle[1], cfg.knuckle[2])
      if (cfg.isThumb) {
        // Seat the thumb lower and rotate it out to the side of the palm.
        mcp.rotation.set(0.3, 0, side === "right" ? 0.9 : -0.9)
      }
      parent = mcp
      groups.push(mcp)

      for (let i = 0; i < cfg.segments.length; i++) {
        const len = cfg.segments[i]
        const radius = cfg.isThumb ? 0.011 - i * 0.001 : 0.0105 - i * 0.0012
        const geo = new THREE.CapsuleGeometry(radius, len - radius, 4, 8)
        const mesh = new THREE.Mesh(geo, i === cfg.segments.length - 1 ? skinMatDark : skinMat)
        mesh.position.set(0, len / 2, 0)
        mesh.castShadow = true

        const joint = i === 0 ? mcp : new THREE.Group()
        if (i > 0) {
          joint.position.set(0, cfg.segments[i - 1], 0)
          groups.push(joint)
          parent!.add(joint)
        }
        joint.add(mesh)
        parent = joint
      }

      store[cfg.name] = { groups, config: cfg }
      roots.push(mcp)
    }

    jointStore.current = store
    return { palm: palmGroup, fingerRoots: roots }
  }, [side])

  useImperativeHandle(ref, () => ({
    applyShape(shape: HandShape) {
      const store = jointStore.current
      for (const cfg of FINGERS) {
        const entry = store[cfg.name]
        if (!entry) continue
        const curl = shape.curl[cfg.name]
        const gain = cfg.isThumb ? THUMB_GAIN : CURL_GAIN
        for (let i = 0; i < entry.groups.length; i++) {
          const g = entry.groups[i]
          const angle = curl * gain[i] * 1.05
          // Curl bends fingertips toward the palm (-Z).
          g.rotation.x = -angle
          if (i === 0 && !cfg.isThumb) {
            // Fan fingers out from the knuckle.
            g.rotation.z = cfg.spreadDir * shape.spread * 0.28 * (side === "right" ? 1 : -1)
          }
        }
        if (cfg.isThumb) {
          const mcp = entry.groups[0]
          // thumbSide: -1 tucked across palm, +1 abducted out.
          const base = side === "right" ? 0.9 : -0.9
          mcp.rotation.z = base - shape.thumbSide * 0.7 * (side === "right" ? 1 : -1)
          mcp.rotation.y = shape.thumbSide * 0.3 * (side === "right" ? 1 : -1)
        }
      }
    },
  }))

  return (
    <group scale={side === "left" ? [-1, 1, 1] : [1, 1, 1]}>
      <primitive object={palm} />
      {fingerRoots.map((root, i) => (
        <primitive key={i} object={root} />
      ))}
    </group>
  )
})
