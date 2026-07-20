import { Hand } from 'lucide-react'

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between border-b px-4 py-3 md:px-6">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-md bg-primary">
          <Hand className="size-4.5 text-primary-foreground" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-sm font-bold leading-tight">SignBridge</h1>
          <p className="text-xs leading-tight text-muted-foreground">
            Real-time sign language translator
          </p>
        </div>
      </div>
      <div className="hidden items-center gap-2 sm:flex">
        <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          On-device AI — no data leaves your browser
        </span>
      </div>
    </header>
  )
}
