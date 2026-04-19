import { createClient } from '@/lib/supabase/server'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      
      <div className="card mb-6">
        <h3 className="text-sm font-semibold mb-3">Account</h3>
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Logged in as: <span style={{ color: 'var(--text-primary)' }}>{user?.email}</span>
        </div>
      </div>

      <div className="card mb-6">
        <h3 className="text-sm font-semibold mb-3">Team Management</h3>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Coming soon — manage team members, roles, and brand assignments.
        </p>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold mb-3">System</h3>
        <div className="text-sm space-y-1" style={{ color: 'var(--text-secondary)' }}>
          <div>Version: <span style={{ color: 'var(--text-primary)' }}>1.0.0</span></div>
          <div>Platform: <span style={{ color: 'var(--text-primary)' }}>TWS OS</span></div>
        </div>
      </div>
    </div>
  )
}
