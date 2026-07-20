"use client"

/**
 * Rigged FBX signer.
 *
 * Drives the imported Reallusion "Character Creator" rig
 * (public/models/SignerModelRigged.fbx) from the SAME PosePlayer output that
 * fed the old procedural avatar. The abstract per-frame hand targets and finger
 * curls are mapped onto the model's real skeleton:
 *
 *   - Each arm is posed with analytic two-bone IK (upperarm + forearm) that
 *     aims the model's actual bones at a world-space wrist target.
 *   - Each finger's three phalanx bones are curled around the finger's natural
 *     bend axis, relative to the model's bind pose.
 *
 * The rig was introspected offline: every bone's child extends along its local
 * +Y axis and fingers bend about local +X.
 */

import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { useFBX } from "@react-three/drei"
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js"
import * as THREE from "three"
import type { PosePlayer, Pose } from "@/lib/sign/pose-player"
import type { HandShape, FingerName } from "@/lib/sign/types"

// Abstract-avatar shoulder anchors used by the PosePlayer (see
// signer-avatar.tsx). Pose targets are relative to these, so we re-map them
// onto the model's own shoulder + reach.
//   "pos" = the +x side of the screen (the pose's right hand)
//   "neg" = the -x side of the screen (the pose's left hand)
const ABS_SHOULDER = {
  pos: new THREE.Vector3(0.2, 1.4, 0.02),
  neg: new THREE.Vector3(-0.2, 1.4, 0.02),
}
const ABS_REACH = 0.59 // UPPER_LEN + FORE_LEN of the abstract avatar.

// The model faces +Z (toward the camera), so its anatomical LEFT arm sits on
// the +x side of the screen. To preserve the exact on-screen placement of the
// previous avatar we drive:
//   pose.right (screen +x) -> model's L_* arm
//   pose.left  (screen -x) -> model's R_* arm
const ARMS = [
  { poseKey: "right" as const, abs: ABS_SHOULDER.pos, prefix: "CC_Base_L_" },
  { poseKey: "left" as const, abs: ABS_SHOULDER.neg, prefix: "CC_Base_R_" },
]

const FINGER_BONE: Record<FingerName, string> = {
  thumb: "Thumb",
  index: "Index",
  middle: "Mid",
  ring: "Ring",
  pinky: "Pinky",
}

// Curl tuning. Fingers bend about their local +X axis; a negative angle rolls
// the fingertips toward the palm for this rig.
const CURL_SIGN = -1
const FINGER_GAIN = [0.9, 1.15, 1.0] // proximal, middle, distal phalanx
const THUMB_GAIN = [0.55, 0.85, 0.7]
const BEND_AXIS = new THREE.Vector3(1, 0, 0)
const CHILD_AXIS = new THREE.Vector3(0, 1, 0) // every bone's child is along +Y

// Target shoulder height (scene units) so framing matches the old avatar.
const TARGET_SHOULDER_Y = 1.35

interface FingerJoint {
  bone: THREE.Bone
  rest: THREE.Quaternion
}

interface ArmRig {
  poseKey: "right" | "left"
  abs: THREE.Vector3
  upper: THREE.Bone
  fore: THREE.Bone
  hand: THREE.Bone
  shoulderWorld: THREE.Vector3
  upperLen: number
  foreLen: number
  reachWorld: number
  poleSign: number
  handRest: THREE.Quaternion
  fingers: Record<FingerName, FingerJoint[]>
}

// Per-frame scratch objects (no allocation in the render loop).
const _absVec = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _target = new THREE.Vector3()
const _toT = new THREE.Vector3()
const _mid = new THREE.Vector3()
const _pole = new THREE.Vector3()
const _poleProj = new THREE.Vector3()
const _elbow = new THREE.Vector3()
const _wrist = new THREE.Vector3()
const _pWorldQ = new THREE.Quaternion()
const _invPQ = new THREE.Quaternion()
const _desiredLocal = new THREE.Vector3()
const _aimQ = new THREE.Quaternion()
const _curlQ = new THREE.Quaternion()
const _outQ = new THREE.Quaternion()

function findBone(root: THREE.Object3D, name: string): THREE.Bone | null {
  let hit: THREE.Bone | null = null
  root.traverse((o) => {
    if (!hit && (o as THREE.Bone).isBone && o.name === name) hit = o as THREE.Bone
  })
  return hit
}

// Aim `bone` so its child (local +Y) points along `worldDir`.
function aimBone(bone: THREE.Bone, worldDir: THREE.Vector3) {
  const parent = bone.parent
  if (!parent) return
  parent.getWorldQuaternion(_pWorldQ)
  _invPQ.copy(_pWorldQ).invert()
  _desiredLocal.copy(worldDir).applyQuaternion(_invPQ).normalize()
  _aimQ.setFromUnitVectors(CHILD_AXIS, _desiredLocal)
  bone.quaternion.copy(_aimQ)
  bone.updateWorldMatrix(false, false)
}

// Analytic two-bone IK: aim the model's upperarm + forearm bones so the wrist
// reaches `target` (world space), bending the elbow toward a downward pole.
function solveArm(rig: ArmRig, target: THREE.Vector3) {
  const S = rig.shoulderWorld
  _toT.subVectors(target, S)
  const total = rig.upperLen + rig.foreLen
  const d = Math.min(_toT.length(), total - 1e-4)
  _dir.copy(_toT).normalize()

  const a = (rig.upperLen * rig.upperLen - rig.foreLen * rig.foreLen + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, rig.upperLen * rig.upperLen - a * a))
  _mid.copy(S).addScaledVector(_dir, a)
  _pole.set(rig.poleSign * 0.25, -1, -0.45).normalize()
  _poleProj.copy(_pole).addScaledVector(_dir, -_pole.dot(_dir))
  if (_poleProj.lengthSq() < 1e-6) _poleProj.set(0, -1, 0)
  _poleProj.normalize()
  _elbow.copy(_mid).addScaledVector(_poleProj, h)
  _wrist.copy(S).addScaledVector(_dir, d)

  _dir.subVectors(_elbow, S).normalize()
  aimBone(rig.upper, _dir)
  _dir.subVectors(_wrist, _elbow).normalize()
  aimBone(rig.fore, _dir)
  // Hand follows the forearm at its bind orientation.
  rig.hand.quaternion.copy(rig.handRest)
  rig.hand.updateWorldMatrix(false, false)
}

function applyFingers(rig: ArmRig, shape: HandShape) {
  for (const finger of Object.keys(FINGER_BONE) as FingerName[]) {
    const chain = rig.fingers[finger]
    if (!chain || !chain.length) continue
    const curl = shape.curl[finger] ?? 0
    const gain = finger === "thumb" ? THUMB_GAIN : FINGER_GAIN
    for (let i = 0; i < chain.length; i++) {
      const { bone, rest } = chain[i]
      const angle = CURL_SIGN * curl * (gain[i] ?? 1)
      _curlQ.setFromAxisAngle(BEND_AXIS, angle)
      _outQ.copy(rest).multiply(_curlQ)
      bone.quaternion.copy(_outQ)
    }
  }
}

export function FBXSigner({
  playerRef,
  url = "/models/SignerModelRigged.fbx",
}: {
  playerRef: React.MutableRefObject<PosePlayer>
  url?: string
}) {
  const fbx = useFBX(url)
  const model = useMemo(() => skeletonClone(fbx) as THREE.Group, [fbx])
  const arms = useRef<ArmRig[]>([])

  useEffect(() => {
    model.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh
      if (mesh.isMesh || mesh.isSkinnedMesh) {
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.frustumCulled = false
      }
    })

    // Scale so shoulders sit near TARGET_SHOULDER_Y, then plant feet on the
    // parent group's floor.
    model.scale.setScalar(1)
    model.position.set(0, 0, 0)
    model.updateWorldMatrix(true, true)
    const rShoulder = findBone(model, "CC_Base_R_Upperarm")
    const shoulderRaw = rShoulder ? rShoulder.getWorldPosition(new THREE.Vector3()).y : 33.8
    const scale = TARGET_SHOULDER_Y / (shoulderRaw || 33.8)
    model.scale.setScalar(scale)
    model.updateWorldMatrix(true, true)
    const box = new THREE.Box3().setFromObject(model)
    model.position.y = -box.min.y
    model.updateWorldMatrix(true, true)

    const rigs: ArmRig[] = []
    for (const arm of ARMS) {
      const upper = findBone(model, `${arm.prefix}Upperarm`)
      const fore = findBone(model, `${arm.prefix}Forearm`)
      const hand = findBone(model, `${arm.prefix}Hand`)
      if (!upper || !fore || !hand) continue

      const sPos = upper.getWorldPosition(new THREE.Vector3())
      const ePos = fore.getWorldPosition(new THREE.Vector3())
      const wPos = hand.getWorldPosition(new THREE.Vector3())
      const upperLen = sPos.distanceTo(ePos)
      const foreLen = ePos.distanceTo(wPos)

      const fingers = {} as ArmRig["fingers"]
      for (const finger of Object.keys(FINGER_BONE) as FingerName[]) {
        const chain: FingerJoint[] = []
        for (let i = 1; i <= 3; i++) {
          const b = findBone(model, `${arm.prefix}${FINGER_BONE[finger]}${i}`)
          if (b) chain.push({ bone: b, rest: b.quaternion.clone() })
        }
        fingers[finger] = chain
      }

      rigs.push({
        poseKey: arm.poseKey,
        abs: arm.abs,
        upper,
        fore,
        hand,
        shoulderWorld: sPos,
        upperLen,
        foreLen,
        reachWorld: upperLen + foreLen,
        poleSign: Math.sign(sPos.x) || 1,
        handRest: hand.quaternion.clone(),
        fingers,
      })
    }
    arms.current = rigs
  }, [model])

  useFrame((_, delta) => {
    const pose: Pose = playerRef.current.update(Math.min(delta, 0.05))
    const rigs = arms.current
    for (let i = 0; i < rigs.length; i++) {
      const rig = rigs[i]
      const hand = rig.poseKey === "right" ? pose.right : pose.left

      // Map the abstract target (relative to the abstract shoulder/reach) onto
      // this arm's own shoulder + reach, preserving world-space direction.
      _absVec.set(hand.pos[0], hand.pos[1], hand.pos[2])
      _dir.subVectors(_absVec, rig.abs)
      const frac = Math.min(_dir.length() / ABS_REACH, 1)
      _dir.normalize()
      _target.copy(rig.shoulderWorld).addScaledVector(_dir, frac * rig.reachWorld)

      solveArm(rig, _target)
      applyFingers(rig, hand.shape)
    }
  })

  return <primitive object={model} />
}

useFBX.preload("/models/SignerModelRigged.fbx")
