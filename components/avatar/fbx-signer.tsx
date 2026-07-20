"use client"

/**
 * Rigged FBX signer.
 *
 * Drives the imported rigged model (public/models/SignerModelRigged7.fbx) from
 * the SAME PosePlayer output that fed the old procedural avatar. The abstract
 * per-frame hand targets and finger curls are mapped onto the model's real
 * skeleton:
 *
 *   - Each arm is posed with analytic two-bone IK (upperarm + forearm) that
 *     aims the model's actual bones at a world-space wrist target. The pose
 *     targets are the exact positions that were tuned for the old avatar, so
 *     the signing motion stays framed the same way on screen.
 *   - Each finger's three phalanx bones are curled around the finger's natural
 *     bend axis, relative to the model's bind pose.
 *
 * The rig was introspected offline: it is a Reallusion-style "CC_Base_*"
 * skeleton where every bone's child extends along its local +Y axis and
 * fingers bend about local +X. The shoulders sit at model-local Y ≈ 33.8.
 */

import { useEffect, useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { useFBX } from "@react-three/drei"
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js"
import * as THREE from "three"
import type { PosePlayer, Pose } from "@/lib/sign/pose-player"
import type { HandShape, FingerName } from "@/lib/sign/types"

// The model faces +Z (toward the camera), so its anatomical LEFT arm sits on
// the +x side of the screen. To preserve the exact on-screen placement of the
// previous avatar we drive:
//   pose.right (screen +x) -> model's L_* arm
//   pose.left  (screen -x) -> model's R_* arm
const ARMS = [
  { poseKey: "right" as const, prefix: "CC_Base_L_" },
  { poseKey: "left" as const, prefix: "CC_Base_R_" },
]

const FINGER_BONE: Record<FingerName, string> = {
  thumb: "Thumb",
  index: "Index",
  middle: "Mid",
  ring: "Ring",
  pinky: "Pinky",
}

// Curl tuning. Introspecting the rig shows each finger bone's child extends
// along local +Y, while the flexion hinge (the medial-lateral axis running
// ACROSS the fingers) is local +Z — NOT local +X, which points along world
// vertical and was previously swinging the fingers sideways instead of
// curling them. Rotating about local -Z folds the fingertips toward the palm
// (a positive angle hyperextended them backward over the back of the hand).
const CURL_SIGN = -1
const FINGER_GAIN = [0.9, 1.15, 1.0] // proximal, middle, distal phalanx
const THUMB_GAIN = [0.55, 0.85, 0.7]
const BEND_AXIS = new THREE.Vector3(0, 0, 1)
// The thumb's local frame is rotated ~45° off the other fingers, so it flexes
// about a blended axis rather than pure +Z.
const THUMB_BEND_AXIS = new THREE.Vector3(0, 0.35, 1).normalize()
const CHILD_AXIS = new THREE.Vector3(0, 1, 0) // every bone's child is along +Y

// The old procedural avatar placed its shoulder line at local Y = 1.4 inside
// the stage group; the camera framing was tuned around that. SIZE shrinks the
// whole figure (and, below, the pose targets with it) relative to that
// framing so the model doesn't dominate the viewport.
const SIZE = 0.82
const TARGET_SHOULDER_LOCAL_Y = 1.4 * SIZE

// The pose targets were authored for the old avatar whose chest front sat at
// stage-local z ≈ 0.16 with anchors at |x| ≈ 0.14. This model's torso is
// deeper and wider, so targets are re-anchored at runtime: pushed forward so
// they clear the measured chest front, and nudged outward from the sternum.
const OLD_ANCHOR_Z = 0.16
const FORWARD_MARGIN = 0.09
const X_GAIN = 1.25

interface FingerJoint {
  bone: THREE.Bone
  rest: THREE.Quaternion
}

interface ArmRig {
  poseKey: "right" | "left"
  upper: THREE.Bone
  fore: THREE.Bone
  hand: THREE.Bone
  shoulderWorld: THREE.Vector3
  upperLen: number
  foreLen: number
  poleSign: number
  handRest: THREE.Quaternion
  /** Pre-computed world-space IK target for the natural hanging-arm rest pose. */
  restWorld: THREE.Vector3
  fingers: Record<FingerName, FingerJoint[]>
}

// Per-frame scratch objects (no allocation in the render loop).
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
  const _twistQ = new THREE.Quaternion()
  const _handWorldQ = new THREE.Quaternion()
  const _faxis = new THREE.Vector3()

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

// Max wrist pronation applied at full rest so the palm rolls in to face the
// thigh instead of presenting forward/up. Radians.
const REST_PRONATION = 1.5

// Analytic two-bone IK: aim the model's upperarm + forearm bones so the wrist
// reaches `target` (world space), bending the elbow toward a downward pole.
// `restT` (0..1) blends in a pronation twist so the palm faces the body when
// the arm is hanging at rest.
function solveArm(rig: ArmRig, target: THREE.Vector3, restT = 0) {
  const S = rig.shoulderWorld
  _toT.subVectors(target, S)
  const total = rig.upperLen + rig.foreLen
  const d = Math.min(_toT.length(), total - 1e-4)
  _dir.copy(_toT).normalize()

  const a = (rig.upperLen * rig.upperLen - rig.foreLen * rig.foreLen + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, rig.upperLen * rig.upperLen - a * a))
  _mid.copy(S).addScaledVector(_dir, a)
  // Pole bends the elbow backward and slightly outward, which is how a human
  // arm naturally hangs at rest (elbow behind the shoulder plane). During
  // signing the targets are forward of the chest so the pole has less
  // influence there and the motion reads correctly.
  _pole.set(rig.poleSign * 0.15, -0.8, -0.6).normalize()
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

  // Rest-only pronation: roll the hand about the forearm's world axis
  // (elbow -> wrist) so the palm rolls in to face the thigh instead of
  // presenting forward. Done in world space then converted back to local so
  // it is true supination/pronation regardless of the bone's local axes.
  // At restT=0 (signing) nothing is applied.
  if (restT > 0) {
    _faxis.subVectors(_wrist, _elbow).normalize()
    _twistQ.setFromAxisAngle(_faxis, rig.poleSign * REST_PRONATION * restT)
    rig.hand.getWorldQuaternion(_handWorldQ)
    _handWorldQ.premultiply(_twistQ)
    const parent = rig.hand.parent
    if (parent) {
      parent.getWorldQuaternion(_pWorldQ)
      _invPQ.copy(_pWorldQ).invert()
      rig.hand.quaternion.copy(_invPQ).multiply(_handWorldQ)
    } else {
      rig.hand.quaternion.copy(_handWorldQ)
    }
    rig.hand.updateWorldMatrix(false, false)
  }
}

function applyFingers(rig: ArmRig, shape: HandShape) {
  for (const finger of Object.keys(FINGER_BONE) as FingerName[]) {
    const chain = rig.fingers[finger]
    if (!chain || !chain.length) continue
    const curl = shape.curl[finger] ?? 0
    const isThumb = finger === "thumb"
    const gain = isThumb ? THUMB_GAIN : FINGER_GAIN
    const axis = isThumb ? THUMB_BEND_AXIS : BEND_AXIS
    // The two hands are mirrored: each finger bone's child direction points to
    // opposite world sides, so a shared rotation sign curls one hand inward and
    // the other outward. Flip the sign for the left rig so both fold toward
    // their own palm.
    const sideSign = rig.poseKey === "left" ? -1 : 1
    for (let i = 0; i < chain.length; i++) {
      const { bone, rest } = chain[i]
      const angle = CURL_SIGN * sideSign * curl * (gain[i] ?? 1)
      _curlQ.setFromAxisAngle(axis, angle)
      _outQ.copy(rest).multiply(_curlQ)
      bone.quaternion.copy(_outQ)
    }
  }
}

export function FBXSigner({
  playerRef,
  url = "/models/SignerModelRigged7.fbx",
}: {
  playerRef: React.MutableRefObject<PosePlayer>
  url?: string
}) {
  const fbx = useFBX(url)
  const model = useMemo(() => skeletonClone(fbx) as THREE.Group, [fbx])
  const arms = useRef<ArmRig[]>([])
  const zShiftRef = useRef(0)

  useEffect(() => {
    // The FBX ships a single UV-mapped material whose color comes from an
    // external "baseColor.jpg" texture (referenced by relative path, NOT
    // embedded in the file). We build one shared MeshStandardMaterial that
    // keeps the model's UVs and try to load that texture from
    // `/models/baseColor.jpg`. If the texture is present it shows the real
    // model colors; if it's missing we fall back to a neutral skin tone so the
    // figure is still clearly lit instead of rendering black.
    const skin = new THREE.MeshStandardMaterial({
      color: "#c8a488",
      roughness: 0.62,
      metalness: 0.0,
    })

    new THREE.TextureLoader().load(
      "/models/baseColor.jpg",
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        // FBX exports keep the default top-up texture orientation (unlike
        // glTF), so we leave tex.flipY at its default (true) to match the UVs.
        tex.anisotropy = 8
        skin.map = tex
        skin.color.set("#ffffff") // let the texture drive the color unmodulated
        skin.needsUpdate = true
        console.log("[v0] fbx rig: baseColor.jpg loaded, showing model textures")
      },
      undefined,
      () => {
        console.log("[v0] fbx rig: /models/baseColor.jpg not found — using skin fallback color")
      },
    )

    model.traverse((o) => {
      const mesh = o as THREE.SkinnedMesh
      if (mesh.isMesh || mesh.isSkinnedMesh) {
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.frustumCulled = false
        const old = mesh.material
        if (Array.isArray(old)) old.forEach((m) => m?.dispose?.())
        else old?.dispose?.()
        mesh.material = skin
      }
    })

    const rShoulder = findBone(model, "CC_Base_R_Upperarm")

    // Scale the model so its shoulder line sits at TARGET_SHOULDER_LOCAL_Y in
    // the stage group. We measure the shoulder height in the model's own local
    // frame (parent-independent) so the math holds regardless of the group
    // offset. The camera frames the upper body, so shoulder height — not foot
    // height — is what must stay locked.
    model.scale.setScalar(1)
    model.position.set(0, 0, 0)
    model.updateWorldMatrix(true, true)
    const shoulderLocalUnscaled = rShoulder
      ? model.worldToLocal(rShoulder.getWorldPosition(new THREE.Vector3())).y
      : 33.8
    const scale = TARGET_SHOULDER_LOCAL_Y / (shoulderLocalUnscaled || 33.8)
    model.scale.setScalar(scale)
    // Feet at group-local 0: shoulder height above origin is now
    // shoulderLocalUnscaled * scale === TARGET_SHOULDER_LOCAL_Y, so origin sits
    // at 0 and the shoulder lands exactly on target.
    model.position.y = TARGET_SHOULDER_LOCAL_Y - shoulderLocalUnscaled * scale
    // NOTE: must be updateMatrixWorld (not updateWorldMatrix) so SkinnedMesh's
    // override refreshes bindMatrixInverse after the rescale; otherwise
    // skinned-vertex sampling below reads through a stale bind matrix.
    model.updateMatrixWorld(true)
    // Measure the REAL deformed body bounds by sampling skinned vertices.
    // Box3.setFromObject is useless here: it reads raw (un-skinned) geometry,
    // which for this FBX collapses to a ~10cm blob at the feet.
    const box = new THREE.Box3()
    const _v = new THREE.Vector3()
    model.traverse((o) => {
      const m = o as THREE.SkinnedMesh
      if (!m.isMesh && !m.isSkinnedMesh) return
      const posAttr = m.geometry?.attributes?.position
      if (!posAttr) return
      m.skeleton?.update()
      const stride = Math.max(1, Math.floor(posAttr.count / 5000))
      for (let i = 0; i < posAttr.count; i += stride) {
        if (m.isSkinnedMesh) {
          m.getVertexPosition(i, _v)
          _v.applyMatrix4(m.matrixWorld)
        } else {
          _v.fromBufferAttribute(posAttr, i).applyMatrix4(m.matrixWorld)
        }
        box.expandByPoint(_v)
      }
    })

    // Center horizontally on the sampled bounds.
    const parent = model.parent
    const centerX = (box.min.x + box.max.x) / 2
    model.position.x += (parent ? parent.position.x : 0) - centerX
    model.updateMatrixWorld(true)

    // Measure the front of the body (stage-group local z; the group has no
    // rotation/scale, so world z equals stage-local z). Pose targets whose z
    // was authored against the old avatar's chest (z ≈ 0.16) are shifted so
    // the same offsets now land just in front of THIS model's chest.
    const chestFrontZ = box.max.z
    zShiftRef.current = chestFrontZ + FORWARD_MARGIN - OLD_ANCHOR_Z * SIZE
    console.log(
      "[v0] fbx rig: scale=", scale.toFixed(4),
      "box=", JSON.stringify({ min: box.min.toArray().map((n) => +n.toFixed(2)), max: box.max.toArray().map((n) => +n.toFixed(2)) }),
      "chestFrontZ=", chestFrontZ.toFixed(3),
      "zShift=", zShiftRef.current.toFixed(3),
    )

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

      const poleSign = Math.sign(sPos.x) || 1
      // Natural hanging-arm rest target: wrist hangs ~85% of full reach below
      // the shoulder, nudged outward by 4% of total arm length so the IK pole
      // has a stable lateral direction. z matches the shoulder so the arm
      // drapes straight down without reaching forward or backward.
      const reach = upperLen + foreLen
      const restWorld = new THREE.Vector3(
        sPos.x + poleSign * reach * 0.04,
        sPos.y - reach * 0.85,
        sPos.z,
      )
      rigs.push({
        poseKey: arm.poseKey,
        upper,
        fore,
        hand,
        shoulderWorld: sPos,
        upperLen,
        foreLen,
        poleSign,
        handRest: hand.quaternion.clone(),
        restWorld,
        fingers,
      })
    }
    arms.current = rigs
  }, [model])

  useFrame((_, delta) => {
    const pose: Pose = playerRef.current.update(Math.min(delta, 0.05))
    const rigs = arms.current
    const parent = model.parent
    for (let i = 0; i < rigs.length; i++) {
      const rig = rigs[i]
      const hand = rig.poseKey === "right" ? pose.right : pose.left

      // Convert the pose target from stage-group local space to world space.
      _target.set(hand.pos[0] * SIZE * X_GAIN, hand.pos[1] * SIZE, hand.pos[2] * SIZE + zShiftRef.current)
      if (parent) parent.localToWorld(_target)

      // When the hand dips below the signing zone, blend the IK target toward
      // the rig's pre-computed natural hanging-arm position so the arm looks
      // correct in rest regardless of the pose-player constants.
      // Signing anchors sit at world y ≈ shoulder.y - 0.30; rest starts
      // blending at shoulder.y - 0.35 and is fully in effect at - 0.50.
      const blendStart = rig.shoulderWorld.y - 0.35
      const t = Math.max(0, Math.min(1, (blendStart - _target.y) / 0.15))
      if (t > 0) {
        _target.lerp(rig.restWorld, t)
      }

      solveArm(rig, _target, t)
      applyFingers(rig, hand.shape)
    }
  })

  return <primitive object={model} />
}

useFBX.preload("/models/SignerModelRigged7.fbx")
