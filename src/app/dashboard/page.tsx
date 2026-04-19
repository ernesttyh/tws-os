import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: brands } = await supabase
    .from('brands')
    .select('*')
    .eq('status', 'active')
    .order('name')

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, brand_id, status')
  
  const { data: content } = await supabase
    .from('content_items')
    .select('id, brand_id, status')

  const { data: meetings } = await supabase
    .from('meeting_minutes')
    .select('id, brand_id, meeting_date')

  const { data: shoots } = await supabase
    .from('shoot_briefs')
    .select('id, brand_id, shoot_date, status')

  // Build stats per brand
  const brandStats = (brands || []).map(brand => {
    const brandTasks = (tasks || []).filter(t => t.brand_id === brand.id)
    const brandContent = (content || []).filter(c => c.brand_id === brand.id)
    const brandMeetings = (meetings || []).filter(m => m.brand_id === brand.id)
    const brandShoots = (shoots || []).filter(s => s.brand_id === brand.id)
    
    const activeTasks = brandTasks.filter(t => !['done', 'archived'].includes(t.status)).length
    const totalContent = brandContent.length
    const postedContent = brandContent.filter(c => c.status === 'posted').length
    const meetingCount = brandMeetings.length
    const shootCount = brandShoots.filter(s => s.status !== 'cancelled').length

    return { brand, activeTasks, totalContent, postedContent, meetingCount, shootCount }
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {brands?.length || 0} active brands
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="card">
          <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Active Brands</div>
          <div className="text-2xl font-bold mt-1">{brands?.length || 0}</div>
        </div>
        <div className="card">
          <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Open Tasks</div>
          <div className="text-2xl font-bold mt-1">{(tasks || []).filter(t => !['done','archived'].includes(t.status)).length}</div>
        </div>
        <div className="card">
          <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Content Items</div>
          <div className="text-2xl font-bold mt-1">{content?.length || 0}</div>
        </div>
        <div className="card">
          <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Shoots Planned</div>
          <div className="text-2xl font-bold mt-1">{(shoots || []).filter(s => s.status === 'planned').length}</div>
        </div>
      </div>

      {/* Brand health table */}
      <div className="card p-0 overflow-hidden">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Brand</th>
                <th>Group</th>
                <th>Tasks</th>
                <th>Content</th>
                <th>Meetings</th>
                <th>Shoots</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {brandStats.map(({ brand, activeTasks, totalContent, postedContent, meetingCount, shootCount }) => (
                <tr key={brand.id}>
                  <td>
                    <Link href={`/dashboard/brand/${brand.slug}`} className="font-medium hover:underline" style={{ color: 'var(--accent)' }}>
                      {brand.name}
                    </Link>
                  </td>
                  <td>
                    <span className="badge badge-neutral">{brand.brand_group.replace('_', ' ')}</span>
                  </td>
                  <td>
                    <span className={activeTasks > 0 ? 'font-medium' : ''} style={{ color: activeTasks > 5 ? 'var(--warning)' : 'var(--text-primary)' }}>
                      {activeTasks}
                    </span>
                  </td>
                  <td>
                    <span>{postedContent}/{totalContent}</span>
                  </td>
                  <td>{meetingCount}</td>
                  <td>{shootCount}</td>
                  <td>
                    <Link href={`/dashboard/brand/${brand.slug}`} className="btn btn-ghost btn-sm">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
