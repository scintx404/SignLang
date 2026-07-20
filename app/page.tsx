import { Dashboard } from '@/components/dashboard'
import { SiteHeader } from '@/components/site-header'

export default function Home() {
  return (
    <div className="flex h-dvh flex-col">
      <SiteHeader />
      <Dashboard />
    </div>
  )
}
