'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Brand } from '@/lib/types'
import { Plus, X, TrendingUp, DollarSign } from 'lucide-react'

export default function AdsPage() {
  const params = useParams()
  const slug = params.slug as string
  const supabase = createClient()

  const [brand, setBrand] = useState<Brand | null>(null)
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ campaign_name: '', platform: 'facebook', objective: '', budget_daily: '', budget_total: '', start_date: '', status: 'active', notes: '' })

  useEffect(() => { loadData() }, [slug])

  async function loadData() {
    const { data: b } = await supabase.from('brands').select('*').eq('slug', slug).single()
    if (!b) return
    setBrand(b)
    const { data } = await supabase.from('ad_campaigns').select('*').eq('brand_id', b.id).order('created_at', { ascending: false })
    setCampaigns(data || [])
  }

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault()
    if (!brand) return
    await supabase.from('ad_campaigns').insert({
      brand_id: brand.id, campaign_name: form.campaign_name, platform: form.platform,
      objective: form.objective, budget_daily: form.budget_daily ? parseFloat(form.budget_daily) : null,
      budget_total: form.budget_total ? parseFloat(form.budget_total) : null,
      start_date: form.start_date || null, status: form.status, notes: form.notes,
    })
    setShowModal(false)
    setForm({ campaign_name: '', platform: 'facebook', objective: '', budget_daily: '', budget_total: '', start_date: '', status: 'active', notes: '' })
    loadData()
  }

  async function deleteCampaign(id: string) {
    await supabase.from('ad_campaigns').delete().eq('id', id)
    loadData()
  }

  const activeCampaigns = campaigns.filter(c => c.status === 'active')
  const totalBudget = activeCampaigns.reduce((sum, c) => sum + (c.budget_total || 0), 0)

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Ads Hub</h2>
        <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm"><Plus size={14} /> Log Campaign</button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card"><div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Active Campaigns</div><div className="text-2xl font-bold mt-1">{activeCampaigns.length}</div></div>
        <div className="card"><div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Total Budget</div><div className="text-2xl font-bold mt-1">${totalBudget.toLocaleString()}</div></div>
        <div className="card"><div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Platforms</div><div className="text-2xl font-bold mt-1">{new Set(campaigns.map(c => c.platform)).size}</div></div>
      </div>

      {campaigns.length === 0 ? (
        <div className="card text-center py-12">
          <TrendingUp size={32} className="mx-auto mb-3" style={{ color: 'var(--text-secondary)' }} />
          <p style={{ color: 'var(--text-secondary)' }}>No ad campaigns logged yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <div key={c.id} className="card card-hover">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{c.campaign_name}</span>
                    <span className="badge badge-purple text-xs">{c.platform}</span>
                    <span className={`badge ${c.status === 'active' ? 'badge-success' : c.status === 'paused' ? 'badge-warning' : 'badge-neutral'} text-xs`}>{c.status}</span>
                  </div>
                  <div className="flex gap-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {c.objective && <span>Objective: {c.objective}</span>}
                    {c.budget_daily && <span>Daily: ${c.budget_daily}</span>}
                    {c.budget_total && <span>Total: ${c.budget_total}</span>}
                    {c.start_date && <span>Started: {new Date(c.start_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}</span>}
                  </div>
                </div>
                <button onClick={() => deleteCampaign(c.id)} className="btn btn-ghost btn-sm"><X size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Log Ad Campaign</h3>
              <button onClick={() => setShowModal(false)} className="btn btn-ghost btn-sm"><X size={16} /></button>
            </div>
            <form onSubmit={createCampaign} className="space-y-4">
              <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Campaign Name</label>
                <input value={form.campaign_name} onChange={e => setForm(f => ({...f, campaign_name: e.target.value}))} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Platform</label>
                  <select value={form.platform} onChange={e => setForm(f => ({...f, platform: e.target.value}))}>
                    {['facebook','instagram','tiktok','google','other'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Objective</label>
                  <input value={form.objective} onChange={e => setForm(f => ({...f, objective: e.target.value}))} placeholder="e.g. Reach, Conversions" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Daily Budget</label>
                  <input type="number" step="0.01" value={form.budget_daily} onChange={e => setForm(f => ({...f, budget_daily: e.target.value}))} placeholder="$" /></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Total Budget</label>
                  <input type="number" step="0.01" value={form.budget_total} onChange={e => setForm(f => ({...f, budget_total: e.target.value}))} placeholder="$" /></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Start Date</label>
                  <input type="date" value={form.start_date} onChange={e => setForm(f => ({...f, start_date: e.target.value}))} /></div>
              </div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} /></div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary btn-sm">Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">Save Campaign</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
