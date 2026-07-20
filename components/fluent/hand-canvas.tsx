"use client"

import { useEffect, useRef } from "react"
import { HAND_BASE, HAND_FINGERS, HAND_MCP, HAND_CONNS, FINGER_TIPS } from "@/lib/fluent/scripts"

type Pt = [number, number]

function computeHand(cx: number, cy: number, scale: number, rot: number, curls: number[]): Pt[] {
  const pts: Pt[] = HAND_BASE.map((p) => [p[0], p[1]])
  HAND_FINGERS.forEach((fg, fi) => {
    const mcp = HAND_BASE[HAND_MCP[fi]]
    const c = curls[fi]
    fg.forEach((idx, j) => {
      if (j === 0) return
      const pull = c * (0.32 * j)
      pts[idx][0] = HAND_BASE[idx][0] + (mcp[0] - HAND_BASE[idx][0]) * pull
      pts[idx][1] = HAND_BASE[idx][1] + (mcp[1] - HAND_BASE[idx][1]) * pull
    })
  })
  const cosr = Math.cos(rot)
  const sinr = Math.sin(rot)
  return pts.map(([x, y]) => {
    const rx = x * cosr - y * sinr
    const ry = x * sinr + y * cosr
    return [cx + rx * scale, cy + ry * scale] as Pt
  })
}

function drawHand(ctx: CanvasRenderingContext2D, pts: Pt[], color: string, glow: string) {
  ctx.lineJoin = "round"
  ctx.lineCap = "round"
  ctx.shadowColor = glow
  ctx.shadowBlur = 12
  ctx.strokeStyle = color
  ctx.lineWidth = 2.4
  ctx.beginPath()
  HAND_CONNS.forEach(([a, b]) => {
    ctx.moveTo(pts[a][0], pts[a][1])
    ctx.lineTo(pts[b][0], pts[b][1])
  })
  ctx.stroke()
  ctx.shadowBlur = 0
  pts.forEach((p, i) => {
    const isTip = FINGER_TIPS.includes(i)
    ctx.beginPath()
    ctx.arc(p[0], p[1], isTip ? 4.6 : 3, 0, Math.PI * 2)
    ctx.fillStyle = isTip ? "#fff" : color
    ctx.fill()
    if (isTip) {
      ctx.lineWidth = 1.5
      ctx.strokeStyle = color
      ctx.stroke()
    }
  })
}

export function HandCanvas({ mode, active }: { mode: "sign" | "voice"; active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const modeRef = useRef(mode)
  modeRef.current = mode

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let rafId: number | null = null

    const resize = () => {
      const r = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = r.width * dpr
      canvas.height = r.height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener("resize", resize)

    const styles = getComputedStyle(document.documentElement)
    const coral = styles.getPropertyValue("--color-coral").trim() || "#e0563d"
    const violet = styles.getPropertyValue("--color-violet").trim() || "#7b52cf"

    const loop = () => {
      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      ctx.clearRect(0, 0, w, h)
      const t = performance.now() / 1000

      if (modeRef.current === "sign") {
        const cx = w * 0.5
        const cy = h * 0.62
        const scale = h * 0.62
        const rot = Math.sin(t * 0.9) * 0.18 - 0.05
        const curls = [
          0.15 + 0.15 * Math.sin(t * 1.3),
          0.1 + 0.35 * Math.abs(Math.sin(t * 0.8)),
          0.1 + 0.35 * Math.abs(Math.sin(t * 0.8 + 0.6)),
          0.15 + 0.35 * Math.abs(Math.sin(t * 0.8 + 1.1)),
          0.2 + 0.35 * Math.abs(Math.sin(t * 0.8 + 1.6)),
        ]
        const dx = Math.sin(t * 0.7) * w * 0.03
        const dy = Math.cos(t * 0.55) * h * 0.02
        drawHand(ctx, computeHand(cx + dx, cy + dy, scale, rot, curls), coral, "rgba(224,86,61,0.55)")
      } else {
        const scale = h * 0.5
        const cyy = h * 0.6
        const spread = w * 0.17
        const rotL = -0.25 + Math.sin(t * 1.1) * 0.2
        const rotR = 0.25 - Math.sin(t * 1.1 + 0.4) * 0.2
        const cL = [0.2 + 0.3 * Math.abs(Math.sin(t * 1.2)), 0.2, 0.2, 0.25, 0.3]
        const cR = [0.2 + 0.3 * Math.abs(Math.sin(t * 1.2 + 0.9)), 0.3, 0.25, 0.2, 0.2]
        drawHand(ctx, computeHand(w * 0.5 - spread, cyy + Math.sin(t * 0.9) * h * 0.03, scale, rotL, cL), violet, "rgba(123,82,207,0.55)")
        drawHand(ctx, computeHand(w * 0.5 + spread, cyy + Math.cos(t * 0.9) * h * 0.03, scale, rotR, cR), violet, "rgba(123,82,207,0.55)")
      }
      rafId = requestAnimationFrame(loop)
    }

    if (active) {
      loop()
    } else {
      const rect = canvas.getBoundingClientRect()
      ctx.clearRect(0, 0, rect.width, rect.height)
    }

    return () => {
      window.removeEventListener("resize", resize)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [active])

  return <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" aria-hidden="true" />
}
