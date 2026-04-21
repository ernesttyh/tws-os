'use client';
import { useState, useEffect, useCallback, use } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { Users, Plus, Edit2, Instagram, Star, TrendingUp, Search, Database, Briefcase, CalendarCheck, Check, X, ExternalLink } from 'lucide-react';

type MainTab = 'tracking' | 'database' | 'campaigns';

interface Campaign { id: string; campaign_name: string | null; status: string; agreed_rate: number | null; post_date: string | null; post_url: string | null; views: number | null; likes: number | null; reach: number | null; notes: string | null; influencer: { id: string; name: string; instagram_handle: string | null; tier: string | null; followers_ig: number | null; engagement_rate: number | null } }

interface Influencer { id: string; name: string; instagram_handle: string | null; tiktok_handle: string | null; lemon8_handle: string | null; xhs_handle: string | null; tier: string | null; followers_ig: number | null; followers_tiktok: number | null; followers_lemon8: number | null; followers_xhs: number | null; email: string | null; phone: string | null; influencer_type: string | null; rate_info: string | null; reel_views: string | null; notes: string | null }

interface Invitation {
  id: string;
  brand_id: string;
  influencer_id: string;
  event_month: string;
  invited: boolean;
  confirmed: boolean;
  attended: boolean;
  posted: boolean;
  ig_posted: boolean;
  tt_posted: boolean;
  xhs_posted: boolean;
  l8_posted: boolean;
  post_url: string | null;
  ig_post_url: string | null;
  tt_post_url: string | null;
  xhs_post_url: string | null;
  l8_post_url: string | null;
  notes: string | null;
  created_at: string;
  influencer: {
    id: string;
    name: string;
    instagram_handle: string | null;
    tiktok_handle: string | null;
    xhs_handle: string | null;
    lemon8_handle: string | null;
    tier: string | null;
    followers_ig: number | null;
  };
}

const TIERS = [{ value: 'nano', label: 'Nano (1K-10K)' }, { value: 'micro', label: 'Micro (10K-50K)' }, { value: 'mid', label: 'Mid (50K-500K)' }, { value: 'macro', label: 'Macro (500K-1M)' }, { value: 'mega', label: 'Mega (1M+)' }];
const STATUSES = [{ value: 'prospecting', label: 'Prospecting' }, { value: 'contacted', label: 'Contacted' }, { value: 'negotiating', label: 'Negotiating' }, { value: 'confirmed', label: 'Confirmed' }, { value: 'active', label: 'Active' }, { value: 'completed', label: 'Completed' }, { value: 'declined', label: 'Declined' }];

// Generate months from Jan 2025 to 6 months ahead
const TRACKING_MONTHS = (() => {
  const months: string[] = [];
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 6, 1);
  const start = new Date(2025, 0, 1); // Jan 2025
  const d = new Date(start);
  while (d <= end) {
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    d.setMonth(d.getMonth() + 1);
  }
  return months;
})();

function formatTrackingMonth(m: string): string {
  if (m === 'all') return 'All Months';
  const [yr, mo] = m.split('-');
  const date = new Date(parseInt(yr), parseInt(mo) - 1, 1);
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function formatFollowers(n: number | null) {
  if (!n) return '-';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

// Platform link helpers
function igProfileUrl(handle: string | null): string | null {
  if (!handle) return null;
  const clean = handle.replace(/^@/, '').trim();
  return clean ? `https://instagram.com/${clean}` : null;
}
function ttProfileUrl(handle: string | null): string | null {
  if (!handle) return null;
  const clean = handle.replace(/^@/, '').trim();
  return clean ? `https://tiktok.com/@${clean}` : null;
}
function xhsProfileUrl(handle: string | null): string | null {
  if (!handle) return null;
  const clean = handle.trim();
  return clean ? `https://xiaohongshu.com/search_result?keyword=${encodeURIComponent(clean)}` : null;
}
function l8ProfileUrl(handle: string | null): string | null {
  if (!handle) return null;
  const clean = handle.replace(/^@/, '').trim();
  return clean ? `https://lemon8-app.com/${clean}` : null;
}

// Platform post icon component — read-only indicator, links to actual post URL (not profile)
function PlatformPostBadge({ label, emoji, posted, postUrl, profileUrl }: { label: string; emoji: string; posted: boolean; postUrl: string | null; profileUrl: string | null }) {
  if (!posted) {
    return (
      <span
        title={`${label}: not posted`}
        className="w-5 h-5 sm:w-6 sm:h-6 rounded flex items-center justify-center text-[10px] sm:text-xs bg-gray-100 text-gray-400 opacity-40"
      >
        {emoji}
      </span>
    );
  }
  // Posted — link to actual post if URL exists, otherwise show as indicator
  if (postUrl) {
    return (
      <a
        href={postUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={`View ${label} post`}
        className="w-5 h-5 sm:w-6 sm:h-6 rounded flex items-center justify-center text-[10px] sm:text-xs bg-purple-100 text-purple-600 ring-1 ring-purple-300 hover:bg-purple-200 transition cursor-pointer"
      >
        {emoji}
      </a>
    );
  }
  return (
    <span
      title={`${label}: posted (no link)`}
      className="w-5 h-5 sm:w-6 sm:h-6 rounded flex items-center justify-center text-[10px] sm:text-xs bg-green-100 text-green-600 ring-1 ring-green-300"
    >
      {emoji}
    </span>
  );
}

export default function InfluencersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [mainTab, setMainTab] = useState<MainTab>('tracking');
  const [brandId, setBrandId] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [totalInfluencers, setTotalInfluencers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dbLoading, setDbLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [dbSearch, setDbSearch] = useState('');
  const [dbTier, setDbTier] = useState('all');
  const [dbPage, setDbPage] = useState(0);

  // Monthly tracking state — default to "all" to show all data
  const [trackingMonth, setTrackingMonth] = useState('all');
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteResults, setInviteResults] = useState<Influencer[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);

  const supabase = createBrowserClient();
  const loadBrand = useCallback(async () => { const { data } = await supabase.from('brands').select('id').eq('slug', slug).single(); if (data) { setBrandId(data.id); return data.id; } return null; }, [slug, supabase]);
  const loadCampaigns = useCallback(async (bid: string) => { setLoading(true); const res = await fetch(`/api/brands/${bid}/influencers`); if (res.ok) setCampaigns(await res.json()); setLoading(false); }, []);
  const loadInfluencers = useCallback(async (search?: string, tier?: string, page?: number) => {
    setDbLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (tier && tier !== 'all') params.set('tier', tier);
    if (page) params.set('page', page.toString());
    const res = await fetch(`/api/influencers?${params.toString()}`);
    if (res.ok) { const d = await res.json(); setInfluencers(d.data || []); setTotalInfluencers(d.total || 0); }
    setDbLoading(false);
  }, []);

  const loadInvitations = useCallback(async (bid: string, month: string) => {
    setTrackingLoading(true);
    let query = supabase
      .from('influencer_invitations')
      .select('*, influencer:influencers(id, name, instagram_handle, tiktok_handle, xhs_handle, lemon8_handle, tier, followers_ig)')
      .eq('brand_id', bid)
      .order('event_month', { ascending: false });

    if (month !== 'all') {
      query = query.eq('event_month', `${month}-01`);
    }

    const { data, error } = await query;
    if (!error && data) setInvitations(data as Invitation[]);
    else setInvitations([]);
    setTrackingLoading(false);
  }, [supabase]);

  useEffect(() => { loadBrand().then(bid => { if (bid) { loadCampaigns(bid); loadInvitations(bid, trackingMonth); } }); loadInfluencers(); }, [loadBrand, loadCampaigns, loadInfluencers, loadInvitations, trackingMonth]);

  useEffect(() => {
    const timer = setTimeout(() => { loadInfluencers(dbSearch, dbTier, dbPage); }, 300);
    return () => clearTimeout(timer);
  }, [dbSearch, dbTier, dbPage, loadInfluencers]);

  useEffect(() => {
    if (brandId) loadInvitations(brandId, trackingMonth);
  }, [trackingMonth, brandId, loadInvitations]);

  // Toggle invitation field
  const toggleInvitationField = async (invId: string, field: 'invited' | 'confirmed' | 'attended' | 'posted' | 'ig_posted' | 'tt_posted' | 'xhs_posted' | 'l8_posted', current: boolean) => {
    const updates: Record<string, boolean> = { [field]: !current };
    // If toggling a platform field ON, also set posted = true
    if (['ig_posted', 'tt_posted', 'xhs_posted', 'l8_posted'].includes(field) && !current) {
      updates.posted = true;
    }
    // If toggling a platform field OFF, check if any others are still on
    if (['ig_posted', 'tt_posted', 'xhs_posted', 'l8_posted'].includes(field) && current) {
      const inv = invitations.find(i => i.id === invId);
      if (inv) {
        const platforms = { ig_posted: inv.ig_posted, tt_posted: inv.tt_posted, xhs_posted: inv.xhs_posted, l8_posted: inv.l8_posted, [field]: false };
        const anyPosted = platforms.ig_posted || platforms.tt_posted || platforms.xhs_posted || platforms.l8_posted;
        if (!anyPosted) updates.posted = false;
      }
    }
    const { error } = await supabase
      .from('influencer_invitations')
      .update(updates)
      .eq('id', invId);
    if (!error && brandId) loadInvitations(brandId, trackingMonth);
  };

  // Update post URL
  const updatePostUrl = async (invId: string, url: string) => {
    await supabase
      .from('influencer_invitations')
      .update({ post_url: url || null })
      .eq('id', invId);
  };

  // Invite KOL search
  const searchForInvite = useCallback(async (query: string) => {
    if (!query.trim()) { setInviteResults([]); return; }
    setInviteLoading(true);
    const res = await fetch(`/api/influencers?search=${encodeURIComponent(query)}&limit=10`);
    if (res.ok) { const d = await res.json(); setInviteResults(d.data || []); }
    setInviteLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { searchForInvite(inviteSearch); }, 300);
    return () => clearTimeout(timer);
  }, [inviteSearch, searchForInvite]);

  // For new invitations, use current month
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const inviteMonth = trackingMonth === 'all' ? currentMonth : trackingMonth;

  const createInvitation = async (influencerId: string) => {
    if (!brandId) return;
    const existing = invitations.find(inv => inv.influencer_id === influencerId && inv.event_month?.startsWith(inviteMonth));
    if (existing) { alert('This KOL is already invited for this month.'); return; }
    const { error } = await supabase
      .from('influencer_invitations')
      .insert({
        brand_id: brandId,
        influencer_id: influencerId,
        event_month: `${inviteMonth}-01`,
        invited: true,
        confirmed: false,
        attended: false,
        posted: false,
        ig_posted: false,
        tt_posted: false,
        xhs_posted: false,
        l8_posted: false,
      });
    if (!error) {
      loadInvitations(brandId, trackingMonth);
      setShowInviteModal(false);
      setInviteSearch('');
      setInviteResults([]);
    }
  };

  const deleteInvitation = async (invId: string) => {
    if (!confirm('Remove this invitation?')) return;
    await supabase.from('influencer_invitations').delete().eq('id', invId);
    if (brandId) loadInvitations(brandId, trackingMonth);
  };

  // Campaign form
  const [form, setForm] = useState({ influencer_name: '', instagram_handle: '', tier: 'micro', followers_ig: '', campaign_name: '', status: 'prospecting', agreed_rate: '', post_date: '', notes: '' });
  const resetForm = () => setForm({ influencer_name: '', instagram_handle: '', tier: 'micro', followers_ig: '', campaign_name: '', status: 'prospecting', agreed_rate: '', post_date: '', notes: '' });

  const save = async () => {
    if (!brandId) return;
    const payload = { ...form, followers_ig: form.followers_ig ? parseInt(form.followers_ig) : null, agreed_rate: form.agreed_rate ? parseFloat(form.agreed_rate) : null, post_date: form.post_date || null };
    await fetch(`/api/brands/${brandId}/influencers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setShowModal(false); resetForm(); loadCampaigns(brandId);
  };

  const filtered = filter === 'all' ? campaigns : campaigns.filter(c => c.status === filter);
  const thisMonth = campaigns.filter(c => { if (!c.post_date) return false; const d = new Date(c.post_date); const now = new Date(); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
  const totalReach = campaigns.reduce((sum, c) => sum + (c.reach || 0), 0);

  // Tracking stats
  const trackingStats = {
    invited: invitations.filter(inv => inv.invited).length,
    confirmed: invitations.filter(inv => inv.confirmed).length,
    attended: invitations.filter(inv => inv.attended).length,
    posted: invitations.filter(inv => inv.posted).length,
  };

  const getInvMonthLabel = (eventMonth: string | null) => {
    if (!eventMonth) return '';
    const d = new Date(eventMonth);
    return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
  };

  if (loading) return <div className="p-4 sm:p-6"><div className="animate-pulse"><div className="h-64 bg-gray-50 rounded" /></div></div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Main Tab Toggle */}
      <div className="flex gap-1 bg-gray-50 rounded-lg p-1 w-fit">
        <button onClick={() => setMainTab('tracking')} className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition ${mainTab === 'tracking' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-900'}`}>
          <span className="flex items-center gap-1.5 sm:gap-2"><CalendarCheck size={14} /><span className="hidden sm:inline">Monthly Tracking</span><span className="sm:hidden">Tracking</span></span>
        </button>
        <button onClick={() => setMainTab('database')} className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition ${mainTab === 'database' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-900'}`}>
          <span className="flex items-center gap-1.5 sm:gap-2"><Database size={14} /><span className="hidden sm:inline">KOL Database</span><span className="sm:hidden">Database</span></span>
        </button>
        <button onClick={() => setMainTab('campaigns')} className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition ${mainTab === 'campaigns' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-900'}`}>
          <span className="flex items-center gap-1.5 sm:gap-2"><Briefcase size={14} /><span className="hidden sm:inline">Brand Campaigns</span><span className="sm:hidden">Campaigns</span></span>
        </button>
      </div>

      {/* MONTHLY TRACKING TAB */}
      {mainTab === 'tracking' && (
        <div className="space-y-4">
          {/* Month Selector + Invite Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <select
                value={trackingMonth}
                onChange={e => setTrackingMonth(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 text-xs sm:text-sm"
              >
                <option value="all" className="bg-white">All Months</option>
                {TRACKING_MONTHS.map(m => (
                  <option key={m} value={m} className="bg-white">{formatTrackingMonth(m)}</option>
                ))}
              </select>
              <span className="text-xs sm:text-sm text-gray-500">{invitations.length} KOLs</span>
            </div>
            <button
              onClick={() => { setShowInviteModal(true); setInviteSearch(''); setInviteResults([]); }}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm rounded-lg transition self-end sm:self-auto"
            >
              <Plus size={14} /><span className="hidden sm:inline">Invite KOL</span><span className="sm:hidden">Invite</span>
            </button>
          </div>

          {/* Stats Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-200">
              <div className="flex items-center gap-1.5 text-gray-500 text-[10px] sm:text-xs mb-1">📨 Invited</div>
              <span className="text-xl sm:text-2xl font-bold text-gray-900">{trackingStats.invited}</span>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-200">
              <div className="flex items-center gap-1.5 text-gray-500 text-[10px] sm:text-xs mb-1">✅ Confirmed</div>
              <span className="text-xl sm:text-2xl font-bold text-green-600">{trackingStats.confirmed}</span>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-200">
              <div className="flex items-center gap-1.5 text-gray-500 text-[10px] sm:text-xs mb-1">🎯 Attended</div>
              <span className="text-xl sm:text-2xl font-bold text-blue-600">{trackingStats.attended}</span>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-200">
              <div className="flex items-center gap-1.5 text-gray-500 text-[10px] sm:text-xs mb-1">📱 Posted</div>
              <span className="text-xl sm:text-2xl font-bold text-purple-600">{trackingStats.posted}</span>
            </div>
          </div>

          {/* Platform Legend */}
          <div className="flex items-center gap-3 text-[10px] sm:text-xs text-gray-500 px-1">
            <span className="font-medium text-gray-700">Platform posts:</span>
            <span>📸 Instagram</span>
            <span>🎵 TikTok</span>
            <span>📕 XHS</span>
            <span>🍋 Lemon8</span>
            <span className="text-purple-500 ml-1">click icon = view post | ↗ = profile</span>
          </div>

          {/* Invitations Table */}
          {trackingLoading ? (
            <div className="animate-pulse space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-gray-50 rounded-lg" />)}
            </div>
          ) : invitations.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title={trackingMonth === 'all' ? 'No KOL invitations yet' : `No KOL invitations for ${formatTrackingMonth(trackingMonth)}`}
              description="Invite KOLs from the database to track their status this month"
              action={{ label: 'Invite KOL', onClick: () => { setShowInviteModal(true); setInviteSearch(''); setInviteResults([]); } }}
            />
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-3 px-3 sm:px-4 text-xs font-medium text-gray-500">KOL</th>
                      {trackingMonth === 'all' && <th className="text-left py-3 px-2 sm:px-3 text-xs font-medium text-gray-500">Month</th>}
                      <th className="text-center py-3 px-2 sm:px-3 text-xs font-medium text-gray-500">Invited</th>
                      <th className="text-center py-3 px-2 sm:px-3 text-xs font-medium text-gray-500">Confirmed</th>
                      <th className="text-center py-3 px-2 sm:px-3 text-xs font-medium text-gray-500">Attended</th>
                      <th className="text-center py-3 px-2 sm:px-4 text-xs font-medium text-gray-500">Posts</th>
                      <th className="text-right py-3 px-3 text-xs font-medium text-gray-500"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.map(inv => (
                      <tr key={inv.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition">
                        <td className="py-3 px-3 sm:px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-[10px] sm:text-xs shrink-0">
                              {(inv.influencer?.name || '?').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <span className="text-gray-900 text-xs sm:text-sm font-medium truncate block">{inv.influencer?.name || 'Unknown'}</span>
                              <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] text-gray-500">
                                {inv.influencer?.instagram_handle && (
                                  <a href={igProfileUrl(inv.influencer.instagram_handle) || '#'} target="_blank" rel="noopener noreferrer" className="hover:text-purple-600 transition">
                                    @{inv.influencer.instagram_handle.replace('@', '')} ↗
                                  </a>
                                )}
                                {inv.influencer?.tier && <span className="capitalize">· {inv.influencer.tier}</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        {trackingMonth === 'all' && (
                          <td className="py-3 px-2 sm:px-3">
                            <span className="text-[10px] sm:text-xs text-gray-500 whitespace-nowrap">{getInvMonthLabel(inv.event_month)}</span>
                          </td>
                        )}
                        <td className="py-3 px-2 sm:px-3 text-center">
                          <button
                            onClick={() => toggleInvitationField(inv.id, 'invited', inv.invited)}
                            className={`w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center transition ${inv.invited ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                          >
                            {inv.invited ? <Check size={14} /> : <X size={14} />}
                          </button>
                        </td>
                        <td className="py-3 px-2 sm:px-3 text-center">
                          <button
                            onClick={() => toggleInvitationField(inv.id, 'confirmed', inv.confirmed)}
                            className={`w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center transition ${inv.confirmed ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                          >
                            {inv.confirmed ? <Check size={14} /> : <X size={14} />}
                          </button>
                        </td>
                        <td className="py-3 px-2 sm:px-3 text-center">
                          <button
                            onClick={() => toggleInvitationField(inv.id, 'attended', inv.attended)}
                            className={`w-6 h-6 sm:w-7 sm:h-7 rounded-md flex items-center justify-center transition ${inv.attended ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                          >
                            {inv.attended ? <Check size={14} /> : <X size={14} />}
                          </button>
                        </td>
                        {/* Platform Posts Column */}
                        <td className="py-2 px-2 sm:px-4">
                          <div className="flex items-center justify-center gap-1 sm:gap-1.5 flex-wrap">
                            <PlatformPostBadge
                              label="Instagram"
                              emoji="📸"
                              posted={inv.ig_posted}
                              postUrl={inv.ig_post_url}
                              profileUrl={igProfileUrl(inv.influencer?.instagram_handle)}
                            />
                            <PlatformPostBadge
                              label="TikTok"
                              emoji="🎵"
                              posted={inv.tt_posted}
                              postUrl={inv.tt_post_url}
                              profileUrl={ttProfileUrl(inv.influencer?.tiktok_handle)}
                            />
                            <PlatformPostBadge
                              label="XHS"
                              emoji="📕"
                              posted={inv.xhs_posted}
                              postUrl={inv.xhs_post_url}
                              profileUrl={xhsProfileUrl(inv.influencer?.xhs_handle)}
                            />
                            <PlatformPostBadge
                              label="Lemon8"
                              emoji="🍋"
                              posted={inv.l8_posted}
                              postUrl={inv.l8_post_url}
                              profileUrl={l8ProfileUrl(inv.influencer?.lemon8_handle)}
                            />
                          </div>
                          {/* Post URL - shown below platform icons if it exists */}
                          {inv.post_url && (
                            <div className="mt-1 text-center">
                              <a href={inv.post_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-purple-500 hover:text-purple-700 inline-flex items-center gap-0.5">
                                <ExternalLink size={9} /> View Post
                              </a>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => deleteInvitation(inv.id)}
                            className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 transition"
                            title="Remove invitation"
                          >
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* KOL DATABASE TAB */}
      {mainTab === 'database' && (
        <div className="space-y-4">
          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-200">
              <div className="flex items-center gap-1.5 text-gray-500 text-[10px] sm:text-xs mb-1"><Database size={14} />Total KOLs</div>
              <span className="text-xl sm:text-2xl font-bold text-gray-900">{totalInfluencers}</span>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-200">
              <div className="flex items-center gap-1.5 text-gray-500 text-[10px] sm:text-xs mb-1"><Instagram size={14} />With IG</div>
              <span className="text-xl sm:text-2xl font-bold text-purple-600">{influencers.filter(i => i.instagram_handle).length}+</span>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-200">
              <div className="flex items-center gap-1.5 text-gray-500 text-[10px] sm:text-xs mb-1"><TrendingUp size={14} />With TikTok</div>
              <span className="text-xl sm:text-2xl font-bold text-blue-600">{influencers.filter(i => i.tiktok_handle).length}+</span>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-200">
              <div className="flex items-center gap-1.5 text-gray-500 text-[10px] sm:text-xs mb-1"><Star size={14} />Campaigns</div>
              <span className="text-xl sm:text-2xl font-bold text-green-600">{campaigns.length}</span>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={dbSearch} onChange={e => { setDbSearch(e.target.value); setDbPage(0); }} placeholder="Search by name or handle..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-purple-500" />
            </div>
            <select value={dbTier} onChange={e => { setDbTier(e.target.value); setDbPage(0); }} className="bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 text-sm">
              <option value="all">All Tiers</option>
              {TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Influencer Grid */}
          {dbLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => <div key={i} className="h-32 bg-gray-50 rounded-lg animate-pulse" />)}
            </div>
          ) : influencers.length === 0 ? (
            <EmptyState icon={Users} title="No KOLs found" description={dbSearch ? `No results for "${dbSearch}"` : "No influencers in the database yet"} />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {influencers.map(inf => (
                  <div key={inf.id} className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 hover:border-purple-300 hover:shadow-sm transition group">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {(inf.name || inf.instagram_handle || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-medium text-gray-900 truncate">{inf.name || inf.instagram_handle || 'Unknown'}</h3>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {inf.tier && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-600 capitalize">{inf.tier}</span>}
                          {inf.influencer_type && <span className="text-[10px] text-gray-500 truncate max-w-[120px]">{inf.influencer_type}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Platform handles with links */}
                    <div className="mt-2.5 space-y-1">
                      {inf.instagram_handle && (
                        <div className="flex items-center justify-between text-[10px] sm:text-xs">
                          <a href={igProfileUrl(inf.instagram_handle) || '#'} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-purple-600 transition">📸 @{inf.instagram_handle.replace('@', '')} ↗</a>
                          <span className="text-gray-900 font-medium">{formatFollowers(inf.followers_ig)}</span>
                        </div>
                      )}
                      {inf.tiktok_handle && (
                        <div className="flex items-center justify-between text-[10px] sm:text-xs">
                          <a href={ttProfileUrl(inf.tiktok_handle) || '#'} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-purple-600 transition">🎵 @{inf.tiktok_handle.replace('@', '')} ↗</a>
                          <span className="text-gray-900 font-medium">{formatFollowers(inf.followers_tiktok)}</span>
                        </div>
                      )}
                      {inf.lemon8_handle && (
                        <div className="flex items-center justify-between text-[10px] sm:text-xs">
                          <a href={l8ProfileUrl(inf.lemon8_handle) || '#'} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-purple-600 transition">🍋 {inf.lemon8_handle} ↗</a>
                          <span className="text-gray-900 font-medium">{formatFollowers(inf.followers_lemon8)}</span>
                        </div>
                      )}
                      {inf.xhs_handle && (
                        <div className="flex items-center justify-between text-[10px] sm:text-xs">
                          <a href={xhsProfileUrl(inf.xhs_handle) || '#'} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-purple-600 transition">📕 {inf.xhs_handle} ↗</a>
                          <span className="text-gray-900 font-medium">{formatFollowers(inf.followers_xhs)}</span>
                        </div>
                      )}
                    </div>

                    {/* Contact & rate */}
                    <div className="mt-2 flex items-center gap-2 text-[10px] text-gray-500 flex-wrap">
                      {inf.email && <span>📧 {inf.email}</span>}
                      {inf.phone && <span>📱 {inf.phone}</span>}
                      {inf.rate_info && <span>💰 {inf.rate_info}</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalInfluencers > 50 && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-gray-500">Showing {dbPage * 50 + 1}-{Math.min((dbPage + 1) * 50, totalInfluencers)} of {totalInfluencers}</span>
                  <div className="flex gap-2">
                    <button onClick={() => setDbPage(p => Math.max(0, p - 1))} disabled={dbPage === 0} className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-600 hover:text-gray-900 disabled:opacity-30">← Prev</button>
                    <button onClick={() => setDbPage(p => p + 1)} disabled={(dbPage + 1) * 50 >= totalInfluencers} className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg text-gray-600 hover:text-gray-900 disabled:opacity-30">Next →</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* CAMPAIGNS TAB */}
      {mainTab === 'campaigns' && (
        <div className="space-y-4 sm:space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {[
              { label: 'Total Campaigns', value: campaigns.length, icon: Users },
              { label: 'Active This Month', value: thisMonth.length, icon: Star },
              { label: 'Total Reach', value: totalReach > 1000 ? `${(totalReach / 1000).toFixed(1)}K` : totalReach, icon: TrendingUp },
              { label: 'Posted', value: campaigns.filter(c => c.post_url).length, icon: Instagram },
            ].map((s, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-200">
                <div className="flex items-center gap-1.5 sm:gap-2 text-gray-500 text-[10px] sm:text-xs mb-1"><s.icon size={14} />{s.label}</div>
                <span className="text-xl sm:text-2xl font-bold text-gray-900">{s.value}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex gap-1 sm:gap-2 overflow-x-auto scrollbar-hide pb-1 sm:pb-0">
              {['all', 'confirmed', 'active', 'completed', 'prospecting'].map(s => (
                <button key={s} onClick={() => setFilter(s)} className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs rounded-full transition whitespace-nowrap ${filter === s ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:text-gray-900'}`}>
                  {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            <button onClick={() => { resetForm(); setShowModal(true); }} className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm rounded-lg transition shrink-0 self-end sm:self-auto"><Plus size={14} />Add KOL</button>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={Users} title="No influencer campaigns" description="Add KOLs and track their campaigns for this brand" action={{ label: 'Add KOL', onClick: () => { resetForm(); setShowModal(true); } }} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {filtered.map(c => (
                <div key={c.id} className="bg-white rounded-lg p-3 sm:p-4 border border-gray-200 hover:border-gray-300 hover:shadow-sm transition">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xs sm:text-sm shrink-0">{c.influencer.name.charAt(0)}</div>
                      <div className="min-w-0">
                        <h3 className="text-gray-900 font-medium text-sm truncate">{c.influencer.name}</h3>
                        {c.influencer.instagram_handle && <span className="text-[10px] sm:text-xs text-gray-500">@{c.influencer.instagram_handle}</span>}
                      </div>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="mt-2 sm:mt-3 flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-gray-500 flex-wrap">
                    {c.influencer.tier && <span className="capitalize">{c.influencer.tier}</span>}
                    {c.influencer.followers_ig && <span>{formatFollowers(c.influencer.followers_ig)}</span>}
                    {c.agreed_rate && <span>${c.agreed_rate}</span>}
                    {c.post_date && <span>{new Date(c.post_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                  </div>
                  {c.campaign_name && <p className="text-[10px] sm:text-xs text-gray-600 mt-1 sm:mt-2">Campaign: {c.campaign_name}</p>}
                  {(c.views || c.likes || c.reach) && (
                    <div className="flex gap-3 sm:gap-4 mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-gray-500">
                      {c.views && <span>👁 {c.views.toLocaleString()}</span>}
                      {c.likes && <span>❤️ {c.likes.toLocaleString()}</span>}
                      {c.reach && <span>📊 {c.reach.toLocaleString()}</span>}
                    </div>
                  )}
                  {c.post_url && <a href={c.post_url} target="_blank" rel="noopener" className="text-[10px] sm:text-xs text-purple-500 hover:text-purple-700 mt-1.5 sm:mt-2 inline-block">View Post →</a>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Campaign Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Influencer Campaign" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Influencer Name" name="influencer_name" value={form.influencer_name} onChange={e => setForm(f => ({ ...f, influencer_name: e.target.value }))} required />
            <FormField label="Instagram Handle" name="instagram_handle" value={form.instagram_handle} onChange={e => setForm(f => ({ ...f, instagram_handle: e.target.value }))} placeholder="without @" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Tier" name="tier" value={form.tier} onChange={e => setForm(f => ({ ...f, tier: e.target.value }))} options={TIERS} />
            <FormField label="Followers" name="followers_ig" type="number" value={form.followers_ig} onChange={e => setForm(f => ({ ...f, followers_ig: e.target.value }))} />
            <FormField label="Rate ($)" name="agreed_rate" type="number" value={form.agreed_rate} onChange={e => setForm(f => ({ ...f, agreed_rate: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Campaign Name" name="campaign_name" value={form.campaign_name} onChange={e => setForm(f => ({ ...f, campaign_name: e.target.value }))} />
            <FormField label="Status" name="status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} options={STATUSES} />
          </div>
          <FormField label="Post Date" name="post_date" type="date" value={form.post_date} onChange={e => setForm(f => ({ ...f, post_date: e.target.value }))} />
          <FormField label="Notes" name="notes" type="textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
            <button onClick={save} disabled={!form.influencer_name} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm rounded-lg">Add KOL</button>
          </div>
        </div>
      </Modal>

      {/* Invite KOL Modal */}
      <Modal open={showInviteModal} onClose={() => { setShowInviteModal(false); setInviteSearch(''); setInviteResults([]); }} title={`Invite KOL — ${formatTrackingMonth(inviteMonth)}`} size="md">
        <div className="space-y-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={inviteSearch}
              onChange={e => setInviteSearch(e.target.value)}
              placeholder="Search KOLs by name or handle..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-purple-500"
            />
          </div>

          {inviteLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-gray-50 rounded-lg animate-pulse" />)}
            </div>
          ) : inviteResults.length === 0 && inviteSearch ? (
            <p className="text-sm text-gray-500 text-center py-4">No KOLs found for &quot;{inviteSearch}&quot;</p>
          ) : (
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {inviteResults.map(inf => {
                const alreadyInvited = invitations.some(inv => inv.influencer_id === inf.id);
                return (
                  <div key={inf.id} className="flex items-center justify-between p-2.5 sm:p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
                        {(inf.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm text-gray-900 font-medium truncate block">{inf.name || 'Unknown'}</span>
                        <div className="flex items-center gap-2 text-[10px] text-gray-500">
                          {inf.instagram_handle && <span>📸 @{inf.instagram_handle.replace('@', '')}</span>}
                          {inf.tier && <span className="capitalize">{inf.tier}</span>}
                          {inf.followers_ig && <span>{formatFollowers(inf.followers_ig)}</span>}
                        </div>
                      </div>
                    </div>
                    {alreadyInvited ? (
                      <span className="text-[10px] sm:text-xs text-green-600 px-2 py-1 bg-green-50 rounded border border-green-200">Invited ✓</span>
                    ) : (
                      <button
                        onClick={() => createInvitation(inf.id)}
                        className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition shrink-0"
                      >
                        Invite
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!inviteSearch && (
            <p className="text-xs text-gray-500 text-center py-2">Type a name or handle to search the KOL database</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
