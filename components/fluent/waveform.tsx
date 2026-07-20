"use client"

import { useEffect, useRef } from "react"

const WAVE_BARS = 48

export function Waveform({ active }: { active: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active) return
    const bars = containerRef.current?.querySelectorAll<HTMLSpanElement>("span")
    if (!bars || bars.length === 0) return
    let raf: number

    const anim = () => {
      const t = performance.now() / 1000
      bars.forEach((s, i) => {
        const base = 0.25 + 0.6 * Math.abs(Math.sin(t * 3 + i * 0.4)) * (0.5 + 0.5 * Math.sin(t * 1.3 + i))
        s.style.transform = `scaleY(${Math.max(0.08, Math.min(base, 1))})`
      })
      raf = requestAnimationFrame(anim)
    }
    anim()
    return () => cancelAnimationFrame(raf)
  }, [active])

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-x-4 bottom-4 flex h-[46px] items-end gap-[3px]"
      aria-hidden="true"
    >
      {Array.from({ length: WAVE_BARS }).map((_, i) => (
        <span
          key={i}
          className="min-w-0.5 flex-1 origin-bottom rounded-full bg-violet opacity-85 transition-transform duration-[90ms] ease-linear"
          style={{ height: "10%" }}
        />
      ))}
    </div>
  )
}
