import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function BrandOverviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  
  const { data: brand } = await supabase.from('brands').select('*').eq('slug', slug).single()
  if (!brand) notFound()

  const { data: tasks } = await supabase.from('tasks').select('*').eq('brand_id', brand.id)
  const { data: content } = await supabase.from('content_items').select('*').eq('brand_id', brand.id)
  const { data: meetings } = await supabase.from('meeting_minutes').select('*').eq('brand_id', brand.id).order('meeting_date', { ascending: false }).limit(5)
  const { data: shoots } = await supabase.from('shoot_briefs').select('*').eq('brand_id', brand.id).order('shoot_date', { ascending: false }).limit(5)
  const { data: designs } = await supabase.from('design_briefs').select('*').eq('brand_id', brand.id)

  const activeTasks = (tasks || []).filter(t => !['done','archived'].includes(t.status)).length
  const postedContent = (content || []).filter(c => c.status === 'posted').length
  const openDesigns = (designs || []).filter(d => d.status !== 'approved').length

  return (
    <div className="space-y-6">
      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Active Tasks', value: activeTasks, color: activeTasks > 5 ? 'var(--warning)' : 'var(--text-primary)' },
          { label: 'Content Items', value: content?.length || 0, color: 'var(--text-primary)' },
          { label: 'Posted', value: postedContent, color: 'var(--success)' },
          { label: 'Meetings', value: meetings?.length || 0, color: 'var(--text-primary)' },
          { label: 'Open Designs', value: openDesigns, color: openDesigns > 0 ? 'var(--accent)' : 'var(--text-primary)' },
        ].map(s => (
          <div key={s.label} className="card">
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{s.label}</div>
            <div className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Brand info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-sm font-semibold mb-3">Brand Info</h3>
          <div className="space-y-2 text-sm">
            {brand.website_url && <div><span style={{ color: 'var(--text-secondary)' }}>Website:</span> <a href={brand.website_url} target="_blank" className="hover:underline" style={{ color: 'var(--accent)' }}>{brand.website_url}</a></div>}
            {brand.instagram_handle && <div><span style={{ color: 'var(--text-secondary)' }}>Instagram:</span> @{brand.instagram_handle}</div>}
            {brand.google_sheet_id && <div><span style={{ color: 'var(--text-secondary)' }}>Content Sheet:</span> <a href={`https://docs.google.com/spreadsheets/d/${brand.google_sheet_id}`} target="_blank" className="hover:underline" style={{ color: 'var(--accent)' }}>Open in Google Sheets ↗</a></div>}
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold mb-3">Recent Meetings</h3>
          {meetings && meetings.length > 0 ? (
            <div className="space-y-2">
              {meetings.map(m => (
                <div key={m.id} className="flex items-center justify-between text-sm">
                  <span>{m.title}</span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {new Date(m.meeting_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No meetings logged yet</p>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="card">
        <h3 className="text-sm font-semibold mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          <Link href={`/dashboard/brand/${slug}/operations`} className="btn btn-secondary btn-sm">+ Log Meeting</Link>
          <Link href={`/dashboard/brand/${slug}/content`} className="btn btn-secondary btn-sm">+ Add Content</Link>
          <Link href={`/dashboard/brand/${slug}/operations`} className="btn btn-secondary btn-sm">+ Create Task</Link>
          <Link href={`/dashboard/brand/${slug}/design`} className="btn btn-secondary btn-sm">+ Design Brief</Link>
          <Link href={`/dashboard/brand/${slug}/calendar`} className="btn btn-secondary btn-sm">+ Key Date</Link>
        </div>
      </div>
    </div>
  )
}
