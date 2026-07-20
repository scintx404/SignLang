import { BrandMark } from "./icons"
import type { SessionState } from "./use-fluent-session"

export function TopBar({ state, knownCount }: { state: SessionState; knownCount: number }) {
  const isLive = state === "live"
  const statusText = isLive ? "Session live" : state === "connecting" ? "Starting" : "Session idle"

  return (
    <header className="flex flex-wrap items-center justify-between gap-5 border-b border-line pb-[22px]">
      <div className="flex items-center gap-3">
        <div className="shadow-soft grid size-[38px] flex-none place-items-center rounded-[11px] bg-ink text-paper">
          <BrandMark className="size-[22px]" />
        </div>
        <div>
          <div className="font-display text-[1.32rem] font-bold leading-none tracking-[-0.03em]">Fluent</div>
          <div className="mt-0.5 text-[0.78rem] text-ink-faint">Real-time sign &harr; speech interpreter</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="shadow-soft flex items-center gap-2 rounded-full border border-line bg-surface py-[7px] pl-3 pr-[14px] text-[0.85rem] font-medium text-ink-soft">
          <b className="font-semibold text-ink">English</b>
          <span className="text-[1.05rem] leading-none text-ink-faint">&rarr;</span>
          <b className="font-semibold text-ink">ASL</b>
          <span className="ml-1 text-ink-faint">&middot; {knownCount} signs</span>
        </div>
        <div
          className={`inline-flex items-center gap-2 rounded-full border px-[14px] py-2 text-[0.8rem] font-semibold tracking-[0.01em] transition-colors ${
            isLive ? "border-transparent bg-coral-wash text-coral-deep" : "border-line bg-surface-2 text-ink-soft"
          }`}
        >
          <span
            className={`size-2 rounded-full ${isLive ? "animate-fluent-pulse bg-coral" : "bg-ink-faint"}`}
            aria-hidden="true"
          />
          <span>{statusText}</span>
        </div>
      </div>
    </header>
  )
}
