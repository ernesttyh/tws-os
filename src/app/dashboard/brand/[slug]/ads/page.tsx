'use client';
import { useState, useEffect, useCallback, use } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { BarChart3, Plus, TrendingUp, DollarSign, Eye, MousePointer, ChevronDown, ChevronRight, X } from 'lucide-react';

interface Campaign {
  id: string;
  campaign_name: string;
  platform: string;
  status: string;
  objective: string | null;
  budget_daily: number | null;
  budget_total: number | null;
  start_date: string | null;
  end_date: string | null;
  spend: number | null;
  impressions: number | null;
  reach: number | null;
  clicks: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  conversions: number | null;
  notes: string | null;
  created_at: string;
}

const PLATFORMS = [{ value: 'facebook', label: '📘 Meta' }, { value: 'instagram', label: '📸 IG' }, { value: 'google', label: '🔍 Google' }, { value: 'tiktok', label: '🎵 TikTok' }];
const CAMPAIGN_STATUSES = [{ value: 'draft', label: 'Draft' }, { value: 'active', label: 'Active' }, { value: 'paused', label: 'Paused' }, { value: 'completed', label: 'Completed' }];

const PLATFORM_BADGE: Record<string, string> = { facebook: '📘 Meta', instagram: '📸 IG', google: '🔍 Google', tiktok: '🎵 TikTok' };

function fmtMoney(n: number | null): string {
  if (n == null || n === 0) return '$0';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtNum(n: number | null): string {
  if (n == null || n === 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtDate(d: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function isEnded(c: Campaign): boolean {
  if (!c.end_date) return false;
  const endDate = new Date(c.end_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return endDate < today && c.status !== 'active';
}

export default function AdsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const supabase = createBrowserClient();
  const loadBrand = useCallback(async () => { const { data } = await supabase.from('brands').select('id').eq('slug', slug).single(); if (data) { setBrandId(data.id); return data.id; } return null; }, [slug, supabase]);
  const loadData = useCallback(async (bid: string) => { setLoading(true); const res = await fetch(`/api/brands/${bid}/ads`); if (res.ok) { const d = await res.json(); setCampaigns(d.campaigns || []); } setLoading(false); }, []);
  useEffect(() => { loadBrand().then(bid => { if (bid) loadData(bid); }); }, [loadBrand, loadData]);

  const [form, setForm] = useState({ campaign_name: '', platform: 'facebook', status: 'active', objective: '', budget_daily: '', budget_total: '', start_date: '', end_date: '', notes: '' });
  const resetForm = () => setForm({ campaign_name: '', platform: 'facebook', status: 'active', objective: '', budget_daily: '', budget_total: '', start_date: '', end_date: '', notes: '' });

  const save = async () => {
    if (!brandId) return;
    const payload = { ...form, budget_daily: form.budget_daily ? parseFloat(form.budget_daily) : null, budget_total: form.budget_total ? parseFloat(form.budget_total) : null, start_date: form.start_date || null, end_date: form.end_date || null, objective: form.objective || null, notes: form.notes || null };
    await fetch(`/api/brands/${brandId}/ads`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setShowModal(false); resetForm(); loadData(brandId);
  };

  // Aggregate from campaign objects directly
  const totalSpend = campaigns.reduce((s, c) => s + (c.spend || 0), 0);
  const totalImpressions = campaigns.reduce((s, c) => s + (c.impressions || 0), 0);
  const totalClicks = campaigns.reduce((s, c) => s + (c.clicks || 0), 0);
  const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions * 100) : 0;

  // Filter by platform
  const filtered = filter === 'all' ? campaigns : campaigns.filter(c => c.platform === filter);

  // Split into active, regular, completed
  const activeCampaigns = filtered.filter(c => c.status === 'active');
  const completedCampaigns = filtered.filter(c => isEnded(c));
  const completedIds = new Set(completedCampaigns.map(c => c.id));
  const regularCampaigns = filtered.filter(c => c.status !== 'active' && !completedIds.has(c.id));

  if (loading) return <div className="p-4 sm:p-6"><div className="animate-pulse"><div className="h-64 bg-gray-50 rounded" /></div></div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total Spend', value: fmtMoney(totalSpend), icon: DollarSign, color: 'text-green-600' },
          { label: 'Impressions', value: fmtNum(totalImpressions), icon: Eye, color: 'text-blue-600' },
          { label: 'Clicks', value: fmtNum(totalClicks), icon: MousePointer, color: 'text-purple-600' },
          { label: 'Avg CTR', value: `${avgCTR.toFixed(2)}%`, icon: TrendingUp, color: 'text-yellow-600' },
        ].map((s, i) => (
          <div key={i} className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-200">
            <div className="flex items-center gap-1.5 sm:gap-2 text-gray-500 text-[10px] sm:text-xs mb-1"><s.icon size={14} />{s.label}</div>
            <span className={`text-xl sm:text-2xl font-bold ${s.color}`}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Filter tabs + Add button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide pb-1 sm:pb-0">
          <button onClick={() => setFilter('all')} className={`px-2.5 sm:px-3 py-1 text-[10px] sm:text-xs rounded-full transition whitespace-nowrap ${filter === 'all' ? 'bg-purple-600 text-white' : 'bg-gray-50 text-gray-500'}`}>All</button>
          {PLATFORMS.map(p => (
            <button key={p.value} onClick={() => setFilter(p.value)} className={`px-2.5 sm:px-3 py-1 text-[10px] sm:text-xs rounded-full transition whitespace-nowrap ${filter === p.value ? 'bg-purple-600 text-white' : 'bg-gray-50 text-gray-500'}`}>{p.label}</button>
          ))}
        </div>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm rounded-lg shrink-0 self-end sm:self-auto"><Plus size={14} /><span className="hidden sm:inline">Add Campaign</span><span className="sm:hidden">Add</span></button>
      </div>

      {/* Active campaigns highlight */}
      {activeCampaigns.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
          <h3 className="text-xs sm:text-sm font-semibold text-green-700 mb-2">🟢 Currently Running ({activeCampaigns.length})</h3>
          <div className="space-y-2">
            {activeCampaigns.map(c => (
              <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between text-xs sm:text-sm gap-1 cursor-pointer hover:bg-green-100/50 rounded p-1.5 -m-1.5 transition" onClick={() => setSelectedCampaign(c)}>
                <div className="flex items-center gap-2">
                  <span className="text-gray-900 font-medium">{c.campaign_name}</span>
                  <span className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{PLATFORM_BADGE[c.platform] || c.platform}</span>
                </div>
                <div className="text-gray-500 text-[10px] sm:text-xs flex gap-3">
                  {c.spend ? <span className="text-green-700 font-medium">{fmtMoney(c.spend)} spent</span> : null}
                  {c.budget_daily ? <span>${c.budget_daily}/day</span> : null}
                  {c.budget_total ? <span>Total: ${c.budget_total}</span> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Regular (non-active, non-completed) campaigns */}
      {filtered.length === 0 ? (
        <EmptyState icon={BarChart3} title="No ad campaigns" description="Add campaigns to track ad performance" action={{ label: 'Add Campaign', onClick: () => { resetForm(); setShowModal(true); } }} />
      ) : (
        <>
          {regularCampaigns.length > 0 && (
            <div className="space-y-3">
              {regularCampaigns.map(c => (
                <CampaignCard key={c.id} campaign={c} onClick={() => setSelectedCampaign(c)} />
              ))}
            </div>
          )}

          {/* Completed campaigns collapsible */}
          {completedCampaigns.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button onClick={() => setShowCompleted(!showCompleted)} className="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition text-xs sm:text-sm text-gray-500">
                <span className="flex items-center gap-2">
                  {showCompleted ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  Completed ({completedCampaigns.length})
                </span>
              </button>
              {showCompleted && (
                <div className="p-3 space-y-3">
                  {completedCampaigns.map(c => (
                    <CampaignCard key={c.id} campaign={c} onClick={() => setSelectedCampaign(c)} muted />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Add Campaign Modal */}
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
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
            <button onClick={save} disabled={!form.campaign_name} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm rounded-lg">Create Campaign</button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!selectedCampaign} onClose={() => setSelectedCampaign(null)} title="Campaign Details" size="lg">
        {selectedCampaign && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">{selectedCampaign.campaign_name}</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{PLATFORM_BADGE[selectedCampaign.platform] || selectedCampaign.platform}</span>
              <StatusBadge status={selectedCampaign.status} />
            </div>

            {selectedCampaign.objective && (
              <p className="text-xs sm:text-sm text-gray-500">Objective: {selectedCampaign.objective}</p>
            )}

            {/* Budget & dates */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <DetailItem label="Daily Budget" value={selectedCampaign.budget_daily ? fmtMoney(selectedCampaign.budget_daily) : '—'} />
              <DetailItem label="Total Budget" value={selectedCampaign.budget_total ? fmtMoney(selectedCampaign.budget_total) : '—'} />
              <DetailItem label="Start Date" value={fmtDate(selectedCampaign.start_date) || '—'} />
              <DetailItem label="End Date" value={fmtDate(selectedCampaign.end_date) || 'Ongoing'} />
            </div>

            {/* Performance metrics */}
            <div className="border-t border-gray-200 pt-3">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Performance</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <DetailItem label="Spend" value={fmtMoney(selectedCampaign.spend)} highlight />
                <DetailItem label="Impressions" value={fmtNum(selectedCampaign.impressions)} />
                <DetailItem label="Reach" value={fmtNum(selectedCampaign.reach)} />
                <DetailItem label="Clicks" value={fmtNum(selectedCampaign.clicks)} />
                <DetailItem label="CTR" value={selectedCampaign.ctr != null ? `${selectedCampaign.ctr.toFixed(2)}%` : '—'} />
                <DetailItem label="CPC" value={selectedCampaign.cpc != null ? fmtMoney(selectedCampaign.cpc) : '—'} />
                <DetailItem label="CPM" value={selectedCampaign.cpm != null ? fmtMoney(selectedCampaign.cpm) : '—'} />
                <DetailItem label="Conversions" value={selectedCampaign.conversions != null ? fmtNum(selectedCampaign.conversions) : '—'} />
              </div>
            </div>

            {selectedCampaign.notes && (
              <div className="border-t border-gray-200 pt-3">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Notes</h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedCampaign.notes}</p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button onClick={() => setSelectedCampaign(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-900">Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function DetailItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
      <div className="text-[10px] sm:text-xs text-gray-500 mb-0.5">{label}</div>
      <div className={`text-sm sm:text-base font-semibold ${highlight ? 'text-green-600' : 'text-gray-900'}`}>{value}</div>
    </div>
  );
}

function CampaignCard({ campaign: c, onClick, muted }: { campaign: Campaign; onClick: () => void; muted?: boolean }) {
  return (
    <div onClick={onClick} className={`rounded-lg p-3 sm:p-4 border hover:border-gray-300 transition cursor-pointer ${muted ? 'bg-gray-50/50 border-gray-100 opacity-70' : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <h3 className="text-gray-900 font-medium text-sm">{c.campaign_name}</h3>
            <StatusBadge status={c.status} />
            <span className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{PLATFORM_BADGE[c.platform] || c.platform}</span>
          </div>
          {c.objective && <p className="text-[10px] sm:text-xs text-gray-500 mt-1">Objective: {c.objective}</p>}
          <div className="flex gap-3 sm:gap-4 mt-2 text-[10px] sm:text-xs text-gray-500 flex-wrap">
            {c.budget_daily != null && c.budget_daily > 0 && <span>💰 ${c.budget_daily}/day</span>}
            {c.budget_total != null && c.budget_total > 0 && <span>📊 Total: ${c.budget_total}</span>}
            {c.start_date && <span>📅 {fmtDate(c.start_date)}{c.end_date ? ` — ${fmtDate(c.end_date)}` : ' — ongoing'}</span>}
          </div>
        </div>
        <div className="text-left sm:text-right text-[10px] sm:text-xs flex gap-3 sm:block shrink-0">
          {(c.spend != null && c.spend > 0) && <div className="text-green-600 font-semibold">{fmtMoney(c.spend)} spent</div>}
          {(c.impressions != null && c.impressions > 0) && <div className="text-gray-500">{fmtNum(c.impressions)} impr</div>}
          {(c.clicks != null && c.clicks > 0) && <div className="text-gray-500">{fmtNum(c.clicks)} clicks</div>}
        </div>
      </div>
    </div>
  );
}
