'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Brand } from '@/lib/types'
import { Plus, X, Users } from 'lucide-react'

interface KOLCampaign {
  id: string; brand_id: string; influencer_id: string; campaign_name: string;
  status: string; agreed_rate: number | null; post_date: string | null;
  post_url: string | null; views: number | null; likes: number | null; notes: string | null;
  influencer?: { id: string; name: string; instagram_handle: string; tier: string; followers_ig: number }
}

const statusBadge: Record<string, string> = {
  prospecting: 'badge-neutral', contacted: 'badge-info', negotiating: 'badge-warning',
  confirmed: 'badge-purple', active: 'badge-success', completed: 'badge-success', declined: 'badge-danger',
}

export default function InfluencersPage() {
  const params = useParams()
  const slug = params.slug as string
  const supabase = createClient()

  const [brand, setBrand] = useState<Brand | null>(null)
  const [campaigns, setCampaigns] = useState<KOLCampaign[]>([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ influencer_name: '', instagram_handle: '', tier: 'micro', campaign_name: '', status: 'prospecting', notes: '' })

  useEffect(() => { loadData() }, [slug])

  async function loadData() {
    const { data: b } = await supabase.from('brands').select('*').eq('slug', slug).single()
    if (!b) return
    setBrand(b)
    const { data } = await supabase.from('brand_influencer_campaigns').select('*, influencer:influencers(*)').eq('brand_id', b.id).order('created_at', { ascending: false })
    setCampaigns(data || [])
  }

  async function addKOL(e: React.FormEvent) {
    e.preventDefault()
    if (!brand) return
    // Create or find influencer
    let influencerId: string
    const { data: existing } = await supabase.from('influencers').select('id').eq('instagram_handle', form.instagram_handle).single()
    if (existing) {
      influencerId = existing.id
    } else {
      const { data: newInf } = await supabase.from('influencers').insert({ name: form.influencer_name, instagram_handle: form.instagram_handle, tier: form.tier }).select('id').single()
      if (!newInf) return
      influencerId = newInf.id
    }
    await supabase.from('brand_influencer_campaigns').insert({ brand_id: brand.id, influencer_id: influencerId, campaign_name: form.campaign_name, status: form.status, notes: form.notes })
    setShowModal(false)
    setForm({ influencer_name: '', instagram_handle: '', tier: 'micro', campaign_name: '', status: 'prospecting', notes: '' })
    loadData()
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('brand_influencer_campaigns').update({ status }).eq('id', id)
    loadData()
  }

  async function deleteCampaign(id: string) {
    await supabase.from('brand_influencer_campaigns').delete().eq('id', id)
    loadData()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Influencer Hub</h2>
        <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm"><Plus size={14} /> Add KOL</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {['prospecting','confirmed','active','completed'].map(s => (
          <div key={s} className="card">
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{s}</div>
            <div className="text-xl font-bold mt-1">{campaigns.filter(c => c.status === s).length}</div>
          </div>
        ))}
      </div>

      {campaigns.length === 0 ? (
        <div className="card text-center py-12">
          <Users size={32} className="mx-auto mb-3" style={{ color: 'var(--text-secondary)' }} />
          <p style={{ color: 'var(--text-secondary)' }}>No KOL campaigns yet</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="table-container">
            <table>
              <thead><tr><th>KOL</th><th>Handle</th><th>Tier</th><th>Campaign</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {campaigns.map(c => (
                  <tr key={c.id}>
                    <td className="font-medium text-sm">{c.influencer?.name || '—'}</td>
                    <td className="text-sm" style={{ color: 'var(--accent)' }}>@{c.influencer?.instagram_handle || '—'}</td>
                    <td><span className="badge badge-purple text-xs">{c.influencer?.tier || '—'}</span></td>
                    <td className="text-sm">{c.campaign_name || '—'}</td>
                    <td>
                      <select value={c.status} onChange={e => updateStatus(c.id, e.target.value)}
                        className="text-xs py-0.5 px-1" style={{ width: 'auto', background: 'transparent', border: 'none' }}>
                        {['prospecting','contacted','negotiating','confirmed','active','completed','declined'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td><button onClick={() => deleteCampaign(c.id)} className="btn btn-ghost btn-sm"><X size={12} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Add KOL Campaign</h3>
              <button onClick={() => setShowModal(false)} className="btn btn-ghost btn-sm"><X size={16} /></button>
            </div>
            <form onSubmit={addKOL} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Name</label>
                  <input value={form.influencer_name} onChange={e => setForm(f => ({...f, influencer_name: e.target.value}))} required /></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Instagram Handle</label>
                  <input value={form.instagram_handle} onChange={e => setForm(f => ({...f, instagram_handle: e.target.value}))} placeholder="handle (no @)" required /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Tier</label>
                  <select value={form.tier} onChange={e => setForm(f => ({...f, tier: e.target.value}))}>
                    {['nano','micro','mid','macro','mega'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Campaign</label>
                  <input value={form.campaign_name} onChange={e => setForm(f => ({...f, campaign_name: e.target.value}))} placeholder="e.g. June Launch" /></div>
              </div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} /></div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary btn-sm">Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">Add KOL</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
