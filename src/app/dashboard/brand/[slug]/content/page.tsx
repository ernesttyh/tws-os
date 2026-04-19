'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ContentItem, Brand } from '@/lib/types'
import { Plus, X, ExternalLink } from 'lucide-react'

const STATUS_OPTIONS = ['idea','planned','in_progress','review','approved','scheduled','posted','rejected'] as const
const TYPE_OPTIONS = ['reel','carousel','static','story','video','tiktok','blog','edm','other'] as const

const statusBadge: Record<string, string> = {
  idea: 'badge-neutral', planned: 'badge-info', in_progress: 'badge-warning',
  review: 'badge-purple', approved: 'badge-success', scheduled: 'badge-info',
  posted: 'badge-success', rejected: 'badge-danger',
}

export default function ContentPage() {
  const params = useParams()
  const slug = params.slug as string
  const supabase = createClient()

  const [brand, setBrand] = useState<Brand | null>(null)
  const [items, setItems] = useState<ContentItem[]>([])
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const [editItem, setEditItem] = useState<ContentItem | null>(null)

  const [form, setForm] = useState({
    date: '', day_of_week: '', content_type: 'static' as const, title: '',
    contents: '', caption: '', hashtags: '', link: '', schedule_time: '',
    status: 'planned' as const, comments: '',
  })

  useEffect(() => { loadData() }, [slug])

  async function loadData() {
    const { data: b } = await supabase.from('brands').select('*').eq('slug', slug).single()
    if (!b) return
    setBrand(b)
    const { data } = await supabase.from('content_items').select('*').eq('brand_id', b.id).order('date', { ascending: false })
    setItems(data || [])
  }

  async function saveContent(e: React.FormEvent) {
    e.preventDefault()
    if (!brand) return
    const month = form.date ? new Date(form.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : ''

    if (editItem) {
      await supabase.from('content_items').update({ ...form, month }).eq('id', editItem.id)
    } else {
      await supabase.from('content_items').insert({ ...form, month, brand_id: brand.id })
    }
    setShowModal(false)
    setEditItem(null)
    setForm({ date: '', day_of_week: '', content_type: 'static', title: '', contents: '', caption: '', hashtags: '', link: '', schedule_time: '', status: 'planned', comments: '' })
    loadData()
  }

  function openEdit(item: ContentItem) {
    setEditItem(item)
    setForm({
      date: item.date || '', day_of_week: item.day_of_week || '', content_type: item.content_type,
      title: item.title || '', contents: item.contents || '', caption: item.caption || '',
      hashtags: item.hashtags || '', link: item.link || '', schedule_time: item.schedule_time || '',
      status: item.status, comments: item.comments || '',
    })
    setShowModal(true)
  }

  async function deleteItem(id: string) {
    await supabase.from('content_items').delete().eq('id', id)
    loadData()
  }

  async function quickStatus(id: string, status: string) {
    await supabase.from('content_items').update({ status }).eq('id', id)
    loadData()
  }

  const filtered = filter === 'all' ? items : items.filter(i => i.status === filter)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Content Plan</h2>
          {brand?.google_sheet_id && (
            <a href={`https://docs.google.com/spreadsheets/d/${brand.google_sheet_id}`} target="_blank"
              className="btn btn-ghost btn-sm" style={{ color: 'var(--accent)' }}>
              <ExternalLink size={12} /> Google Sheet
            </a>
          )}
        </div>
        <button onClick={() => { setEditItem(null); setShowModal(true) }} className="btn btn-primary btn-sm">
          <Plus size={14} /> Add Content
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        <button onClick={() => setFilter('all')} className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}>All ({items.length})</button>
        {STATUS_OPTIONS.map(s => {
          const count = items.filter(i => i.status === s).length
          if (count === 0) return null
          return <button key={s} onClick={() => setFilter(s)} className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`}>{s.replace('_',' ')} ({count})</button>
        })}
      </div>

      {/* Content table */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <p style={{ color: 'var(--text-secondary)' }}>No content items {filter !== 'all' ? `with status "${filter.replace('_',' ')}"` : 'yet'}</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Content</th>
                  <th>Status</th>
                  <th>Schedule</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id} className="cursor-pointer" onClick={() => openEdit(item)}>
                    <td className="whitespace-nowrap text-xs">
                      {item.date ? new Date(item.date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' }) : '—'}
                    </td>
                    <td><span className="badge badge-purple text-xs">{item.content_type}</span></td>
                    <td>
                      <div className="max-w-xs">
                        {item.title && <div className="font-medium text-sm">{item.title}</div>}
                        {item.contents && <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{item.contents}</div>}
                      </div>
                    </td>
                    <td>
                      <select
                        value={item.status}
                        onClick={e => e.stopPropagation()}
                        onChange={e => quickStatus(item.id, e.target.value)}
                        className="text-xs py-0.5 px-1"
                        style={{ width: 'auto', background: 'transparent', border: 'none' }}
                      >
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
                      </select>
                    </td>
                    <td className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item.schedule_time || '—'}</td>
                    <td>
                      <button onClick={e => { e.stopPropagation(); deleteItem(item.id) }} className="btn btn-ghost btn-sm"><X size={12} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Content Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); setEditItem(null) }}>
          <div className="modal" style={{ maxWidth: '40rem' }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">{editItem ? 'Edit Content' : 'New Content Item'}</h3>
              <button onClick={() => { setShowModal(false); setEditItem(null) }} className="btn btn-ghost btn-sm"><X size={16} /></button>
            </div>
            <form onSubmit={saveContent} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Type</label>
                  <select value={form.content_type} onChange={e => setForm(f => ({...f, content_type: e.target.value as any}))}>
                    {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value as any}))}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Title / Content Description</label>
                <input value={form.contents} onChange={e => setForm(f => ({...f, contents: e.target.value}))} placeholder="What is this content about?" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Caption</label>
                <textarea rows={3} value={form.caption} onChange={e => setForm(f => ({...f, caption: e.target.value}))} placeholder="Instagram caption..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Hashtags</label>
                  <input value={form.hashtags} onChange={e => setForm(f => ({...f, hashtags: e.target.value}))} placeholder="#food #singapore" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Schedule Time</label>
                  <input value={form.schedule_time} onChange={e => setForm(f => ({...f, schedule_time: e.target.value}))} placeholder="e.g. 12pm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Post Link</label>
                <input value={form.link} onChange={e => setForm(f => ({...f, link: e.target.value}))} placeholder="https://instagram.com/p/..." />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setShowModal(false); setEditItem(null) }} className="btn btn-secondary btn-sm">Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">{editItem ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
