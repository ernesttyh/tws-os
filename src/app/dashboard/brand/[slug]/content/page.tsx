'use client';
import { useState, useEffect, useCallback, useMemo, use } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { Image, Plus, Trash2, Edit2, Camera, Grid3x3, List, ArrowRight } from 'lucide-react';

type SubTab = 'calendar' | 'shoots';
type ViewMode = 'grid' | 'list';
type StatusFilter = 'all' | 'idea' | 'planned' | 'in_progress' | 'review' | 'approved' | 'scheduled' | 'posted';

interface ContentItem { id: string; title: string | null; contents: string | null; content_type: string; status: string; date: string | null; day_of_week: string | null; caption: string | null; hashtags: string | null; link: string | null; schedule_time: string | null; month: string; comments: string | null }
interface ShootBrief { id: string; title: string; shoot_date: string | null; shoot_time: string | null; location: string | null; status: string; shot_list: string | null; talent: string | null; client_requirements: string | null; notes: string | null }

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const CONTENT_TYPES = [{ value: 'reel', label: '🎬 Reel' }, { value: 'carousel', label: '📱 Carousel' }, { value: 'static', label: '🖼 Static' }, { value: 'story', label: '📖 Story' }, { value: 'video', label: '🎥 Video' }, { value: 'tiktok', label: '🎵 TikTok' }, { value: 'blog', label: '✍️ Blog' }, { value: 'edm', label: '📧 EDM' }];
const CONTENT_STATUSES = [{ value: 'idea', label: 'Idea' }, { value: 'planned', label: 'Planned' }, { value: 'in_progress', label: 'In Progress' }, { value: 'review', label: 'Review' }, { value: 'approved', label: 'Approved' }, { value: 'scheduled', label: 'Scheduled' }, { value: 'posted', label: 'Posted' }];

const STATUS_COLORS: Record<string, string> = {
  idea: 'bg-gray-500',
  planned: 'bg-blue-500',
  in_progress: 'bg-yellow-500',
  review: 'bg-orange-500',
  approved: 'bg-green-500',
  scheduled: 'bg-purple-500',
  posted: 'bg-emerald-500',
};

export default function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [subTab, setSubTab] = useState<SubTab>('calendar');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [brandId, setBrandId] = useState<string | null>(null);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [shoots, setShoots] = useState<ShootBrief[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [loading, setLoading] = useState(true);
  const [showContentModal, setShowContentModal] = useState(false);
  const [showShootModal, setShowShootModal] = useState(false);
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
    const monthParam = selectedMonth !== 'All' ? `?month=${selectedMonth}` : '';
    const [contentRes, shootsRes] = await Promise.all([
      fetch(`/api/brands/${bid}/content${monthParam}`),
      fetch(`/api/brands/${bid}/shoots`),
    ]);
    if (contentRes.ok) setContent(await contentRes.json());
    if (shootsRes.ok) setShoots(await shootsRes.json());
    setLoading(false);
  }, [selectedMonth]);

  useEffect(() => { loadBrand().then(bid => { if (bid) loadData(bid); }); }, [loadBrand, loadData]);
  useEffect(() => { if (brandId) loadData(brandId); }, [selectedMonth, brandId, loadData]);

  // Status counts for pipeline
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { idea: 0, planned: 0, in_progress: 0, review: 0, approved: 0, scheduled: 0, posted: 0 };
    content.forEach(c => { if (counts[c.status] !== undefined) counts[c.status]++; });
    return counts;
  }, [content]);

  // Filtered content based on status filter
  const filteredContent = useMemo(() => {
    if (statusFilter === 'all') return content;
    return content.filter(c => c.status === statusFilter);
  }, [content, statusFilter]);

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

  if (loading) return <div className="p-4 sm:p-6"><div className="animate-pulse space-y-4"><div className="h-8 bg-white/5 rounded w-48" /><div className="h-64 bg-white/5 rounded" /></div></div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Sub navigation */}
      <div className="flex gap-1 bg-white/5 rounded-lg p-1 w-fit">
        <button onClick={() => setSubTab('calendar')} className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition ${subTab === 'calendar' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>
          <span className="flex items-center gap-1.5 sm:gap-2"><Grid3x3 size={14} /><span className="hidden sm:inline">Content Calendar</span><span className="sm:hidden">Content</span></span>
        </button>
        <button onClick={() => setSubTab('shoots')} className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition ${subTab === 'shoots' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>
          <span className="flex items-center gap-1.5 sm:gap-2"><Camera size={14} /><span className="hidden sm:inline">Shoot Briefs</span><span className="sm:hidden">Shoots</span></span>
        </button>
      </div>

      {/* CONTENT CALENDAR */}
      {subTab === 'calendar' && (
        <div className="space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-2 sm:px-3 py-2 text-white text-xs sm:text-sm">
                <option value="All" className="bg-[#1a1a2e]">All Months</option>
                {MONTHS.map(m => <option key={m} value={m} className="bg-[#1a1a2e]">{m}</option>)}
              </select>
              <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
                <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-400'}`}><Grid3x3 size={14} /></button>
                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-400'}`}><List size={14} /></button>
              </div>
              <span className="text-xs sm:text-sm text-gray-400">{filteredContent.length} items</span>
            </div>
            <button onClick={() => { resetContentForm(); setEditContent(null); setShowContentModal(true); }} className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm rounded-lg transition self-end sm:self-auto"><Plus size={14} /><span className="hidden sm:inline">Add Content</span><span className="sm:hidden">Add</span></button>
          </div>

          {/* Pipeline Summary Strip */}
          <div className="bg-white/5 rounded-xl border border-white/10 p-3 sm:p-4 overflow-x-auto">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-max justify-center">
              {CONTENT_STATUSES.map((s, i) => (
                <div key={s.value} className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    onClick={() => setStatusFilter(statusFilter === s.value ? 'all' : s.value as StatusFilter)}
                    className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-full transition text-[10px] sm:text-xs whitespace-nowrap ${statusFilter === s.value ? 'ring-2 ring-white/40 scale-105' : 'hover:bg-white/5'}`}
                  >
                    <span className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full ${STATUS_COLORS[s.value]} flex items-center justify-center text-white text-[8px] sm:text-[9px] font-bold`}>
                      {statusCounts[s.value]}
                    </span>
                    <span className="text-gray-300 hidden sm:inline">{s.label}</span>
                  </button>
                  {i < CONTENT_STATUSES.length - 1 && (
                    <ArrowRight size={10} className="text-gray-600 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex gap-1 sm:gap-1.5 overflow-x-auto scrollbar-hide pb-1 sm:pb-0">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs rounded-full transition whitespace-nowrap flex items-center gap-1.5 ${statusFilter === 'all' ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}
            >
              All <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px]">{content.length}</span>
            </button>
            {CONTENT_STATUSES.map(s => (
              <button
                key={s.value}
                onClick={() => setStatusFilter(s.value as StatusFilter)}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs rounded-full transition whitespace-nowrap flex items-center gap-1.5 ${statusFilter === s.value ? `${STATUS_COLORS[s.value]} text-white` : 'bg-white/5 text-gray-400 hover:text-white'}`}
              >
                {s.label}
                {statusCounts[s.value] > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] ${statusFilter === s.value ? 'bg-white/20' : 'bg-white/10'}`}>{statusCounts[s.value]}</span>
                )}
              </button>
            ))}
          </div>

          {filteredContent.length === 0 ? (
            <EmptyState icon={Image} title={statusFilter !== 'all' ? `No ${CONTENT_STATUSES.find(s => s.value === statusFilter)?.label || statusFilter} content` : selectedMonth === 'All' ? 'No content yet' : `No content for ${selectedMonth}`} description={statusFilter !== 'all' ? 'Try selecting a different status filter' : 'Create content items or sync from Google Sheets'} action={{ label: 'Add Content', onClick: () => { resetContentForm(); setShowContentModal(true); } }} />
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredContent.map(c => (
                <div key={c.id} className="bg-white/5 rounded-lg p-3 sm:p-4 border border-white/10 hover:border-white/20 transition group">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <StatusBadge status={c.content_type} />
                      <StatusBadge status={c.status} />
                      {selectedMonth === 'All' && c.month && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500">{c.month}</span>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditContent(c); setContentForm({ title: c.title || '', contents: c.contents || '', content_type: c.content_type, status: c.status, date: c.date || '', day_of_week: c.day_of_week || '', caption: c.caption || '', hashtags: c.hashtags || '', link: c.link || '', schedule_time: c.schedule_time || '', comments: c.comments || '' }); setShowContentModal(true); }} className="p-1 hover:bg-white/10 rounded text-gray-400"><Edit2 size={12} /></button>
                      <button onClick={() => deleteContent(c.id)} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-red-400"><Trash2 size={12} /></button>
                    </div>
                  </div>
                  <h3 className="text-xs sm:text-sm font-medium text-white mb-1">{c.title || c.contents?.slice(0, 50) || 'Untitled'}</h3>
                  {c.contents && <p className="text-[10px] sm:text-xs text-gray-400 line-clamp-2 mb-2">{c.contents}</p>}
                  <div className="flex items-center gap-2 text-[10px] sm:text-xs text-gray-500">
                    {c.date && <span>{new Date(c.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                    {c.day_of_week && <span>({c.day_of_week})</span>}
                    {c.schedule_time && <span>@ {c.schedule_time}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-white/10">
                    <th className="text-left py-3 px-3 sm:px-4 text-xs font-medium text-gray-400">Date</th>
                    {selectedMonth === 'All' && <th className="text-left py-3 px-3 sm:px-4 text-xs font-medium text-gray-400">Month</th>}
                    <th className="text-left py-3 px-3 sm:px-4 text-xs font-medium text-gray-400">Type</th>
                    <th className="text-left py-3 px-3 sm:px-4 text-xs font-medium text-gray-400">Content</th>
                    <th className="text-left py-3 px-3 sm:px-4 text-xs font-medium text-gray-400 hidden sm:table-cell">Status</th>
                    <th className="text-right py-3 px-3 sm:px-4 text-xs font-medium text-gray-400">Actions</th>
                  </tr></thead>
                  <tbody>
                    {filteredContent.map(c => (
                      <tr key={c.id} className="border-b border-white/5 hover:bg-white/5 transition">
                        <td className="py-3 px-3 sm:px-4 text-gray-300 text-xs">{c.date ? new Date(c.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '-'}</td>
                        {selectedMonth === 'All' && <td className="py-3 px-3 sm:px-4 text-gray-400 text-xs">{c.month}</td>}
                        <td className="py-3 px-3 sm:px-4"><StatusBadge status={c.content_type} /></td>
                        <td className="py-3 px-3 sm:px-4 text-gray-300 max-w-[150px] sm:max-w-[300px] truncate text-xs sm:text-sm">{c.title || c.contents?.slice(0, 60) || '-'}</td>
                        <td className="py-3 px-3 sm:px-4 hidden sm:table-cell"><StatusBadge status={c.status} /></td>
                        <td className="py-3 px-3 sm:px-4 text-right">
                          <button onClick={() => { setEditContent(c); setContentForm({ title: c.title || '', contents: c.contents || '', content_type: c.content_type, status: c.status, date: c.date || '', day_of_week: c.day_of_week || '', caption: c.caption || '', hashtags: c.hashtags || '', link: c.link || '', schedule_time: c.schedule_time || '', comments: c.comments || '' }); setShowContentModal(true); }} className="p-1 hover:bg-white/10 rounded text-gray-400"><Edit2 size={14} /></button>
                          <button onClick={() => deleteContent(c.id)} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-red-400 ml-1"><Trash2 size={14} /></button>
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

      {/* SHOOT BRIEFS */}
      {subTab === 'shoots' && (
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base sm:text-lg font-semibold text-white">Shoot Briefs</h2>
            <button onClick={() => { resetShootForm(); setEditShoot(null); setShowShootModal(true); }} className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm rounded-lg transition"><Plus size={14} /><span className="hidden sm:inline">New Shoot</span><span className="sm:hidden">New</span></button>
          </div>
          {shoots.length === 0 ? (
            <EmptyState icon={Camera} title="No shoots scheduled" description="Create a shoot brief for your videographer" action={{ label: 'Schedule Shoot', onClick: () => { resetShootForm(); setShowShootModal(true); } }} />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              {shoots.map(s => (
                <div key={s.id} className="bg-white/5 rounded-lg p-3 sm:p-4 border border-white/10 hover:border-white/20 transition">
                  <div className="flex items-start justify-between mb-2 sm:mb-3">
                    <div className="min-w-0">
                      <h3 className="text-white font-medium text-sm">{s.title}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <StatusBadge status={s.status} />
                        {s.shoot_date && <span className="text-[10px] sm:text-xs text-gray-400">{new Date(s.shoot_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>}
                        {s.shoot_time && <span className="text-[10px] sm:text-xs text-gray-400">@ {s.shoot_time}</span>}
                      </div>
                    </div>
                    <button onClick={() => { setEditShoot(s); setShootForm({ title: s.title, shoot_date: s.shoot_date || '', shoot_time: s.shoot_time || '', location: s.location || '', status: s.status, shot_list: s.shot_list || '', talent: s.talent || '', client_requirements: s.client_requirements || '', notes: s.notes || '' }); setShowShootModal(true); }} className="p-1.5 hover:bg-white/10 rounded text-gray-400 shrink-0"><Edit2 size={14} /></button>
                  </div>
                  {s.location && <div className="text-[10px] sm:text-xs text-gray-400 mb-1 sm:mb-2">📍 {s.location}</div>}
                  {s.talent && <div className="text-[10px] sm:text-xs text-gray-400 mb-1 sm:mb-2">🎭 Talent: {s.talent}</div>}
                  {s.shot_list && <div className="text-[10px] sm:text-xs text-gray-300 bg-black/20 rounded p-2 whitespace-pre-wrap line-clamp-4">{s.shot_list}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content Modal */}
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
          <FormField label="Link" name="link" value={contentForm.link} onChange={e => setContentForm(f => ({ ...f, link: e.target.value }))} placeholder="https://..." />
          <FormField label="Comments" name="comments" type="textarea" value={contentForm.comments} onChange={e => setContentForm(f => ({ ...f, comments: e.target.value }))} rows={2} />
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setShowContentModal(false); setEditContent(null); }} className="px-4 py-2 text-sm text-gray-400">Cancel</button>
            <button onClick={saveContent} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg">{editContent ? 'Update' : 'Create'}</button>
          </div>
        </div>
      </Modal>

      {/* Shoot Modal */}
      <Modal open={showShootModal} onClose={() => { setShowShootModal(false); setEditShoot(null); }} title={editShoot ? 'Edit Shoot Brief' : 'New Shoot Brief'} size="lg">
        <div className="space-y-4">
          <FormField label="Shoot Title" name="title" value={shootForm.title} onChange={e => setShootForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. April Menu Shoot" required />
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
            <button onClick={() => { setShowShootModal(false); setEditShoot(null); }} className="px-4 py-2 text-sm text-gray-400">Cancel</button>
            <button onClick={saveShoot} disabled={!shootForm.title} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm rounded-lg">{editShoot ? 'Update' : 'Create'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
