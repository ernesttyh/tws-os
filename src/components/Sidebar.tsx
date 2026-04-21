'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Brand, BrandGroup } from '@/lib/types'
import { BRAND_GROUPS } from '@/lib/types'
import { Search, LayoutDashboard, Settings, ChevronDown, ChevronRight } from 'lucide-react'

interface SidebarProps {
  onNavigate?: () => void
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ onNavigate, isOpen, onClose }: SidebarProps) {
  const [brands, setBrands] = useState<Brand[]>([])
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    supabase.from('brands').select('*').eq('status', 'active').order('name')
      .then(({ data }) => { if (data) setBrands(data) })
  }, [])

  const filtered = brands.filter(b => 
    b.name.toLowerCase().includes(search.toLowerCase())
  )

  const grouped = filtered.reduce((acc, b) => {
    const g = b.brand_group
    if (!acc[g]) acc[g] = []
    acc[g].push(b)
    return acc
  }, {} as Record<BrandGroup, Brand[]>)

  const groupOrder: BrandGroup[] = ['neo_group', 'penang_culture', 'fleursophy', 'deprosperoo', 'other']

  const toggleGroup = (g: string) => {
    setCollapsed(prev => ({ ...prev, [g]: !prev[g] }))
  }

  const handleNavClick = () => {
    if (onNavigate) onNavigate()
  }

  return (
    <aside className="w-full h-screen flex flex-col border-r" 
      style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
      
      {/* Logo */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <Link href="/dashboard" className="flex items-center gap-2" onClick={handleNavClick}>
          <span className="text-xl font-bold" style={{ color: 'var(--accent)' }}>TWS</span>
          <span className="text-xl font-light" style={{ color: 'var(--text-primary)' }}>OS</span>
        </Link>
      </div>

      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5" style={{ color: 'var(--text-secondary)' }} />
          <input
            type="text"
            placeholder="Search brands..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 text-xs"
            style={{ padding: '0.4rem 0.75rem 0.4rem 2rem' }}
          />
        </div>
      </div>

      {/* Dashboard link */}
      <div className="px-3 mb-1">
        <Link href="/dashboard"
          onClick={handleNavClick}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            pathname === '/dashboard' ? 'text-gray-900' : ''
          }`}
          style={{ 
            background: pathname === '/dashboard' ? 'var(--accent)' : 'transparent',
            color: pathname === '/dashboard' ? 'white' : 'var(--text-secondary)'
          }}>
          <LayoutDashboard size={16} />
          Dashboard
        </Link>
      </div>

      {/* Brand list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <div className="text-xs font-semibold uppercase tracking-wider mb-2 mt-3 px-3" 
          style={{ color: 'var(--text-secondary)' }}>
          Brands ({filtered.length})
        </div>

        {groupOrder.map(g => {
          const items = grouped[g]
          if (!items?.length) return null
          const isCollapsed = collapsed[g]

          return (
            <div key={g} className="mb-1">
              <button onClick={() => toggleGroup(g)}
                className="flex items-center gap-1 w-full px-3 py-1.5 text-xs font-medium rounded hover:bg-[var(--bg-hover)]"
                style={{ color: 'var(--text-secondary)' }}>
                {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                {BRAND_GROUPS[g]}
                <span className="ml-auto text-[10px] opacity-60">{items.length}</span>
              </button>

              {!isCollapsed && items.map(brand => {
                const isActive = pathname.includes(`/brand/${brand.slug}`)
                return (
                  <Link key={brand.id} href={`/dashboard/brand/${brand.slug}`}
                    onClick={handleNavClick}
                    className="flex items-center gap-2 px-3 py-1.5 ml-3 rounded-lg text-sm transition-all"
                    style={{
                      background: isActive ? 'var(--accent)' + '20' : 'transparent',
                      color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                      borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                    }}>
                    <span className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold"
                      style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                      {brand.name.charAt(0)}
                    </span>
                    <span className="truncate text-xs">{brand.name}</span>
                  </Link>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Settings */}
      <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <Link href="/dashboard/settings"
          onClick={handleNavClick}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
          style={{ color: 'var(--text-secondary)' }}>
          <Settings size={16} />
          Settings
        </Link>
      </div>
    </aside>
  )
}
