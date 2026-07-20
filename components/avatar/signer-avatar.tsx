"use client"

import { useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import { Hand, type HandHandle } from "./hand"
import type { PosePlayer, Pose } from "@/lib/sign/pose-player"

const SKIN = "#e2a17a"
const SHIRT = "#2c3350"
const SHIRT_DARK = "#232942"
const HAIR = "#3a2c25"

// Body anchor points (avatar units, ~meters).
const SHOULDER_R = new THREE.Vector3(0.2, 1.4, 0.02)
const SHOULDER_L = new THREE.Vector3(-0.2, 1.4, 0.02)
const UPPER_LEN = 0.3
const FORE_LEN = 0.29

// Reusable temporaries to avoid per-frame allocation.
const _toT = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _mid = new THREE.Vector3()
const _pole = new THREE.Vector3()
const _poleProj = new THREE.Vector3()
const _elbow = new THREE.Vector3()
const _wrist = new THREE.Vector3()
const _xA = new THREE.Vector3()
const _yA = new THREE.Vector3()
const _zA = new THREE.Vector3()
const _zHint = new THREE.Vector3(0, 0, 1)
const _basis = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _qWrist = new THREE.Quaternion()
const _eWrist = new THREE.Euler()
const UP = new THREE.Vector3(0, 1, 0)
const DEG = Math.PI / 180

interface ArmRefs {
  upper: THREE.Object3D
  fore: THREE.Object3D
  handWrap: THREE.Object3D
  hand: HandHandle
}

function solveArm(
  shoulder: THREE.Vector3,
  target: THREE.Vector3,
  side: number,
  refs: ArmRefs,
  shape: { wrist?: [number, number, number] },
) {
  _toT.subVectors(target, shoulder)
  const d = _toT.length()
  _dir.copy(_toT).normalize()
  const reach = UPPER_LEN + FORE_LEN - 1e-3
  const dc = Math.min(d, reach)

  // Elbow via law of cosines, bent toward a downward/back pole.
  const a = (UPPER_LEN * UPPER_LEN - FORE_LEN * FORE_LEN + dc * dc) / (2 * dc)
  const h = Math.sqrt(Math.max(0, UPPER_LEN * UPPER_LEN - a * a))
  _mid.copy(shoulder).addScaledVector(_dir, a)
  _pole.set(side * 0.35, -1, -0.45).normalize()
  _poleProj.copy(_pole).addScaledVector(_dir, -_pole.dot(_dir))
  if (_poleProj.lengthSq() < 1e-6) _poleProj.set(0, -1, 0)
  _poleProj.normalize()
  _elbow.copy(_mid).addScaledVector(_poleProj, h)
  _wrist.copy(shoulder).addScaledVector(_dir, dc)

  // Upper arm: shoulder -> elbow.
  refs.upper.position.copy(shoulder)
  _dir.subVectors(_elbow, shoulder).normalize()
  refs.upper.quaternion.setFromUnitVectors(UP, _dir)

  // Forearm: elbow -> wrist.
  refs.fore.position.copy(_elbow)
  _dir.subVectors(_wrist, _elbow).normalize()
  refs.fore.quaternion.setFromUnitVectors(UP, _dir)

  // Hand: seat at wrist, align +Y to forearm, keep palm facing forward, then
  // apply the frame's wrist rotation offset.
  refs.handWrap.position.copy(_wrist)
  _yA.copy(_dir)
  _xA.crossVectors(_yA, _zHint)
  if (_xA.lengthSq() < 1e-6) _xA.set(1, 0, 0)
  _xA.normalize()
  _zA.crossVectors(_xA, _yA).normalize()
  _basis.makeBasis(_xA, _yA, _zA)
  _q.setFromRotationMatrix(_basis)
  if (shape.wrist) {
    _eWrist.set(shape.wrist[0] * DEG, shape.wrist[1] * DEG, shape.wrist[2] * DEG)
    _qWrist.setFromEuler(_eWrist)
    _q.multiply(_qWrist)
  }
  refs.handWrap.quaternion.copy(_q)
}

export function SignerAvatar({ playerRef }: { playerRef: React.MutableRefObject<PosePlayer> }) {
  const rUpper = useRef<THREE.Mesh>(null)
  const rFore = useRef<THREE.Mesh>(null)
  const rHandWrap = useRef<THREE.Group>(null)
  const rHand = useRef<HandHandle>(null)
  const lUpper = useRef<THREE.Mesh>(null)
  const lFore = useRef<THREE.Mesh>(null)
  const lHandWrap = useRef<THREE.Group>(null)
  const lHand = useRef<HandHandle>(null)
  const torso = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)

  const targetR = useRef(new THREE.Vector3())
  const targetL = useRef(new THREE.Vector3())

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const pose: Pose = playerRef.current.update(dt)

    if (rUpper.current && rFore.current && rHandWrap.current && rHand.current) {
      targetR.current.set(pose.right.pos[0], pose.right.pos[1], pose.right.pos[2])
      solveArm(SHOULDER_R, targetR.current, 1, {
        upper: rUpper.current,
        fore: rFore.current,
        handWrap: rHandWrap.current,
        hand: rHand.current,
      }, pose.right.shape)
      rHand.current.applyShape(pose.right.shape)
    }

    if (lUpper.current && lFore.current && lHandWrap.current && lHand.current) {
      targetL.current.set(pose.left.pos[0], pose.left.pos[1], pose.left.pos[2])
      solveArm(SHOULDER_L, targetL.current, -1, {
        upper: lUpper.current,
        fore: lFore.current,
        handWrap: lHandWrap.current,
        hand: lHand.current,
      }, pose.left.shape)
      lHand.current.applyShape(pose.left.shape)
    }

    // Subtle breathing + idle sway so the figure feels alive.
    const t = state.clock.elapsedTime
    if (torso.current) {
      torso.current.scale.y = 1 + Math.sin(t * 1.1) * 0.006
      torso.current.rotation.y = Math.sin(t * 0.5) * 0.02
    }
    if (head.current) {
      head.current.rotation.y = Math.sin(t * 0.4) * 0.05
      head.current.rotation.x = Math.sin(t * 0.7) * 0.02
    }
  })

  return (
    <group position={[0, 0, 0]}>
      {/* Torso / clothing */}
      <group ref={torso} position={[0, 0, 0]}>
        <mesh position={[0, 1.12, 0]} castShadow>
          <capsuleGeometry args={[0.24, 0.34, 8, 20]} />
          <meshStandardMaterial color={SHIRT} roughness={0.85} />
        </mesh>
        {/* shoulders */}
        <mesh position={[0, 1.4, 0.02]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <capsuleGeometry args={[0.11, 0.4, 6, 16]} />
          <meshStandardMaterial color={SHIRT_DARK} roughness={0.85} />
        </mesh>
        {/* neck */}
        <mesh position={[0, 1.54, 0.01]} castShadow>
          <cylinderGeometry args={[0.055, 0.07, 0.12, 16]} />
          <meshStandardMaterial color={SKIN} roughness={0.7} />
        </mesh>
      </group>

      {/* Head */}
      <group ref={head} position={[0, 1.64, 0.01]}>
        <mesh castShadow>
          <sphereGeometry args={[0.13, 32, 32]} />
          <meshStandardMaterial color={SKIN} roughness={0.68} />
        </mesh>
        {/* hair cap */}
        <mesh position={[0, 0.03, -0.01]}>
          <sphereGeometry args={[0.135, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
          <meshStandardMaterial color={HAIR} roughness={0.9} />
        </mesh>
        {/* eyes */}
        <mesh position={[0.045, 0.0, 0.115]}>
          <sphereGeometry args={[0.016, 16, 16]} />
          <meshStandardMaterial color="#2a2320" roughness={0.4} />
        </mesh>
        <mesh position={[-0.045, 0.0, 0.115]}>
          <sphereGeometry args={[0.016, 16, 16]} />
          <meshStandardMaterial color="#2a2320" roughness={0.4} />
        </mesh>
      </group>

      {/* Right arm */}
      <mesh ref={rUpper} castShadow>
        <capsuleGeometry args={[0.045, UPPER_LEN, 6, 12]} />
        <meshStandardMaterial color={SHIRT} roughness={0.85} />
      </mesh>
      <mesh ref={rFore} castShadow>
        <capsuleGeometry args={[0.038, FORE_LEN, 6, 12]} />
        <meshStandardMaterial color={SKIN} roughness={0.72} />
      </mesh>
      <group ref={rHandWrap} scale={[1.35, 1.35, 1.35]}>
        <Hand ref={rHand} side="right" />
      </group>

      {/* Left arm */}
      <mesh ref={lUpper} castShadow>
        <capsuleGeometry args={[0.045, UPPER_LEN, 6, 12]} />
        <meshStandardMaterial color={SHIRT} roughness={0.85} />
      </mesh>
      <mesh ref={lFore} castShadow>
        <capsuleGeometry args={[0.038, FORE_LEN, 6, 12]} />
        <meshStandardMaterial color={SKIN} roughness={0.72} />
      </mesh>
      <group ref={lHandWrap} scale={[1.35, 1.35, 1.35]}>
        <Hand ref={lHand} side="left" />
      </group>
    </group>
  )
}
