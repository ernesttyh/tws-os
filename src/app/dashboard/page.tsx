'use client';
import { useState, useEffect, useMemo } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { BarChart3, AlertTriangle, CheckCircle, Clock, TrendingUp, Palette, Layout, Users, ChevronDown, ExternalLink, Calendar as CalendarIcon, Edit2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

/* ─── Types ─── */
interface BrandSummary { id: string; name: string; slug: string; brand_group: string; google_sheet_id: string | null; tasks_total: number; tasks_overdue: number; content_count: number; meetings_this_month: number; active_ads: number; kol_count: number; health: number }
interface DesignBrief { id: string; brand_id: string; brand_name: string; brand_slug: string; title: string; description: string | null; dimensions: string | null; status: string; deadline: string | null; revision_count: number; assigned_to: string | null; assignee_name: string | null; drive_folder_url: string | null; created_at: string }
interface ContentItem { id: string; brand_id: string; brand_name: string; brand_slug: string; platform: string; status: string; date: string | null; caption: string | null; month: string | null }

type ViewMode = 'master' | 'am' | 'designer';

const DESIGN_STATUSES = [
  { value: 'brief', label: 'Brief', color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  { value: 'internal_review', label: 'Internal Review', color: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  { value: 'client_review', label: 'Client Review', color: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  { value: 'revision', label: 'Revision', color: 'bg-purple-100 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
  { value: 'approved', label: 'Approved', color: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500' },
];

const GROUP_COLORS: Record<string, string> = {
  neo_group: 'bg-blue-50 text-blue-700 border-blue-200',
  fleursophy: 'bg-pink-50 text-pink-700 border-pink-200',
  deprosperoo: 'bg-amber-50 text-amber-700 border-amber-200',
  independent: 'bg-gray-50 text-gray-700 border-gray-200',
  tsim: 'bg-violet-50 text-violet-700 border-violet-200',
};


// ── My Tasks Section ──
function MyTasksSection() {
  const [tasks, setTasks] = useState<{ id: string; title: string; status: string; priority: string; due_date: string | null; brand?: { id: string; name: string; slug: string } | null }[]>([]);
  const [memberName, setMemberName] = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const supabase = createBrowserClient();

  useEffect(() => {
    const loadMyTasks = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/my-tasks');
        if (res.ok) {
          const data = await res.json();
          setTasks(data.tasks || []);
          setMemberName(data.member?.name || '');
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    loadMyTasks();
  }, []);

  if (loading) return <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse"><div className="h-6 bg-gray-100 rounded w-32" /></div>;
  if (!memberName || tasks.length === 0) return null;

  const STATUS_ICONS: Record<string, string> = { backlog: '📋', todo: '📌', in_progress: '🔄', review: '👀', done: '✅' };
  const STATUS_COLORS: Record<string, string> = { backlog: 'bg-gray-100 text-gray-600', todo: 'bg-blue-50 text-blue-600', in_progress: 'bg-amber-50 text-amber-600', review: 'bg-purple-50 text-purple-600', done: 'bg-green-50 text-green-600' };
  const PRIORITY_ICONS: Record<string, string> = { urgent: '🔴', high: '🟠', medium: '🟡', low: '⚪' };

  const activeTasks = tasks.filter(t => t.status !== 'done');
  const overdueTasks = activeTasks.filter(t => t.due_date && new Date(t.due_date) < new Date());

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">📋 My Tasks</span>
          <span className="text-xs text-gray-500">({activeTasks.length} active{overdueTasks.length > 0 && <span className="text-red-500 ml-1">{overdueTasks.length} overdue</span>})</span>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {expanded && (
        <div className="border-t border-gray-100">
          <div className="divide-y divide-gray-50">
            {activeTasks.slice(0, 10).map(task => {
              const isOverdue = task.due_date && new Date(task.due_date) < new Date();
              return (
                <div key={task.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition cursor-pointer"
                     onClick={() => task.brand?.slug && (window.location.href = `/dashboard/brand/${task.brand.slug}/operations`)}>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${STATUS_COLORS[task.status] || 'bg-gray-100 text-gray-500'}`}>
                    {STATUS_ICONS[task.status] || '📋'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-900 truncate">{task.title}</div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                      {task.brand?.name && <span className="font-medium text-purple-600">{task.brand.name}</span>}
                      <span>{PRIORITY_ICONS[task.priority] || ''} {task.priority}</span>
                    </div>
                  </div>
                  {task.due_date && (
                    <span className={`text-[10px] shrink-0 ${isOverdue ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                      {isOverdue ? '⚠️ ' : ''}{new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </div>
              );
            })}
            {activeTasks.length > 10 && (
              <div className="px-4 py-2 text-center text-xs text-gray-400">
                +{activeTasks.length - 10} more tasks
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [view, setView] = useState<ViewMode>('master');
  const [brands, setBrands] = useState<BrandSummary[]>([]);
  const [briefs, setBriefs] = useState<DesignBrief[]>([]);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [briefsLoading, setBriefsLoading] = useState(false);
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const supabase = createBrowserClient();

  // Load master data (brands)
  useEffect(() => {
    async function loadMaster() {
      const { data: brandList } = await supabase.from('brands').select('*').eq('status', 'active').order('name');
      if (!brandList) { setLoading(false); return; }

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      const summaries: BrandSummary[] = await Promise.all(brandList.map(async (b) => {
        const [tasks, content, meetings, ads, kol] = await Promise.all([
          supabase.from('tasks').select('id,status,due_date').eq('brand_id', b.id),
          supabase.from('content_items').select('id').eq('brand_id', b.id),
          supabase.from('calendar_events').select('id').eq('brand_id', b.id).eq('event_type', 'meeting').gte('start_date', monthStart).lte('start_date', monthEnd),
          supabase.from('ad_campaigns').select('id').eq('brand_id', b.id).eq('status', 'active'),
          supabase.from('influencer_invitations').select('id').eq('brand_id', b.id),
        ]);

        const taskList = tasks.data || [];
        const overdue = taskList.filter(t => t.due_date && new Date(t.due_date) < now && t.status !== 'done' && t.status !== 'archived').length;
        const health = Math.min(100, Math.round(
          (overdue === 0 ? 25 : Math.max(0, 25 - overdue * 5)) +
          ((meetings.data || []).length >= 1 ? 25 : 0) +
          ((content.data || []).length > 0 ? 25 : 10) +
          ((ads.data || []).length > 0 || (kol.data || []).length > 0 ? 25 : 10)
        ));

        return {
          id: b.id, name: b.name, slug: b.slug, brand_group: b.brand_group, google_sheet_id: b.google_sheet_id || null,
          tasks_total: taskList.length, tasks_overdue: overdue,
          content_count: (content.data || []).length,
          meetings_this_month: (meetings.data || []).length,
          active_ads: (ads.data || []).length,
          kol_count: (kol.data || []).length,
          health,
        };
      }));

      setBrands(summaries.sort((a, b) => a.health - b.health));
      setLoading(false);
    }
    loadMaster();
  }, [supabase]);

  // Load designer data when designer tab is selected
  useEffect(() => {
    if (view !== 'designer') return;
    async function loadDesigner() {
      setBriefsLoading(true);
      const { data: brandList } = await supabase.from('brands').select('id,name,slug').eq('status', 'active').order('name');
      if (!brandList) { setBriefsLoading(false); return; }

      const brandMap = Object.fromEntries(brandList.map(b => [b.id, b]));
      const { data: allBriefs } = await supabase.from('design_briefs').select('*').order('deadline', { ascending: true, nullsFirst: false });

      const enriched: DesignBrief[] = (allBriefs || [])
        .filter(b => brandMap[b.brand_id])
        .map(b => ({
          ...b,
          brand_name: brandMap[b.brand_id]?.name || 'Unknown',
          brand_slug: brandMap[b.brand_id]?.slug || '',
          assignee_name: null,
        }));

      setBriefs(enriched);
      setBriefsLoading(false);
    }
    loadDesigner();
  }, [view, supabase]);

  // Load AM content data when AM tab is selected
  useEffect(() => {
    if (view !== 'am') return;
    async function loadAM() {
      setBriefsLoading(true);
      const { data: brandList } = await supabase.from('brands').select('id,name,slug').eq('status', 'active').order('name');
      if (!brandList) { setBriefsLoading(false); return; }

      const now = new Date();
      const currentMonth = now.toLocaleString('en-US', { month: 'long', year: 'numeric' }); // "April 2026"
      const brandMap = Object.fromEntries(brandList.map(b => [b.id, b]));

      const { data: content } = await supabase.from('content_items').select('id,brand_id,platform,status,date,caption,month').eq('month', currentMonth);

      const enriched: ContentItem[] = (content || [])
        .filter(c => brandMap[c.brand_id])
        .map(c => ({
          ...c,
          brand_name: brandMap[c.brand_id]?.name || 'Unknown',
          brand_slug: brandMap[c.brand_id]?.slug || '',
        }));

      setContentItems(enriched);
      setBriefsLoading(false);
    }
    loadAM();
  }, [view, supabase]);

  const healthColor = (h: number) => h >= 80 ? 'text-green-600' : h >= 50 ? 'text-yellow-600' : 'text-red-500';
  const healthBg = (h: number) => h >= 80 ? 'bg-green-500' : h >= 50 ? 'bg-yellow-500' : 'bg-red-500';

  const totalBrands = brands.length;
  const needsAttention = brands.filter(b => b.health < 50).length;
  const totalOverdue = brands.reduce((s, b) => s + b.tasks_overdue, 0);
  const avgHealth = Math.round(brands.reduce((s, b) => s + b.health, 0) / (brands.length || 1));

  // Filtered brands for master/AM
  const filteredBrands = useMemo(() => {
    let result = brands;
    if (groupFilter !== 'all') result = result.filter(b => b.brand_group === groupFilter);
    return result;
  }, [brands, groupFilter]);

  // Filtered briefs for designer
  const filteredBriefs = useMemo(() => {
    if (brandFilter === 'all') return briefs;
    return briefs.filter(b => b.brand_id === brandFilter);
  }, [briefs, brandFilter]);

  const briefBrands = useMemo(() => {
    const map = new Map<string, string>();
    briefs.forEach(b => map.set(b.brand_id, b.brand_name));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [briefs]);

  // Content stats for AM view
  const contentStats = useMemo(() => {
    const byBrand = new Map<string, { name: string; slug: string; total: number; posted: number; scheduled: number; planned: number; review: number; approved: number }>();
    contentItems.forEach(c => {
      if (!byBrand.has(c.brand_id)) byBrand.set(c.brand_id, { name: c.brand_name, slug: c.brand_slug, total: 0, posted: 0, scheduled: 0, planned: 0, review: 0, approved: 0 });
      const entry = byBrand.get(c.brand_id)!;
      entry.total++;
      if (c.status === 'posted') entry.posted++;
      else if (c.status === 'scheduled') entry.scheduled++;
      else if (c.status === 'planned') entry.planned++;
      else if (c.status === 'review') entry.review++;
      else if (c.status === 'approved') entry.approved++;
    });
    return Array.from(byBrand.values()).sort((a, b) => b.total - a.total);
  }, [contentItems]);

  if (loading) return <div className="p-4 sm:p-6"><div className="animate-pulse space-y-4"><div className="h-12 bg-gray-100 rounded-xl" /><div className="h-24 bg-gray-50 rounded-xl" /><div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-gray-50 rounded-xl" />)}</div></div></div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header + View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-xs sm:text-sm">TWS OS Command Center — <span className="font-medium text-gray-700">{new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}</span></p>
        </div>
        <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs sm:text-sm">
          {([
            { key: 'master', icon: BarChart3, label: 'Master' },
            { key: 'am', icon: Users, label: 'AM' },
            { key: 'designer', icon: Palette, label: 'Designer' },
          ] as const).map(v => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md transition font-medium ${view === v.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <v.icon size={14} />
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-medium">
            📅 {new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}
          </span>
        </div>
        <a
          href="/form/design-request"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition"
        >
          🎨 Design Request Form ↗
        </a>
      </div>

      {/* My Tasks Section */}
      <MyTasksSection />

      {/* ─── MASTER VIEW ─── */}
      {view === 'master' && (
        <>
          {/* Global Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-200 shadow-sm"><div className="text-[10px] sm:text-xs text-gray-500 mb-1">Active Brands</div><div className="text-2xl sm:text-3xl font-bold text-gray-900">{totalBrands}</div></div>
            <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-200 shadow-sm"><div className="text-[10px] sm:text-xs text-gray-500 mb-1">Needs Attention</div><div className={`text-2xl sm:text-3xl font-bold ${needsAttention > 0 ? 'text-red-500' : 'text-green-600'}`}>{needsAttention}</div></div>
            <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-200 shadow-sm"><div className="text-[10px] sm:text-xs text-gray-500 mb-1">Overdue Tasks</div><div className={`text-2xl sm:text-3xl font-bold ${totalOverdue > 0 ? 'text-red-500' : 'text-green-600'}`}>{totalOverdue}</div></div>
            <div className="bg-white rounded-xl p-3 sm:p-4 border border-gray-200 shadow-sm"><div className="text-[10px] sm:text-xs text-gray-500 mb-1">Avg Health</div><div className={`text-2xl sm:text-3xl font-bold ${healthColor(avgHealth)}`}>{avgHealth}</div></div>
          </div>

          {/* Group Filter */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button onClick={() => setGroupFilter('all')} className={`px-3 py-1 rounded-full text-xs font-medium border transition whitespace-nowrap ${groupFilter === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>All Groups</button>
            {['neo_group', 'fleursophy', 'deprosperoo', 'independent', 'tsim'].map(g => (
              <button key={g} onClick={() => setGroupFilter(g)} className={`px-3 py-1 rounded-full text-xs font-medium border transition whitespace-nowrap ${groupFilter === g ? 'bg-gray-900 text-white border-gray-900' : `${GROUP_COLORS[g] || 'bg-white text-gray-600 border-gray-200'}`}`}>
                {g.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} ({brands.filter(b => b.brand_group === g).length})
              </button>
            ))}
          </div>

          {/* Brand Cards — Mobile */}
          <div className="sm:hidden space-y-2">
            {filteredBrands.map(b => (
              <Link key={b.id} href={`/dashboard/brand/${b.slug}`} className="block bg-white rounded-lg p-3 border border-gray-200 active:bg-gray-50 transition shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-gray-900 font-medium text-sm">{b.name}</span>
                    <div className="text-[10px] text-gray-400 capitalize">{b.brand_group?.replace('_', ' ')}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-10 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${healthBg(b.health)}`} style={{ width: `${b.health}%` }} /></div>
                    <span className={`text-xs font-semibold ${healthColor(b.health)}`}>{b.health}</span>
                  </div>
                </div>
                <div className="flex gap-3 text-[10px] text-gray-500">
                  <span>📋 {b.tasks_total}{b.tasks_overdue > 0 && <span className="text-red-500 ml-0.5">({b.tasks_overdue}⚠️)</span>}</span>
                  <span>📝 {b.content_count}</span>
                  <span>📅 {b.meetings_this_month}</span>
                  <span>📊 {b.active_ads}</span>
                  {b.google_sheet_id && (
                    <a href={`https://docs.google.com/spreadsheets/d/${b.google_sheet_id}/edit`} target="_blank" rel="noopener noreferrer" onClick={e => { e.preventDefault(); e.stopPropagation(); window.open(`https://docs.google.com/spreadsheets/d/${b.google_sheet_id}/edit`, '_blank'); }} className="text-green-600 hover:text-green-800 font-medium">📊 Sheet ↗</a>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {/* Brand Table — Desktop */}
          <div className="hidden sm:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Brand</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Group</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-600">Health</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-600">Tasks</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-600">Overdue</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-600">Content</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-600">Meetings</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-600">Ads</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-600">KOL</th>
                
                  <th className="text-center py-3 px-4 font-semibold text-gray-600 w-16">Sheet</th>
                </tr>
              </thead>
              <tbody>
                {filteredBrands.map(b => (
                  <tr key={b.id} className="border-b border-gray-100 hover:bg-gray-50 transition cursor-pointer" onClick={() => window.location.href = `/dashboard/brand/${b.slug}`}>
                    <td className="py-3 px-4 font-medium text-gray-900">{b.name}</td>
                    <td className="py-3 px-4"><span className={`text-xs px-2 py-0.5 rounded-full border ${GROUP_COLORS[b.brand_group] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>{b.brand_group?.replace('_', ' ')}</span></td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${healthBg(b.health)}`} style={{ width: `${b.health}%` }} /></div>
                        <span className={`text-xs font-semibold ${healthColor(b.health)}`}>{b.health}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center text-gray-700">{b.tasks_total}</td>
                    <td className="py-3 px-4 text-center"><span className={b.tasks_overdue > 0 ? 'text-red-500 font-semibold' : 'text-gray-400'}>{b.tasks_overdue}</span></td>
                    <td className="py-3 px-4 text-center text-gray-700">{b.content_count}</td>
                    <td className="py-3 px-4 text-center text-gray-700">{b.meetings_this_month}</td>
                    <td className="py-3 px-4 text-center text-gray-700">{b.active_ads}</td>
                    <td className="py-3 px-4 text-center text-gray-700">{b.kol_count}</td>
                    <td className="py-3 px-4 text-center">{b.google_sheet_id ? (
                      <a href={`https://docs.google.com/spreadsheets/d/${b.google_sheet_id}/edit`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="inline-flex items-center gap-0.5 text-green-600 hover:text-green-800 transition" title="Open Google Sheet">
                        📊 <span className="text-[10px]">↗</span>
                      </a>
                    ) : <span className="text-gray-300">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ─── AM VIEW — Content Pipeline Overview ─── */}
      {view === 'am' && (
        <>
          {briefsLoading ? (
            <div className="animate-pulse space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}</div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm"><div className="text-[10px] text-gray-500 mb-1">Total Content</div><div className="text-2xl font-bold text-gray-900">{contentItems.length}</div></div>
                <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm"><div className="text-[10px] text-gray-500 mb-1">Posted</div><div className="text-2xl font-bold text-green-600">{contentItems.filter(c => c.status === 'posted').length}</div></div>
                <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm"><div className="text-[10px] text-gray-500 mb-1">Scheduled</div><div className="text-2xl font-bold text-purple-600">{contentItems.filter(c => c.status === 'scheduled').length}</div></div>
                <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm"><div className="text-[10px] text-gray-500 mb-1">In Review</div><div className="text-2xl font-bold text-orange-600">{contentItems.filter(c => c.status === 'review').length}</div></div>
                <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm"><div className="text-[10px] text-gray-500 mb-1">Planned</div><div className="text-2xl font-bold text-blue-600">{contentItems.filter(c => c.status === 'planned').length}</div></div>
              </div>

              <h3 className="text-sm font-semibold text-gray-700 mt-2">Content Pipeline by Brand — {new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}</h3>

              {/* Brand content cards */}
              <div className="space-y-2">
                {contentStats.length === 0 ? (
                  <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-400 text-sm">No content items this month</div>
                ) : contentStats.map(cs => {
                  const pct = cs.total > 0 ? Math.round((cs.posted / cs.total) * 100) : 0;
                  return (
                    <Link key={cs.slug} href={`/dashboard/brand/${cs.slug}/content`} className="block bg-white rounded-xl p-3 sm:p-4 border border-gray-200 shadow-sm hover:border-gray-300 transition">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{cs.name}</span>
                          <span className="text-[10px] text-gray-400">{cs.total} items</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-green-600">{pct}% posted</span>
                          <ArrowRight size={12} className="text-gray-400" />
                        </div>
                      </div>
                      {/* Pipeline bar */}
                      <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
                        {cs.posted > 0 && <div className="bg-green-500 transition-all" style={{ width: `${(cs.posted / cs.total) * 100}%` }} title={`Posted: ${cs.posted}`} />}
                        {cs.scheduled > 0 && <div className="bg-purple-500 transition-all" style={{ width: `${(cs.scheduled / cs.total) * 100}%` }} title={`Scheduled: ${cs.scheduled}`} />}
                        {cs.approved > 0 && <div className="bg-emerald-400 transition-all" style={{ width: `${(cs.approved / cs.total) * 100}%` }} title={`Approved: ${cs.approved}`} />}
                        {cs.review > 0 && <div className="bg-orange-400 transition-all" style={{ width: `${(cs.review / cs.total) * 100}%` }} title={`Review: ${cs.review}`} />}
                        {cs.planned > 0 && <div className="bg-blue-400 transition-all" style={{ width: `${(cs.planned / cs.total) * 100}%` }} title={`Planned: ${cs.planned}`} />}
                      </div>
                      {/* Legend */}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[10px] text-gray-500">
                        {cs.posted > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />{cs.posted} posted</span>}
                        {cs.scheduled > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-purple-500" />{cs.scheduled} scheduled</span>}
                        {cs.approved > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{cs.approved} approved</span>}
                        {cs.review > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-400" />{cs.review} review</span>}
                        {cs.planned > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" />{cs.planned} planned</span>}
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Overdue Tasks Summary */}
              {brands.filter(b => b.tasks_overdue > 0).length > 0 && (
                <>
                  <h3 className="text-sm font-semibold text-red-600 mt-4 flex items-center gap-1.5"><AlertTriangle size={14} /> Brands with Overdue Tasks</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {brands.filter(b => b.tasks_overdue > 0).sort((a, b) => b.tasks_overdue - a.tasks_overdue).map(b => (
                      <Link key={b.id} href={`/dashboard/brand/${b.slug}/operations`} className="bg-red-50 rounded-lg p-2.5 border border-red-100 hover:border-red-200 transition">
                        <div className="text-sm font-medium text-gray-900">{b.name}</div>
                        <div className="text-xs text-red-600 font-semibold">{b.tasks_overdue} overdue</div>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      {/* ─── DESIGNER VIEW — Cross-Brand Kanban ─── */}
      {view === 'designer' && (
        <>
          {briefsLoading ? (
            <div className="animate-pulse space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-48 bg-gray-100 rounded-xl" />)}</div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
                {DESIGN_STATUSES.map(s => {
                  const count = filteredBriefs.filter(b => b.status === s.value).length;
                  return (
                    <div key={s.value} className={`rounded-xl p-2.5 sm:p-3 border ${s.color}`}>
                      <div className="text-[10px] sm:text-xs font-medium opacity-80">{s.label}</div>
                      <div className="text-lg sm:text-2xl font-bold">{count}</div>
                    </div>
                  );
                })}
              </div>

              {/* Brand filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500 font-medium">Filter:</span>
                <button onClick={() => setBrandFilter('all')} className={`px-3 py-1 rounded-full text-xs font-medium border transition ${brandFilter === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                  All ({briefs.length})
                </button>
                {briefBrands.map(([id, name]) => (
                  <button key={id} onClick={() => setBrandFilter(id)} className={`px-3 py-1 rounded-full text-xs font-medium border transition ${brandFilter === id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                    {name} ({briefs.filter(b => b.brand_id === id).length})
                  </button>
                ))}
              </div>

              {filteredBriefs.length === 0 ? (
                <div className="bg-gray-50 rounded-xl p-12 text-center">
                  <Palette size={40} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 text-sm">No design briefs found</p>
                  <p className="text-gray-400 text-xs mt-1">Create briefs from individual brand Design Hub pages</p>
                </div>
              ) : (
                /* Kanban Board */
                <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0">
                  {DESIGN_STATUSES.map(stage => {
                    const items = filteredBriefs.filter(b => b.status === stage.value);
                    return (
                      <div key={stage.value} className="bg-gray-50 rounded-xl p-3 min-w-[260px] sm:min-w-[220px] flex-1 flex-shrink-0">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${stage.dot}`} />
                            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{stage.label}</span>
                          </div>
                          <span className="text-xs text-gray-400 font-medium">{items.length}</span>
                        </div>
                        <div className="space-y-2 min-h-[100px]">
                          {items.map(b => (
                            <Link key={b.id} href={`/dashboard/brand/${b.brand_slug}/design`} className="block bg-white rounded-lg p-3 border border-gray-200 hover:border-gray-300 hover:shadow-sm transition group">
                              <div className="flex items-start justify-between gap-1">
                                <span className="text-sm text-gray-900 font-medium leading-tight">{b.title}</span>
                                <ArrowRight size={12} className="text-gray-300 group-hover:text-gray-500 mt-0.5 shrink-0" />
                              </div>
                              <div className="mt-1.5 flex items-center gap-1.5">
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">{b.brand_name}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-500">
                                {b.dimensions && <span>📐 {b.dimensions}</span>}
                                {b.deadline && (
                                  <span className={`flex items-center gap-0.5 ${new Date(b.deadline) < new Date() ? 'text-red-500 font-medium' : ''}`}>
                                    <CalendarIcon size={9} />
                                    {new Date(b.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                  </span>
                                )}
                                {b.revision_count > 0 && <span>🔄 {b.revision_count}</span>}
                              </div>
                              {b.drive_folder_url && (
                                <a href={b.drive_folder_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="flex items-center gap-0.5 text-[10px] text-blue-500 hover:text-blue-700 mt-1">
                                  <ExternalLink size={9} /> Drive folder
                                </a>
                              )}
                            </Link>
                          ))}
                          {items.length === 0 && (
                            <div className="text-center py-6 text-gray-300 text-xs">No briefs</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Summary by brand */}
              {filteredBriefs.length > 0 && brandFilter === 'all' && (
                <>
                  <h3 className="text-sm font-semibold text-gray-700 mt-2">Briefs by Brand</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {briefBrands.map(([id, name]) => {
                      const brandBriefs = briefs.filter(b => b.brand_id === id);
                      const done = brandBriefs.filter(b => b.status === 'approved').length;
                      const active = brandBriefs.length - done;
                      const overdue = brandBriefs.filter(b => b.deadline && new Date(b.deadline) < new Date() && b.status !== 'approved').length;
                      return (
                        <div key={id} className="bg-white rounded-lg p-2.5 border border-gray-200 shadow-sm">
                          <div className="text-sm font-medium text-gray-900">{name}</div>
                          <div className="flex gap-2 mt-1 text-[10px] text-gray-500">
                            <span>{active} active</span>
                            <span className="text-green-600">{done} done</span>
                            {overdue > 0 && <span className="text-red-500 font-medium">{overdue} overdue</span>}
                          </div>
                          {/* Mini pipeline */}
                          <div className="flex h-1 rounded-full overflow-hidden bg-gray-100 mt-1.5">
                            {done > 0 && <div className="bg-green-500" style={{ width: `${(done / brandBriefs.length) * 100}%` }} />}
                            {active > 0 && <div className="bg-yellow-400" style={{ width: `${(active / brandBriefs.length) * 100}%` }} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
