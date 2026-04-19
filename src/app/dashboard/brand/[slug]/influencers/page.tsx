'use client';
import { useState, useEffect, useCallback, use } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { Users, Plus, Trash2, Edit2, Instagram, Star, TrendingUp } from 'lucide-react';

interface Campaign { id: string; campaign_name: string | null; status: string; agreed_rate: number | null; post_date: string | null; post_url: string | null; views: number | null; likes: number | null; reach: number | null; notes: string | null; influencer: { id: string; name: string; instagram_handle: string | null; tier: string | null; followers_ig: number | null; engagement_rate: number | null } }

const TIERS = [{ value: 'nano', label: 'Nano (1K-10K)' }, { value: 'micro', label: 'Micro (10K-50K)' }, { value: 'mid', label: 'Mid (50K-500K)' }, { value: 'macro', label: 'Macro (500K-1M)' }, { value: 'mega', label: 'Mega (1M+)' }];
const STATUSES = [{ value: 'prospecting', label: 'Prospecting' }, { value: 'contacted', label: 'Contacted' }, { value: 'negotiating', label: 'Negotiating' }, { value: 'confirmed', label: 'Confirmed' }, { value: 'active', label: 'Active' }, { value: 'completed', label: 'Completed' }, { value: 'declined', label: 'Declined' }];

export default function InfluencersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const supabase = createBrowserClient();
  const loadBrand = useCallback(async () => { const { data } = await supabase.from('brands').select('id').eq('slug', slug).single(); if (data) { setBrandId(data.id); return data.id; } return null; }, [slug, supabase]);
  const loadData = useCallback(async (bid: string) => { setLoading(true); const res = await fetch(`/api/brands/${bid}/influencers`); if (res.ok) setCampaigns(await res.json()); setLoading(false); }, []);
  useEffect(() => { loadBrand().then(bid => { if (bid) loadData(bid); }); }, [loadBrand, loadData]);

  const [form, setForm] = useState({ influencer_name: '', instagram_handle: '', tier: 'micro', followers_ig: '', campaign_name: '', status: 'prospecting', agreed_rate: '', post_date: '', notes: '' });
  const resetForm = () => setForm({ influencer_name: '', instagram_handle: '', tier: 'micro', followers_ig: '', campaign_name: '', status: 'prospecting', agreed_rate: '', post_date: '', notes: '' });

  const save = async () => {
    if (!brandId) return;
    const payload = { ...form, followers_ig: form.followers_ig ? parseInt(form.followers_ig) : null, agreed_rate: form.agreed_rate ? parseFloat(form.agreed_rate) : null, post_date: form.post_date || null };
    await fetch(`/api/brands/${brandId}/influencers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setShowModal(false); resetForm(); loadData(brandId);
  };

  const filtered = filter === 'all' ? campaigns : campaigns.filter(c => c.status === filter);
  const thisMonth = campaigns.filter(c => { if (!c.post_date) return false; const d = new Date(c.post_date); const now = new Date(); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
  const totalReach = campaigns.reduce((sum, c) => sum + (c.reach || 0), 0);

  if (loading) return <div className="p-6"><div className="animate-pulse"><div className="h-64 bg-white/5 rounded" /></div></div>;

  return (
    <div className="p-6 space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Campaigns', value: campaigns.length, icon: Users },
          { label: 'Active This Month', value: thisMonth.length, icon: Star },
          { label: 'Total Reach', value: totalReach > 1000 ? `${(totalReach / 1000).toFixed(1)}K` : totalReach, icon: TrendingUp },
          { label: 'Posted', value: campaigns.filter(c => c.post_url).length, icon: Instagram },
        ].map((s, i) => (
          <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-1"><s.icon size={14} />{s.label}</div>
            <span className="text-2xl font-bold text-white">{s.value}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {['all', ...STATUSES.map(s => s.value)].map(s => (
            <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1 text-xs rounded-full transition ${filter === s ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}>
              {s === 'all' ? 'All' : s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </button>
          ))}
        </div>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition"><Plus size={16} />Add KOL</button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No influencer campaigns" description="Add KOLs and track their campaigns for this brand" action={{ label: 'Add KOL', onClick: () => { resetForm(); setShowModal(true); } }} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(c => (
            <div key={c.id} className="bg-white/5 rounded-lg p-4 border border-white/10 hover:border-white/20 transition">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white font-bold text-sm">{c.influencer.name.charAt(0)}</div>
                  <div>
                    <h3 className="text-white font-medium">{c.influencer.name}</h3>
                    {c.influencer.instagram_handle && <span className="text-xs text-gray-400">@{c.influencer.instagram_handle}</span>}
                  </div>
                </div>
                <StatusBadge status={c.status} />
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
                {c.influencer.tier && <span className="capitalize">{c.influencer.tier}</span>}
                {c.influencer.followers_ig && <span>{(c.influencer.followers_ig / 1000).toFixed(1)}K followers</span>}
                {c.agreed_rate && <span>${c.agreed_rate}</span>}
                {c.post_date && <span>{new Date(c.post_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
              </div>
              {c.campaign_name && <p className="text-xs text-gray-300 mt-2">Campaign: {c.campaign_name}</p>}
              {(c.views || c.likes || c.reach) && (
                <div className="flex gap-4 mt-2 text-xs text-gray-400">
                  {c.views && <span>👁 {c.views.toLocaleString()}</span>}
                  {c.likes && <span>❤️ {c.likes.toLocaleString()}</span>}
                  {c.reach && <span>📊 {c.reach.toLocaleString()} reach</span>}
                </div>
              )}
              {c.post_url && <a href={c.post_url} target="_blank" rel="noopener" className="text-xs text-purple-400 hover:text-purple-300 mt-2 inline-block">View Post →</a>}
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Influencer Campaign" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Influencer Name" name="influencer_name" value={form.influencer_name} onChange={e => setForm(f => ({ ...f, influencer_name: e.target.value }))} required />
            <FormField label="Instagram Handle" name="instagram_handle" value={form.instagram_handle} onChange={e => setForm(f => ({ ...f, instagram_handle: e.target.value }))} placeholder="without @" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Tier" name="tier" value={form.tier} onChange={e => setForm(f => ({ ...f, tier: e.target.value }))} options={TIERS} />
            <FormField label="Followers (IG)" name="followers_ig" type="number" value={form.followers_ig} onChange={e => setForm(f => ({ ...f, followers_ig: e.target.value }))} />
            <FormField label="Agreed Rate ($)" name="agreed_rate" type="number" value={form.agreed_rate} onChange={e => setForm(f => ({ ...f, agreed_rate: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Campaign Name" name="campaign_name" value={form.campaign_name} onChange={e => setForm(f => ({ ...f, campaign_name: e.target.value }))} />
            <FormField label="Status" name="status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} options={STATUSES} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Post Date" name="post_date" type="date" value={form.post_date} onChange={e => setForm(f => ({ ...f, post_date: e.target.value }))} />
          </div>
          <FormField label="Notes" name="notes" type="textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-400">Cancel</button>
            <button onClick={save} disabled={!form.influencer_name} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm rounded-lg">Add KOL</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
