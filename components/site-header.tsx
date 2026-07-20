'use client'

import { ArrowLeftRight, Hand } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Mode } from '@/components/dashboard'

interface SiteHeaderProps {
  mode: Mode
  cameraLive: boolean
  listening: boolean
}

export function SiteHeader({ mode, cameraLive, listening }: SiteHeaderProps) {
  const live = mode === 'sign' ? cameraLive : listening
  const liveLabel = mode === 'sign' ? 'Camera live' : 'Mic live'
  const idleLabel = mode === 'sign' ? 'Camera off' : 'Mic off'

  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 md:px-6">
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary">
          <Hand className="size-4.5 text-primary-foreground" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-sm font-bold leading-tight tracking-tight">SignBridge</h1>
          <p className="hidden text-xs leading-tight text-muted-foreground sm:block">
            On-device sign language interpreter
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="flex items-center gap-2 rounded-full border bg-card px-3.5 py-2 text-xs font-semibold shadow-sm">
          ASL
          <ArrowLeftRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
          English
        </span>
        <span
          className={cn(
            'flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors duration-300',
            live ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
          )}
        >
          <span className="relative flex size-2">
            {live && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-70" />
            )}
            <span
              className={cn(
                'relative inline-flex size-2 rounded-full transition-colors',
                live ? 'bg-primary' : 'bg-muted-foreground/50'
              )}
            />
          </span>
          <span className="hidden sm:inline">{live ? liveLabel : idleLabel}</span>
        </span>
      </div>
    </header>
  )
}
