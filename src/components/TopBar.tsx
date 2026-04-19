'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut, Bell } from 'lucide-react'

export default function TopBar() {
  const supabase = createClient()
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-14 border-b flex items-center justify-between px-6"
      style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
      <div />
      <div className="flex items-center gap-3">
        <button className="btn btn-ghost btn-sm">
          <Bell size={16} />
        </button>
        <button onClick={handleLogout} className="btn btn-ghost btn-sm">
          <LogOut size={16} />
          <span className="text-xs">Sign out</span>
        </button>
      </div>
    </header>
  )
}
