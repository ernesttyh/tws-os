'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--accent)' }}>TWS OS</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>Marketing Command Center</p>
        </div>
        
        <form onSubmit={handleLogin} className="card space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@twsbranding.com"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          
          {error && (
            <div className="text-sm p-2 rounded" style={{ background: '#ef444420', color: '#ef4444' }}>
              {error}
            </div>
          )}
          
          <button type="submit" className="btn btn-primary w-full justify-center" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        
        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-secondary)' }}>
          Built for TWS. By TWS. The TWS Way.
        </p>
      </div>
    </div>
  )
}
