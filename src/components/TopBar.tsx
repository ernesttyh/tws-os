'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut, Bell, Menu } from 'lucide-react'

interface TopBarProps {
  onMenuToggle?: () => void
}

export default function TopBar({ onMenuToggle }: TopBarProps) {
  const supabase = createClient()
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-14 border-b flex items-center justify-between px-3 sm:px-6"
      style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-2">
        {/* Hamburger — mobile only */}
        <button 
          onClick={onMenuToggle} 
          className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-[var(--bg-hover)] transition"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Menu size={20} />
        </button>
        {/* Mobile logo */}
        <span className="lg:hidden text-sm font-bold" style={{ color: 'var(--accent)' }}>TWS<span className="font-light ml-0.5" style={{ color: 'var(--text-primary)' }}>OS</span></span>
      </div>
      <div className="flex items-center gap-1 sm:gap-3">
        <button className="btn btn-ghost btn-sm">
          <Bell size={16} />
        </button>
        <button onClick={handleLogout} className="btn btn-ghost btn-sm">
          <LogOut size={16} />
          <span className="text-xs hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  )
}
