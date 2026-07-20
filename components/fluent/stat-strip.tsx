"use client"

import { useEffect, useRef, useState } from "react"

function useCountUp(target: number) {
  const [value, setValue] = useState(target)
  const startRef = useRef(target)

  useEffect(() => {
    const start = startRef.current
    if (start === target) return
    const dur = 500
    const t0 = performance.now()
    let raf: number
    const step = (now: number) => {
      const p = Math.min((now - t0) / dur, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(start + (target - start) * eased))
      if (p < 1) raf = requestAnimationFrame(step)
      else startRef.current = target
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target])

  return value
}

export function StatStrip({ words, signs }: { words: number; signs: number }) {
  const wordCount = useCountUp(words)
  const signCount = useCountUp(signs)

  return (
    <footer className="mt-[22px] flex flex-wrap items-baseline gap-x-[clamp(20px,5vw,60px)] gap-y-4 border-t border-line pt-5">
      <Stat n={String(wordCount)} k="words translated" />
      <Stat n={String(signCount)} k="signs recognized" />
      <Stat n="42" unit=" ms" k="avg latency" />
      <Stat n="31" k="sign languages" />
      <p className="ml-auto max-w-[34ch] self-center text-[0.8rem] text-ink-faint">
        On-device hand tracking. Video never leaves the browser: only the translated text does.
      </p>
    </footer>
  )
}

function Stat({ n, unit, k }: { n: string; unit?: string; k: string }) {
  return (
    <div>
      <div className="font-display text-[1.55rem] font-bold tracking-[-0.02em] tabular-nums text-ink">
        {n}
        {unit && <span className="text-base">{unit}</span>}
      </div>
      <div className="mt-px text-[0.8rem] text-ink-faint">{k}</div>
    </div>
  )
}
