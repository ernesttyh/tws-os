'use client';
import { useState, useEffect, useCallback, use } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { Image, Plus, Trash2, Edit2, Camera, CalendarDays, ExternalLink, Link as LinkIcon, FileText, Eye } from 'lucide-react';

type SubTab = 'calendar' | 'briefs';

interface ContentItem { id: string; title: string | null; contents: string | null; content_type: string; status: string; date: string | null; day_of_week: string | null; caption: string | null; hashtags: string | null; link: string | null; schedule_time: string | null; month: string; comments: string | null }
interface ShootBrief { id: string; title: string; shoot_date: string | null; shoot_time: string | null; location: string | null; status: string; shot_list: string | null; talent: string | null; client_requirements: string | null; notes: string | null }

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const CONTENT_TYPES = [{ value: 'reel', label: '🎬 Reel' }, { value: 'carousel', label: '📱 Carousel' }, { value: 'static', label: '🖼 Static' }, { value: 'story', label: '📖 Story' }, { value: 'video', label: '🎥 Video' }, { value: 'tiktok', label: '🎵 TikTok' }, { value: 'blog', label: '✍️ Blog' }, { value: 'edm', label: '📧 EDM' }];
const CONTENT_STATUSES = [{ value: 'idea', label: 'Idea' }, { value: 'planned', label: 'Planned' }, { value: 'in_progress', label: 'In Progress' }, { value: 'review', label: 'Review' }, { value: 'approved', label: 'Approved' }, { value: 'scheduled', label: 'Scheduled' }, { value: 'posted', label: 'Posted' }];

function getTypeEmoji(t: string) {
  const m: Record<string, string> = { reel: '🎬', carousel: '📱', static: '🖼', story: '📖', video: '🎥', tiktok: '🎵', blog: '✍️', edm: '📧' };
  return m[t] || '📄';
}

function getSmartStatus(status: string, date: string | null): string {
  // If marked as "posted" but date is in the future, it's actually "scheduled"
  if (status === 'posted' && date) {
    const d = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d > today) return 'scheduled';
  }
  return status;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  idea: { bg: 'bg-gray-100', text: 'text-gray-600', ring: 'ring-gray-300' },
  planned: { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-300' },
  in_progress: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-300' },
  review: { bg: 'bg-orange-50', text: 'text-orange-700', ring: 'ring-orange-300' },
  approved: { bg: 'bg-teal-50', text: 'text-teal-700', ring: 'ring-teal-300' },
  scheduled: { bg: 'bg-purple-50', text: 'text-purple-700', ring: 'ring-purple-300' },
  posted: { bg: 'bg-green-50', text: 'text-green-700', ring: 'ring-green-300' },
};


function cleanText(t: string | null): string {
  if (!t) return '';
  // Fix literal Unicode escape sequences that may come from imports
  return t
    .replace(/\\u201c/g, '“')
    .replace(/\\u201d/g, '”')
    .replace(/\\u2019/g, '’')
    .replace(/\\u2018/g, '‘')
    .replace(/\\u2026/g, '…')
    .replace(/\\u2013/g, '–')
    .replace(/\\n/g, '\n');
}

function formatMonth(m: string): string {
  // "April 2026" -> "Apr 2026"
  const parts = m.split(' ');
  if (parts.length === 2) return parts[0].slice(0, 3) + ' ' + parts[1];
  return m;
}

function StatusPill({ status }: { status: string }) {
  const label = status.replace('_', ' ');
  const c = STATUS_COLORS[status] || STATUS_COLORS.idea;
  return (
    <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full ring-1 font-medium capitalize ${c.bg} ${c.text} ${c.ring}`}>
      {label}
    </span>
  );
}

function LinkCell({ url }: { url: string | null }) {
  if (!url) return <span className="text-gray-300">—</span>;
  // Detect known link types
  let label = 'Link';
  let icon = <LinkIcon size={12} />;
  const u = url.toLowerCase();
  if (u.includes('frame.io') || u.includes('framecreative')) { label = 'Frame.io'; icon = <FileText size={12} />; }
  else if (u.includes('canva.com')) { label = 'Canva'; }
  else if (u.includes('drive.google')) { label = 'Drive'; }
  else if (u.includes('docs.google')) { label = 'Docs'; }
  else if (u.includes('statusbrew')) { label = 'StatusBrew'; }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-800 hover:underline text-xs transition">
      {icon} {label} <ExternalLink size={10} />
    </a>
  );
}

export default function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [subTab, setSubTab] = useState<SubTab>('calendar');
  const [brandId, setBrandId] = useState<string | null>(null);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [shoots, setShoots] = useState<ShootBrief[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return months[d.getMonth()] + ' ' + d.getFullYear();
  });
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showContentModal, setShowContentModal] = useState(false);
  const [showShootModal, setShowShootModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [editContent, setEditContent] = useState<ContentItem | null>(null);
  const [editShoot, setEditShoot] = useState<ShootBrief | null>(null);

  const supabase = createBrowserClient();

  const loadBrand = useCallback(async () => {
    const { data } = await supabase.from('brands').select('id').eq('slug', slug).single();
    if (data) { setBrandId(data.id); return data.id; }
    return null;
  }, [slug, supabase]);

  const loadData = useCallback(async (bid: string) => {
    setLoading(true);
    const monthParam = ''; // Load all, filter client-side
    const [contentRes, shootsRes] = await Promise.all([
      fetch(`/api/brands/${bid}/content${monthParam}`),
      fetch(`/api/brands/${bid}/shoots`),
    ]);
    if (contentRes.ok) setContent(await contentRes.json());
    if (shootsRes.ok) setShoots(await shootsRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { loadBrand().then(bid => { if (bid) loadData(bid); }); }, [loadBrand, loadData]);
  useEffect(() => { if (brandId) loadData(brandId); }, [brandId, loadData]);

  // Content form
  const [contentForm, setContentForm] = useState({ title: '', contents: '', content_type: 'static', status: 'planned', date: '', day_of_week: '', caption: '', hashtags: '', link: '', schedule_time: '', comments: '' });
  const resetContentForm = () => setContentForm({ title: '', contents: '', content_type: 'static', status: 'planned', date: '', day_of_week: '', caption: '', hashtags: '', link: '', schedule_time: '', comments: '' });

  const saveContent = async () => {
    if (!brandId) return;
    const payload = { ...contentForm, month: selectedMonth === 'All' ? MONTHS[new Date().getMonth()] : selectedMonth };
    Object.keys(payload).forEach(k => { if (payload[k as keyof typeof payload] === '') (payload as Record<string, unknown>)[k] = null; });
    if (editContent) {
      await fetch(`/api/brands/${brandId}/content/${editContent.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } else {
      await fetch(`/api/brands/${brandId}/content`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
    setShowContentModal(false); setEditContent(null); resetContentForm(); loadData(brandId);
  };

  const deleteContent = async (id: string) => { if (!brandId || !confirm('Delete?')) return; await fetch(`/api/brands/${brandId}/content/${id}`, { method: 'DELETE' }); loadData(brandId); };

  const quickUpdateStatus = async (id: string, newStatus: string) => {
    if (!brandId) return;
    await fetch(`/api/brands/${brandId}/content/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
    setContent(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
  };

  // Shoot form
  const [shootForm, setShootForm] = useState({ title: '', shoot_date: '', shoot_time: '', location: '', status: 'planned', shot_list: '', talent: '', client_requirements: '', notes: '' });
  const resetShootForm = () => setShootForm({ title: '', shoot_date: '', shoot_time: '', location: '', status: 'planned', shot_list: '', talent: '', client_requirements: '', notes: '' });

  const saveShoot = async () => {
    if (!brandId) return;
    const payload = { ...shootForm };
    Object.keys(payload).forEach(k => { if (payload[k as keyof typeof payload] === '') (payload as Record<string, unknown>)[k] = null; });
    if (editShoot) {
      await fetch(`/api/brands/${brandId}/shoots/${editShoot.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } else {
      await fetch(`/api/brands/${brandId}/shoots`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
    setShowShootModal(false); setEditShoot(null); resetShootForm(); loadData(brandId);
  };

  // Filtered + sorted content
  const filteredContent = content
    .map(c => ({ ...c, smartStatus: getSmartStatus(c.status, c.date) }))
    .filter(c => selectedMonth === 'All' || c.month === selectedMonth)
    .filter(c => statusFilter === 'all' || c.smartStatus === statusFilter)
    .sort((a, b) => {
      if (a.date && b.date) return b.date.localeCompare(a.date);
      if (a.date) return -1;
      if (b.date) return 1;
      return 0;
    });

  // Status counts for the pipeline strip
  const statusCounts = content.reduce((acc, c) => {
    const s = getSmartStatus(c.status, c.date);
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading) return <div className="p-4 sm:p-6"><div className="animate-pulse space-y-4"><div className="h-8 bg-gray-50 rounded w-48" /><div className="h-64 bg-gray-50 rounded" /></div></div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Sub navigation */}
      <div className="flex gap-1 bg-gray-50 rounded-lg p-1 w-fit">
        <button onClick={() => setSubTab('calendar')} className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition ${subTab === 'calendar' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-900'}`}>
          <span className="flex items-center gap-1.5 sm:gap-2"><CalendarDays size={14} /><span className="hidden sm:inline">Content Calendar</span><span className="sm:hidden">Calendar</span></span>
        </button>
        <button onClick={() => setSubTab('briefs')} className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition ${subTab === 'briefs' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-900'}`}>
          <span className="flex items-center gap-1.5 sm:gap-2"><Camera size={14} /><span className="hidden sm:inline">Shoot Briefs</span><span className="sm:hidden">Briefs</span></span>
        </button>
      </div>

      {/* CONTENT CALENDAR */}
      {subTab === 'calendar' && (
        <div className="space-y-3 sm:space-y-4">
          {/* Status pipeline strip */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            <button onClick={() => setStatusFilter('all')}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-medium transition ring-1 ${statusFilter === 'all' ? 'bg-purple-600 text-white ring-purple-600' : 'bg-white text-gray-600 ring-gray-200 hover:ring-gray-400'}`}>
              All ({content.length})
            </button>
            {CONTENT_STATUSES.map(s => {
              const count = statusCounts[s.value] || 0;
              if (count === 0) return null;
              const sc = STATUS_COLORS[s.value] || STATUS_COLORS.idea;
              return (
                <button key={s.value} onClick={() => setStatusFilter(s.value)}
                  className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-medium transition ring-1 ${statusFilter === s.value ? `${sc.bg} ${sc.text} ${sc.ring}` : 'bg-white text-gray-600 ring-gray-200 hover:ring-gray-400'}`}>
                  {s.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-white border border-gray-200 rounded-lg px-2 sm:px-3 py-2 text-gray-900 text-xs sm:text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-400">
                <option value="All">All Months</option>
                {(() => { const ms = [...new Set(content.map(c => c.month).filter(Boolean))]; ms.sort((a, b) => { const p = (s: string) => { const [m, y] = s.split(' '); return new Date(parseInt(y), ['January','February','March','April','May','June','July','August','September','October','November','December'].indexOf(m)); }; return p(b).getTime() - p(a).getTime(); }); return ms; })().map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <span className="text-xs sm:text-sm text-gray-500">{filteredContent.length} items</span>
            </div>
            <button onClick={() => { resetContentForm(); setEditContent(null); setShowContentModal(true); }} className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm rounded-lg transition self-end sm:self-auto"><Plus size={14} /><span className="hidden sm:inline">Add Content</span><span className="sm:hidden">Add</span></button>
          </div>

          {filteredContent.length === 0 ? (
            <EmptyState icon={Image} title={selectedMonth === 'All' ? 'No content yet' : `No content for ${selectedMonth}`} description="Create content items or sync from Google Sheets" action={{ label: 'Add Content', onClick: () => { resetContentForm(); setShowContentModal(true); } }} />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 w-24">Date</th>
                      {selectedMonth === 'All' && <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 w-20">Month</th>}
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 w-16">Type</th>
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500">Content</th>
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 w-24">Status</th>
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 w-20">Time</th>
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 w-28">File / Link</th>
                      <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 w-20">Actions</th>
                    </tr></thead>
                    <tbody>
                      {filteredContent.map(c => (
                        <tr key={c.id} className="border-b border-gray-100 hover:bg-purple-50/30 transition group">
                          <td className="py-2.5 px-3 text-gray-600 text-xs whitespace-nowrap">
                            {c.date ? (
                              <div>
                                <div>{new Date(c.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
                                {c.day_of_week && <div className="text-gray-400 text-[10px]">{c.day_of_week}</div>}
                              </div>
                            ) : c.month ? (
                              <div className="text-gray-400 italic text-[10px]">{formatMonth(c.month)}</div>
                            ) : '—'}
                          </td>
                          {selectedMonth === 'All' && <td className="py-2.5 px-3 text-gray-400 text-xs">{c.month}</td>}
                          <td className="py-2.5 px-3 text-xs whitespace-nowrap">{getTypeEmoji(c.content_type)} {c.content_type}</td>
                          <td className="py-2.5 px-3">
                            <button onClick={() => { setSelectedContent(c); setShowDetailModal(true); }}
                              className="text-left hover:text-purple-600 transition">
                              <div className="text-gray-900 text-sm font-medium truncate max-w-[300px]">{cleanText(c.title) || cleanText(c.contents)?.slice(0, 60) || 'Untitled'}</div>
                              {c.caption && <div className="text-gray-400 text-[10px] truncate max-w-[300px] mt-0.5">{cleanText(c.caption).slice(0, 80)}...</div>}
                            </button>
                          </td>
                          <td className="py-2.5 px-3">
                            <select value={c.smartStatus} onChange={e => quickUpdateStatus(c.id, e.target.value)}
                              className="text-[10px] px-1.5 py-0.5 rounded border border-gray-200 bg-white cursor-pointer focus:ring-1 focus:ring-purple-300">
                              {CONTENT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                          </td>
                          <td className="py-2.5 px-3 text-gray-500 text-xs">{c.schedule_time || '—'}</td>
                          <td className="py-2.5 px-3"><LinkCell url={c.link} /></td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-50 group-hover:opacity-100 transition">
                              <button onClick={() => { setSelectedContent(c); setShowDetailModal(true); }} className="p-1 hover:bg-gray-100 rounded text-gray-400" title="View details"><Eye size={13} /></button>
                              <button onClick={() => { setEditContent(c); setContentForm({ title: c.title || '', contents: c.contents || '', content_type: c.content_type, status: c.status, date: c.date || '', day_of_week: c.day_of_week || '', caption: c.caption || '', hashtags: c.hashtags || '', link: c.link || '', schedule_time: c.schedule_time || '', comments: c.comments || '' }); setShowContentModal(true); }} className="p-1 hover:bg-gray-100 rounded text-gray-400"><Edit2 size={13} /></button>
                              <button onClick={() => deleteContent(c.id)} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-red-400"><Trash2 size={13} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden space-y-2">
                {filteredContent.map(c => (
                  <div key={c.id} className="bg-white rounded-lg p-3 border border-gray-200 hover:border-purple-200 transition" onClick={() => { setSelectedContent(c); setShowDetailModal(true); }}>
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs">{getTypeEmoji(c.content_type)}</span>
                        <StatusPill status={c.smartStatus} />
                        {selectedMonth === 'All' && c.month && <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-500">{c.month}</span>}
                      </div>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setEditContent(c); setContentForm({ title: c.title || '', contents: c.contents || '', content_type: c.content_type, status: c.status, date: c.date || '', day_of_week: c.day_of_week || '', caption: c.caption || '', hashtags: c.hashtags || '', link: c.link || '', schedule_time: c.schedule_time || '', comments: c.comments || '' }); setShowContentModal(true); }} className="p-1 hover:bg-gray-100 rounded text-gray-400"><Edit2 size={12} /></button>
                      </div>
                    </div>
                    <h3 className="text-xs font-medium text-gray-900 mb-1">{cleanText(c.title) || cleanText(c.contents)?.slice(0, 50) || 'Untitled'}</h3>
                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                      {c.date ? <span>📅 {new Date(c.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span> : c.month ? <span className="text-gray-400 italic">📅 {formatMonth(c.month)}</span> : null}
                      {c.schedule_time && <span>⏰ {c.schedule_time}</span>}
                      {c.link && <span onClick={e => { e.stopPropagation(); window.open(c.link!, '_blank'); }} className="text-purple-600">🔗 Link</span>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* SHOOT BRIEFS */}
      {subTab === 'briefs' && (
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Shoot Briefs</h2>
              <p className="text-xs text-gray-500 mt-0.5">Content planning & videographer briefs</p>
            </div>
            <button onClick={() => { resetShootForm(); setEditShoot(null); setShowShootModal(true); }} className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm rounded-lg transition"><Plus size={14} /><span className="hidden sm:inline">New Brief</span><span className="sm:hidden">New</span></button>
          </div>
          {shoots.length === 0 ? (
            <EmptyState icon={Camera} title="No shoot briefs" description="Create a shoot brief for your videographer" action={{ label: 'New Brief', onClick: () => { resetShootForm(); setShowShootModal(true); } }} />
          ) : (
            <div className="space-y-3">
              {/* Desktop table for briefs */}
              <div className="hidden sm:block bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 w-24">Date</th>
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500">Brief</th>
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 w-32">Location</th>
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 w-28">Talent</th>
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 w-24">Status</th>
                    <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 w-16">Edit</th>
                  </tr></thead>
                  <tbody>
                    {shoots.map(s => (
                      <tr key={s.id} className="border-b border-gray-100 hover:bg-purple-50/30 transition group">
                        <td className="py-2.5 px-3 text-gray-600 text-xs whitespace-nowrap">
                          {s.shoot_date ? (
                            <div>
                              <div>{new Date(s.shoot_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
                              {s.shoot_time && <div className="text-gray-400 text-[10px]">{s.shoot_time}</div>}
                            </div>
                          ) : '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="text-gray-900 text-sm font-medium">{s.title}</div>
                          {s.shot_list && <div className="text-gray-400 text-[10px] truncate max-w-[300px] mt-0.5">{s.shot_list.slice(0, 80)}</div>}
                        </td>
                        <td className="py-2.5 px-3 text-gray-500 text-xs">{s.location || '—'}</td>
                        <td className="py-2.5 px-3 text-gray-500 text-xs">{s.talent || '—'}</td>
                        <td className="py-2.5 px-3"><StatusBadge status={s.status} /></td>
                        <td className="py-2.5 px-3 text-right">
                          <button onClick={() => { setEditShoot(s); setShootForm({ title: s.title, shoot_date: s.shoot_date || '', shoot_time: s.shoot_time || '', location: s.location || '', status: s.status, shot_list: s.shot_list || '', talent: s.talent || '', client_requirements: s.client_requirements || '', notes: s.notes || '' }); setShowShootModal(true); }} className="p-1 hover:bg-gray-100 rounded text-gray-400"><Edit2 size={13} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards for briefs */}
              <div className="sm:hidden space-y-2">
                {shoots.map(s => (
                  <div key={s.id} className="bg-white rounded-lg p-3 border border-gray-200 hover:border-purple-200 transition">
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0">
                        <h3 className="text-gray-900 font-medium text-sm">{s.title}</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <StatusBadge status={s.status} />
                          {s.shoot_date && <span className="text-[10px] text-gray-500">{new Date(s.shoot_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>}
                          {s.shoot_time && <span className="text-[10px] text-gray-500">@ {s.shoot_time}</span>}
                        </div>
                      </div>
                      <button onClick={() => { setEditShoot(s); setShootForm({ title: s.title, shoot_date: s.shoot_date || '', shoot_time: s.shoot_time || '', location: s.location || '', status: s.status, shot_list: s.shot_list || '', talent: s.talent || '', client_requirements: s.client_requirements || '', notes: s.notes || '' }); setShowShootModal(true); }} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 shrink-0"><Edit2 size={14} /></button>
                    </div>
                    {s.location && <div className="text-[10px] text-gray-500 mb-1">📍 {s.location}</div>}
                    {s.talent && <div className="text-[10px] text-gray-500 mb-1">🎭 {s.talent}</div>}
                    {s.shot_list && <div className="text-[10px] text-gray-600 bg-gray-50 rounded p-2 whitespace-pre-wrap line-clamp-3 border border-gray-100">{s.shot_list}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Content Detail Modal */}
      <Modal open={showDetailModal} onClose={() => { setShowDetailModal(false); setSelectedContent(null); }} title="Content Details" size="lg">
        {selectedContent && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm">{getTypeEmoji(selectedContent.content_type)} {selectedContent.content_type}</span>
              <StatusPill status={getSmartStatus(selectedContent.status, selectedContent.date)} />
              {selectedContent.month && <span className="text-xs text-gray-500">{selectedContent.month}</span>}
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{cleanText(selectedContent.title) || 'Untitled'}</h3>
            {selectedContent.contents && (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">Description</div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{cleanText(selectedContent.contents)}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">Date</div>
                  <p className="text-sm text-gray-700">{selectedContent.date ? new Date(selectedContent.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : selectedContent.month ? <span className="italic text-gray-400">{selectedContent.month} (no specific date)</span> : <span className="text-gray-400">—</span>}</p>
                </div>
              {selectedContent.schedule_time && (
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">Schedule Time</div>
                  <p className="text-sm text-gray-700">{selectedContent.schedule_time}</p>
                </div>
              )}
            </div>
            {selectedContent.caption && (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">Caption</div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3 border border-gray-100">{cleanText(selectedContent.caption)}</p>
              </div>
            )}
            {selectedContent.hashtags && (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">Hashtags</div>
                <p className="text-sm text-purple-600">{selectedContent.hashtags}</p>
              </div>
            )}
            {selectedContent.link && (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">File / Link</div>
                <a href={selectedContent.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-800 hover:underline">
                  <ExternalLink size={14} /> {selectedContent.link.length > 60 ? selectedContent.link.slice(0, 60) + '...' : selectedContent.link}
                </a>
              </div>
            )}
            {selectedContent.comments && (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">Comments</div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedContent.comments}</p>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button onClick={() => { setShowDetailModal(false); setEditContent(selectedContent); setContentForm({ title: selectedContent.title || '', contents: selectedContent.contents || '', content_type: selectedContent.content_type, status: selectedContent.status, date: selectedContent.date || '', day_of_week: selectedContent.day_of_week || '', caption: selectedContent.caption || '', hashtags: selectedContent.hashtags || '', link: selectedContent.link || '', schedule_time: selectedContent.schedule_time || '', comments: selectedContent.comments || '' }); setShowContentModal(true); }} className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg flex items-center gap-1.5"><Edit2 size={14} /> Edit</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Content Edit/Add Modal */}
      <Modal open={showContentModal} onClose={() => { setShowContentModal(false); setEditContent(null); }} title={editContent ? 'Edit Content' : 'Add Content'} size="lg">
        <div className="space-y-4">
          <FormField label="Title" name="title" value={contentForm.title} onChange={e => setContentForm(f => ({ ...f, title: e.target.value }))} placeholder="Post title or topic" />
          <FormField label="Content Description" name="contents" type="textarea" value={contentForm.contents} onChange={e => setContentForm(f => ({ ...f, contents: e.target.value }))} placeholder="What is this content about?" rows={3} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Type" name="content_type" value={contentForm.content_type} onChange={e => setContentForm(f => ({ ...f, content_type: e.target.value }))} options={CONTENT_TYPES} />
            <FormField label="Status" name="status" value={contentForm.status} onChange={e => setContentForm(f => ({ ...f, status: e.target.value }))} options={CONTENT_STATUSES} />
            <FormField label="Date" name="date" type="date" value={contentForm.date} onChange={e => setContentForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Day" name="day_of_week" value={contentForm.day_of_week} onChange={e => setContentForm(f => ({ ...f, day_of_week: e.target.value }))} placeholder="e.g. Tuesday" />
            <FormField label="Schedule Time" name="schedule_time" value={contentForm.schedule_time} onChange={e => setContentForm(f => ({ ...f, schedule_time: e.target.value }))} placeholder="e.g. 12:00 PM" />
          </div>
          <FormField label="Caption" name="caption" type="textarea" value={contentForm.caption} onChange={e => setContentForm(f => ({ ...f, caption: e.target.value }))} rows={3} />
          <FormField label="Hashtags" name="hashtags" value={contentForm.hashtags} onChange={e => setContentForm(f => ({ ...f, hashtags: e.target.value }))} placeholder="#brand #food #singapore" />
          <FormField label="File / Link (Frame.io, Drive, etc.)" name="link" value={contentForm.link} onChange={e => setContentForm(f => ({ ...f, link: e.target.value }))} placeholder="https://..." />
          <FormField label="Comments" name="comments" type="textarea" value={contentForm.comments} onChange={e => setContentForm(f => ({ ...f, comments: e.target.value }))} rows={2} />
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setShowContentModal(false); setEditContent(null); }} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
            <button onClick={saveContent} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg">{editContent ? 'Update' : 'Create'}</button>
          </div>
        </div>
      </Modal>

      {/* Shoot Brief Modal */}
      <Modal open={showShootModal} onClose={() => { setShowShootModal(false); setEditShoot(null); }} title={editShoot ? 'Edit Shoot Brief' : 'New Shoot Brief'} size="lg">
        <div className="space-y-4">
          <FormField label="Brief Title" name="title" value={shootForm.title} onChange={e => setShootForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. April Menu Shoot" required />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Date" name="shoot_date" type="date" value={shootForm.shoot_date} onChange={e => setShootForm(f => ({ ...f, shoot_date: e.target.value }))} />
            <FormField label="Time" name="shoot_time" type="time" value={shootForm.shoot_time} onChange={e => setShootForm(f => ({ ...f, shoot_time: e.target.value }))} />
            <FormField label="Status" name="status" value={shootForm.status} onChange={e => setShootForm(f => ({ ...f, status: e.target.value }))} options={[{ value: 'planned', label: 'Planned' }, { value: 'confirmed', label: 'Confirmed' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }]} />
          </div>
          <FormField label="Location" name="location" value={shootForm.location} onChange={e => setShootForm(f => ({ ...f, location: e.target.value }))} placeholder="Venue name & address" />
          <FormField label="Talent" name="talent" value={shootForm.talent} onChange={e => setShootForm(f => ({ ...f, talent: e.target.value }))} placeholder="Models, hosts, etc." />
          <FormField label="Shot List" name="shot_list" type="textarea" value={shootForm.shot_list} onChange={e => setShootForm(f => ({ ...f, shot_list: e.target.value }))} placeholder="List of shots needed..." rows={4} />
          <FormField label="Client Requirements" name="client_requirements" type="textarea" value={shootForm.client_requirements} onChange={e => setShootForm(f => ({ ...f, client_requirements: e.target.value }))} placeholder="What the client needs prepared..." rows={3} />
          <FormField label="Notes" name="notes" type="textarea" value={shootForm.notes} onChange={e => setShootForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setShowShootModal(false); setEditShoot(null); }} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
            <button onClick={saveShoot} disabled={!shootForm.title} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm rounded-lg">{editShoot ? 'Update' : 'Create'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
