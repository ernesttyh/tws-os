'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  BarChart3, Calendar, FileText, Users, Megaphone, 
  Palette, ClipboardList 
} from 'lucide-react'

const tabs = [
  { href: '', label: 'Overview', icon: BarChart3 },
  { href: '/operations', label: 'Ops', mobileLabel: 'Ops', icon: ClipboardList },
  { href: '/calendar', label: 'Calendar', mobileLabel: 'Cal', icon: Calendar },
  { href: '/content', label: 'SMM', icon: FileText },
  { href: '/influencers', label: 'KOLs', mobileLabel: 'KOLs', icon: Users },
  { href: '/ads', label: 'Ads', icon: Megaphone },
  { href: '/design', label: 'Design', icon: Palette },
]

export default function BrandTabs({ slug }: { slug: string }) {
  const pathname = usePathname()
  const base = `/dashboard/brand/${slug}`

  return (
    <div className="flex gap-0.5 sm:gap-1 border-b overflow-x-auto scrollbar-hide -mx-3 sm:mx-0 px-3 sm:px-0" style={{ borderColor: 'var(--border)' }}>
      {tabs.map(tab => {
        const fullPath = base + tab.href
        const isActive = tab.href === '' 
          ? pathname === base
          : pathname.startsWith(fullPath)
        const Icon = tab.icon

        return (
          <Link key={tab.href} href={fullPath}
            className={`tab flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm whitespace-nowrap px-2 sm:px-3 py-2 ${isActive ? 'tab-active' : ''}`}>
            <Icon size={14} className="shrink-0" />
            <span className="sm:hidden">{tab.mobileLabel || tab.label}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
