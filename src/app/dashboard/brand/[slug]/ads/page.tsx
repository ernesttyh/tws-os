'use client';
import { useState, useEffect, useCallback, use } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { BarChart3, Plus, TrendingUp, DollarSign, Eye, MousePointer } from 'lucide-react';

interface Campaign { id: string; campaign_name: string; platform: string; status: string; objective: string | null; budget_daily: number | null; budget_total: number | null; start_date: string | null; end_date: string | null; notes: string | null }
interface Metric { campaign_id: string; date: string; spend: number | null; impressions: number | null; clicks: number | null; ctr: number | null; cpc: number | null; reach: number | null; conversions: number | null; roas: number | null }

const PLATFORMS = [{ value: 'facebook', label: '📘 Meta' }, { value: 'instagram', label: '📸 IG' }, { value: 'google', label: '🔍 Google' }, { value: 'tiktok', label: '🎵 TikTok' }];
const CAMPAIGN_STATUSES = [{ value: 'draft', label: 'Draft' }, { value: 'active', label: 'Active' }, { value: 'paused', label: 'Paused' }, { value: 'completed', label: 'Completed' }];

export default function AdsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const supabase = createBrowserClient();
  const loadBrand = useCallback(async () => { const { data } = await supabase.from('brands').select('id').eq('slug', slug).single(); if (data) { setBrandId(data.id); return data.id; } return null; }, [slug, supabase]);
  const loadData = useCallback(async (bid: string) => { setLoading(true); const res = await fetch(`/api/brands/${bid}/ads`); if (res.ok) { const d = await res.json(); setCampaigns(d.campaigns || []); setMetrics(d.metrics || []); } setLoading(false); }, []);
  useEffect(() => { loadBrand().then(bid => { if (bid) loadData(bid); }); }, [loadBrand, loadData]);

  const [form, setForm] = useState({ campaign_name: '', platform: 'facebook', status: 'active', objective: '', budget_daily: '', budget_total: '', start_date: '', end_date: '', notes: '' });
  const resetForm = () => setForm({ campaign_name: '', platform: 'facebook', status: 'active', objective: '', budget_daily: '', budget_total: '', start_date: '', end_date: '', notes: '' });

  const save = async () => {
    if (!brandId) return;
    const payload = { ...form, budget_daily: form.budget_daily ? parseFloat(form.budget_daily) : null, budget_total: form.budget_total ? parseFloat(form.budget_total) : null, start_date: form.start_date || null, end_date: form.end_date || null, objective: form.objective || null, notes: form.notes || null };
    await fetch(`/api/brands/${brandId}/ads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setShowModal(false); resetForm(); loadData(brandId);
  };

  // Aggregate metrics
  const totalSpend = metrics.reduce((s, m) => s + (m.spend || 0), 0);
  const totalImpressions = metrics.reduce((s, m) => s + (m.impressions || 0), 0);
  const totalClicks = metrics.reduce((s, m) => s + (m.clicks || 0), 0);
  const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions * 100) : 0;

  const filtered = filter === 'all' ? campaigns : campaigns.filter(c => c.platform === filter);
  const activeCampaigns = campaigns.filter(c => c.status === 'active');

  if (loading) return <div className="p-4 sm:p-6"><div className="animate-pulse"><div className="h-64 bg-white/5 rounded" /></div></div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total Spend', value: `$${totalSpend.toFixed(2)}`, icon: DollarSign, color: 'text-green-400' },
          { label: 'Impressions', value: totalImpressions > 1000 ? `${(totalImpressions / 1000).toFixed(1)}K` : totalImpressions, icon: Eye, color: 'text-blue-400' },
          { label: 'Clicks', value: totalClicks.toLocaleString(), icon: MousePointer, color: 'text-purple-400' },
          { label: 'Avg CTR', value: `${avgCTR.toFixed(2)}%`, icon: TrendingUp, color: 'text-yellow-400' },
        ].map((s, i) => (
          <div key={i} className="bg-white/5 rounded-xl p-3 sm:p-4 border border-white/10">
            <div className="flex items-center gap-1.5 sm:gap-2 text-gray-400 text-[10px] sm:text-xs mb-1"><s.icon size={14} />{s.label}</div>
            <span className={`text-xl sm:text-2xl font-bold ${s.color}`}>{s.value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide pb-1 sm:pb-0">
          <button onClick={() => setFilter('all')} className={`px-2.5 sm:px-3 py-1 text-[10px] sm:text-xs rounded-full transition whitespace-nowrap ${filter === 'all' ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400'}`}>All</button>
          {PLATFORMS.map(p => (
            <button key={p.value} onClick={() => setFilter(p.value)} className={`px-2.5 sm:px-3 py-1 text-[10px] sm:text-xs rounded-full transition whitespace-nowrap ${filter === p.value ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400'}`}>{p.label}</button>
          ))}
        </div>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm rounded-lg shrink-0 self-end sm:self-auto"><Plus size={14} /><span className="hidden sm:inline">Add Campaign</span><span className="sm:hidden">Add</span></button>
      </div>

      {/* Active campaigns highlight */}
      {activeCampaigns.length > 0 && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 sm:p-4">
          <h3 className="text-xs sm:text-sm font-semibold text-green-400 mb-2">🟢 Currently Running ({activeCampaigns.length})</h3>
          <div className="space-y-2">
            {activeCampaigns.map(c => (
              <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between text-xs sm:text-sm gap-1">
                <div className="flex items-center gap-2"><span className="text-white">{c.campaign_name}</span><StatusBadge status={c.platform} /></div>
                <div className="text-gray-400 text-[10px] sm:text-xs">{c.budget_daily ? `$${c.budget_daily}/day` : ''} {c.budget_total ? `(Total: $${c.budget_total})` : ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon={BarChart3} title="No ad campaigns" description="Add campaigns to track ad performance" action={{ label: 'Add Campaign', onClick: () => { resetForm(); setShowModal(true); } }} />
      ) : (
        <div className="space-y-3">
          {filtered.map(c => {
            const cMetrics = metrics.filter(m => m.campaign_id === c.id);
            const cSpend = cMetrics.reduce((s, m) => s + (m.spend || 0), 0);
            const cImpr = cMetrics.reduce((s, m) => s + (m.impressions || 0), 0);
            const cClicks = cMetrics.reduce((s, m) => s + (m.clicks || 0), 0);
            return (
              <div key={c.id} className="bg-white/5 rounded-lg p-3 sm:p-4 border border-white/10 hover:border-white/20 transition">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap"><h3 className="text-white font-medium text-sm">{c.campaign_name}</h3><StatusBadge status={c.status} /><StatusBadge status={c.platform} /></div>
                    {c.objective && <p className="text-[10px] sm:text-xs text-gray-400 mt-1">Objective: {c.objective}</p>}
                    <div className="flex gap-3 sm:gap-4 mt-2 text-[10px] sm:text-xs text-gray-400 flex-wrap">
                      {c.budget_daily && <span>💰 ${c.budget_daily}/day</span>}
                      {c.budget_total && <span>📊 Total: ${c.budget_total}</span>}
                      {c.start_date && <span>📅 {new Date(c.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}{c.end_date ? ` - ${new Date(c.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ' - ongoing'}</span>}
                    </div>
                  </div>
                  {cMetrics.length > 0 && (
                    <div className="text-left sm:text-right text-[10px] sm:text-xs flex gap-3 sm:block shrink-0">
                      <div className="text-green-400 font-semibold">${cSpend.toFixed(2)} spent</div>
                      <div className="text-gray-400">{cImpr.toLocaleString()} impr</div>
                      <div className="text-gray-400">{cClicks.toLocaleString()} clicks</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Ad Campaign" size="lg">
        <div className="space-y-4">
          <FormField label="Campaign Name" name="campaign_name" value={form.campaign_name} onChange={e => setForm(f => ({ ...f, campaign_name: e.target.value }))} required />
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Platform" name="platform" value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} options={PLATFORMS} />
            <FormField label="Status" name="status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} options={CAMPAIGN_STATUSES} />
          </div>
          <FormField label="Objective" name="objective" value={form.objective} onChange={e => setForm(f => ({ ...f, objective: e.target.value }))} placeholder="e.g. Traffic, Conversions, Awareness" />
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Daily Budget ($)" name="budget_daily" type="number" value={form.budget_daily} onChange={e => setForm(f => ({ ...f, budget_daily: e.target.value }))} />
            <FormField label="Total Budget ($)" name="budget_total" type="number" value={form.budget_total} onChange={e => setForm(f => ({ ...f, budget_total: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Start Date" name="start_date" type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            <FormField label="End Date" name="end_date" type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
          </div>
          <FormField label="Notes" name="notes" type="textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-400">Cancel</button>
            <button onClick={save} disabled={!form.campaign_name} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm rounded-lg">Create Campaign</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
