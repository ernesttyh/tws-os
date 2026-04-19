'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Brand, DesignBrief } from '@/lib/types'
import { Plus, X, Palette } from 'lucide-react'

const STATUS_FLOW = ['brief','in_progress','internal_review','client_review','revision','approved'] as const

const statusBadge: Record<string, string> = {
  brief: 'badge-info', in_progress: 'badge-warning', internal_review: 'badge-purple',
  client_review: 'badge-purple', revision: 'badge-danger', approved: 'badge-success',
}

export default function DesignPage() {
  const params = useParams()
  const slug = params.slug as string
  const supabase = createClient()

  const [brand, setBrand] = useState<Brand | null>(null)
  const [briefs, setBriefs] = useState<DesignBrief[]>([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', dimensions: '', deadline: '', drive_folder_url: '' })

  useEffect(() => { loadData() }, [slug])

  async function loadData() {
    const { data: b } = await supabase.from('brands').select('*').eq('slug', slug).single()
    if (!b) return
    setBrand(b)
    const { data } = await supabase.from('design_briefs').select('*').eq('brand_id', b.id).order('created_at', { ascending: false })
    setBriefs(data || [])
  }

  async function createBrief(e: React.FormEvent) {
    e.preventDefault()
    if (!brand) return
    await supabase.from('design_briefs').insert({ ...form, brand_id: brand.id, deadline: form.deadline || null })
    setShowModal(false)
    setForm({ title: '', description: '', dimensions: '', deadline: '', drive_folder_url: '' })
    loadData()
  }

  async function updateStatus(id: string, status: string) {
    const updates: any = { status }
    if (status === 'revision') {
      const brief = briefs.find(b => b.id === id)
      updates.revision_count = (brief?.revision_count || 0) + 1
    }
    await supabase.from('design_briefs').update(updates).eq('id', id)
    loadData()
  }

  async function deleteBrief(id: string) {
    await supabase.from('design_briefs').delete().eq('id', id)
    loadData()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Design Hub</h2>
        <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm"><Plus size={14} /> New Brief</button>
      </div>

      {/* Pipeline view */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STATUS_FLOW.map(status => (
          <div key={status} className="kanban-col min-w-[250px]">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className={`badge ${statusBadge[status]} text-xs`}>{status.replace('_', ' ')}</span>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{briefs.filter(b => b.status === status).length}</span>
            </div>
            {briefs.filter(b => b.status === status).map(brief => (
              <div key={brief.id} className="kanban-card">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium">{brief.title}</span>
                  <button onClick={() => deleteBrief(brief.id)} className="opacity-0 hover:opacity-100"><X size={12} style={{ color: 'var(--text-secondary)' }} /></button>
                </div>
                {brief.description && <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{brief.description}</p>}
                <div className="flex items-center justify-between mt-2">
                  {brief.dimensions && <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{brief.dimensions}</span>}
                  {brief.deadline && <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{new Date(brief.deadline).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}</span>}
                </div>
                {brief.revision_count > 0 && <span className="badge badge-danger text-[10px] mt-1">Rev {brief.revision_count}</span>}
                <div className="flex gap-1 mt-2 flex-wrap">
                  {STATUS_FLOW.filter(s => s !== status).map(s => (
                    <button key={s} onClick={() => updateStatus(brief.id, s)} className="btn btn-ghost text-[10px] px-1.5 py-0.5">{s.replace('_',' ')}</button>
                  ))}
                </div>
                {brief.drive_folder_url && <a href={brief.drive_folder_url} target="_blank" className="text-[10px] mt-1 block" style={{ color: 'var(--accent)' }}>Drive ↗</a>}
              </div>
            ))}
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">New Design Brief</h3>
              <button onClick={() => setShowModal(false)} className="btn btn-ghost btn-sm"><X size={16} /></button>
            </div>
            <form onSubmit={createBrief} className="space-y-4">
              <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Title</label>
                <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder="e.g. June Promo Banner" required /></div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Description / Brief</label>
                <textarea rows={3} value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder="Design requirements, references..." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Dimensions</label>
                  <input value={form.dimensions} onChange={e => setForm(f => ({...f, dimensions: e.target.value}))} placeholder="e.g. 1080x1080, A4" /></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Deadline</label>
                  <input type="date" value={form.deadline} onChange={e => setForm(f => ({...f, deadline: e.target.value}))} /></div>
              </div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Google Drive Folder URL</label>
                <input value={form.drive_folder_url} onChange={e => setForm(f => ({...f, drive_folder_url: e.target.value}))} placeholder="https://drive.google.com/..." /></div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary btn-sm">Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">Create Brief</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
