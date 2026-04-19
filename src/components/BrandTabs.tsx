'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  BarChart3, Calendar, FileText, Users, Megaphone, 
  Palette, ClipboardList 
} from 'lucide-react'

const tabs = [
  { href: '', label: 'Overview', icon: BarChart3 },
  { href: '/operations', label: 'Operations', icon: ClipboardList },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/content', label: 'SMM', icon: FileText },
  { href: '/influencers', label: 'Influencers', icon: Users },
  { href: '/ads', label: 'Ads', icon: Megaphone },
  { href: '/design', label: 'Design', icon: Palette },
]

export default function BrandTabs({ slug }: { slug: string }) {
  const pathname = usePathname()
  const base = `/dashboard/brand/${slug}`

  return (
    <div className="flex gap-1 border-b overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
      {tabs.map(tab => {
        const fullPath = base + tab.href
        const isActive = tab.href === '' 
          ? pathname === base
          : pathname.startsWith(fullPath)
        const Icon = tab.icon

        return (
          <Link key={tab.href} href={fullPath}
            className={`tab flex items-center gap-1.5 ${isActive ? 'tab-active' : ''}`}>
            <Icon size={14} />
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
