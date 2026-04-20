'use client';
import { useState, useEffect, useCallback, use } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { Calendar, Plus, ChevronLeft, ChevronRight, Trash2, Edit2, ExternalLink, FileText } from 'lucide-react';

interface CalendarEvent { id: string; title: string; event_type: string; start_date: string; end_date: string | null; start_time: string | null; all_day: boolean; color: string | null; description: string | null; location: string | null; source?: string; source_id?: string }
interface LinkedContent { id: string; title: string | null; contents: string | null; content_type: string; status: string; caption: string | null; hashtags: string | null; link: string | null; schedule_time: string | null; comments: string | null }
type ViewMode = 'month' | 'year';

const EVENT_TYPES = [{ value: 'meeting', label: '📋 Meeting' }, { value: 'shoot', label: '📸 Shoot' }, { value: 'post', label: '📱 Post' }, { value: 'kol_visit', label: '🌟 KOL Visit' }, { value: 'campaign', label: '🚀 Campaign' }, { value: 'key_date', label: '📅 Key Date' }, { value: 'deadline', label: '⏰ Deadline' }];
const TYPE_COLORS: Record<string, string> = { meeting: 'bg-blue-500', shoot: 'bg-orange-500', post: 'bg-green-500', kol_visit: 'bg-pink-500', campaign: 'bg-purple-500', key_date: 'bg-yellow-500', deadline: 'bg-red-500' };
const TYPE_EMOJIS: Record<string, string> = { meeting: '📋', shoot: '📸', post: '📱', kol_visit: '🌟', campaign: '🚀', key_date: '📅', deadline: '⏰' };

export default function CalendarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [linkedContent, setLinkedContent] = useState<LinkedContent | null>(null);
  const [contentLoading, setContentLoading] = useState(false);

  const supabase = createBrowserClient();

  const loadBrand = useCallback(async () => {
    const { data } = await supabase.from('brands').select('id').eq('slug', slug).single();
    if (data) { setBrandId(data.id); return data.id; }
    return null;
  }, [slug, supabase]);

  const loadEvents = useCallback(async (bid: string) => {
    setLoading(true);
    const year = currentDate.getFullYear();
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;
    const res = await fetch(`/api/brands/${bid}/calendar?from=${from}&to=${to}`);
    if (res.ok) setEvents(await res.json());
    setLoading(false);
  }, [currentDate]);

  useEffect(() => { loadBrand().then(bid => { if (bid) loadEvents(bid); }); }, [loadBrand, loadEvents]);

  // Fetch linked content when editing a post event with source_id
  const fetchLinkedContent = useCallback(async (bid: string, sourceId: string) => {
    setContentLoading(true);
    setLinkedContent(null);
    try {
      const res = await fetch(`/api/brands/${bid}/content/${sourceId}`);
      if (res.ok) {
        const data = await res.json();
        setLinkedContent(data);
      }
    } catch {
      // silently fail - content may not exist
    }
    setContentLoading(false);
  }, []);

  const openEditModal = useCallback((event: CalendarEvent) => {
    setEditEvent(event);
    setForm({
      title: event.title,
      event_type: event.event_type,
      start_date: event.start_date,
      end_date: event.end_date || '',
      start_time: event.start_time || '',
      all_day: event.all_day,
      description: event.description || '',
      location: event.location || '',
    });
    setLinkedContent(null);
    setShowModal(true);
    // If it's a post with source_id, fetch the linked content
    if (event.event_type === 'post' && event.source_id && brandId) {
      fetchLinkedContent(brandId, event.source_id);
    }
  }, [brandId, fetchLinkedContent]);

  const [form, setForm] = useState({ title: '', event_type: 'key_date', start_date: '', end_date: '', start_time: '', all_day: true, description: '', location: '' });
  const resetForm = () => setForm({ title: '', event_type: 'key_date', start_date: new Date().toISOString().split('T')[0], end_date: '', start_time: '', all_day: true, description: '', location: '' });

  const saveEvent = async () => {
    if (!brandId) return;
    const payload = { ...form, end_date: form.end_date || null, start_time: form.start_time || null, description: form.description || null, location: form.location || null };
    if (editEvent) {
      await fetch(`/api/brands/${brandId}/calendar/${editEvent.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } else {
      await fetch(`/api/brands/${brandId}/calendar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
    setShowModal(false); setEditEvent(null); setLinkedContent(null); resetForm(); loadEvents(brandId);
  };

  const deleteEvent = async (id: string) => { if (!brandId || !confirm('Delete this event?')) return; await fetch(`/api/brands/${brandId}/calendar/${id}`, { method: 'DELETE' }); loadEvents(brandId); };

  // Calendar grid helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const monthName = currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const getEventsForDate = (y: number, m: number, d: number) => {
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return events.filter(e => e.start_date === dateStr || (e.end_date && e.start_date <= dateStr && e.end_date >= dateStr));
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const prevYear = () => setCurrentDate(new Date(year - 1, month, 1));
  const nextYear = () => setCurrentDate(new Date(year + 1, month, 1));

  if (loading) return <div className="p-4 sm:p-6"><div className="animate-pulse space-y-4"><div className="h-8 bg-white/5 rounded w-48" /><div className="h-96 bg-white/5 rounded" /></div></div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex gap-1 bg-white/5 rounded-lg p-1">
            <button onClick={() => setViewMode('month')} className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm transition ${viewMode === 'month' ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>Month</button>
            <button onClick={() => setViewMode('year')} className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm transition ${viewMode === 'year' ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>Year</button>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button onClick={viewMode === 'month' ? prevMonth : prevYear} className="p-1 sm:p-1.5 rounded-lg hover:bg-white/10 text-gray-400"><ChevronLeft size={16} /></button>
            <span className="text-white font-semibold text-xs sm:text-sm min-w-[120px] sm:min-w-[180px] text-center">{viewMode === 'month' ? monthName : year}</span>
            <button onClick={viewMode === 'month' ? nextMonth : nextYear} className="p-1 sm:p-1.5 rounded-lg hover:bg-white/10 text-gray-400"><ChevronRight size={16} /></button>
          </div>
        </div>
        <button onClick={() => { resetForm(); setEditEvent(null); setLinkedContent(null); setShowModal(true); }} className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm rounded-lg transition self-end sm:self-auto"><Plus size={14} /><span className="hidden sm:inline">Add Event</span><span className="sm:hidden">Add</span></button>
      </div>

      {/* Legend */}
      <div className="flex gap-2 sm:gap-4 flex-wrap">
        {EVENT_TYPES.map(t => (
          <div key={t.value} className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-gray-400">
            <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${TYPE_COLORS[t.value]}`} />
            {t.label.split(' ')[1]}
          </div>
        ))}
      </div>

      {/* MONTHLY VIEW */}
      {viewMode === 'month' && (
        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          <div className="grid grid-cols-7">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} className="py-1.5 sm:py-2 text-center text-[10px] sm:text-xs font-medium text-gray-400 border-b border-white/10">
                <span className="sm:hidden">{d}</span>
                <span className="hidden sm:inline">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]}</span>
              </div>
            ))}
            {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} className="min-h-[48px] sm:min-h-[100px] border-b border-r border-white/5" />)}
            {days.map(d => {
              const dayEvents = getEventsForDate(year, month, d);
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              const isToday = dateStr === new Date().toISOString().split('T')[0];
              return (
                <div key={d} className={`min-h-[48px] sm:min-h-[100px] border-b border-r border-white/5 p-0.5 sm:p-1.5 cursor-pointer hover:bg-white/5 transition ${isToday ? 'bg-purple-500/5' : ''}`}
                     onClick={() => { setSelectedDate(dateStr); resetForm(); setForm(f => ({ ...f, start_date: dateStr })); setEditEvent(null); setLinkedContent(null); setShowModal(true); }}>
                  <span className={`text-[10px] sm:text-xs font-medium ${isToday ? 'bg-purple-600 text-white px-1 sm:px-1.5 py-0.5 rounded-full' : 'text-gray-400'}`}>{d}</span>
                  <div className="space-y-0.5 mt-0.5">
                    {dayEvents.slice(0, 2).map(e => (
                      <div key={e.id} className={`text-[8px] sm:text-xs px-1 sm:px-1.5 py-0 sm:py-0.5 rounded truncate text-white ${TYPE_COLORS[e.event_type] || 'bg-gray-600'}`} onClick={(ev) => { ev.stopPropagation(); openEditModal(e); }}>
                        <span className="hidden sm:inline">{TYPE_EMOJIS[e.event_type] || ''} {e.title}</span>
                        <span className="sm:hidden">•</span>
                      </div>
                    ))}
                    {dayEvents.length > 2 && <span className="text-[8px] sm:text-xs text-gray-500">+{dayEvents.length - 2}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* YEARLY VIEW */}
      {viewMode === 'year' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          {Array.from({ length: 12 }, (_, mi) => {
            const mDays = new Date(year, mi + 1, 0).getDate();
            const mFirst = new Date(year, mi, 1).getDay();
            const mEvents = events.filter(e => { const d = new Date(e.start_date); return d.getMonth() === mi && d.getFullYear() === year; });
            return (
              <div key={mi} className="bg-white/5 rounded-lg border border-white/10 p-2 sm:p-3 cursor-pointer hover:border-white/20 transition" onClick={() => { setCurrentDate(new Date(year, mi, 1)); setViewMode('month'); }}>
                <h3 className="text-xs sm:text-sm font-semibold text-white mb-1.5 sm:mb-2">{new Date(year, mi).toLocaleString('en-US', { month: 'short' })} <span className="text-gray-500 font-normal">({mEvents.length})</span></h3>
                <div className="grid grid-cols-7 gap-0.5 text-center">
                  {['S','M','T','W','T','F','S'].map((d,i) => <span key={i} className="text-[7px] sm:text-[9px] text-gray-500">{d}</span>)}
                  {Array.from({ length: mFirst }).map((_,i) => <span key={`e${i}`} />)}
                  {Array.from({ length: mDays }, (_,d) => {
                    const dayEvts = getEventsForDate(year, mi, d + 1);
                    return <span key={d} className={`text-[8px] sm:text-[10px] rounded-sm ${dayEvts.length > 0 ? 'bg-purple-600 text-white font-bold' : 'text-gray-500'}`}>{d + 1}</span>;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Event Modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setEditEvent(null); setLinkedContent(null); }} title={editEvent ? 'Edit Event' : 'New Event'} size="md">
        <div className="space-y-4">
          {/* Linked Content Detail Panel */}
          {editEvent && editEvent.event_type === 'post' && editEvent.source_id && (
            <div className="bg-white/5 rounded-lg border border-white/10 p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText size={14} className="text-purple-400" />
                <span className="text-xs sm:text-sm font-medium text-purple-400">Linked Content</span>
              </div>
              {contentLoading ? (
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-white/10 rounded w-3/4" />
                  <div className="h-3 bg-white/10 rounded w-1/2" />
                </div>
              ) : linkedContent ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-medium text-white">{linkedContent.title || 'Untitled'}</h4>
                    <StatusBadge status={linkedContent.content_type} />
                    <StatusBadge status={linkedContent.status} />
                  </div>
                  {linkedContent.contents && (
                    <p className="text-xs text-gray-400 line-clamp-3">{linkedContent.contents}</p>
                  )}
                  {linkedContent.caption && (
                    <div className="text-xs text-gray-300 bg-black/20 rounded p-2">
                      <span className="text-gray-500 text-[10px] uppercase tracking-wide block mb-1">Caption</span>
                      <span className="line-clamp-3">{linkedContent.caption}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-[10px] sm:text-xs text-gray-500 flex-wrap">
                    {linkedContent.hashtags && <span className="text-purple-400">{linkedContent.hashtags}</span>}
                    {linkedContent.schedule_time && <span>🕐 {linkedContent.schedule_time}</span>}
                  </div>
                  {linkedContent.comments && (
                    <p className="text-[10px] sm:text-xs text-gray-500 italic">💬 {linkedContent.comments}</p>
                  )}
                  {linkedContent.link && (
                    <a href={linkedContent.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition mt-1">
                      <ExternalLink size={12} /> View Content →
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500">Content not found or unavailable</p>
              )}
            </div>
          )}

          <FormField label="Title" name="title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Event title" required />
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Type" name="event_type" value={form.event_type} onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))} options={EVENT_TYPES} />
            <FormField label="Start Date" name="start_date" type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="End Date (optional)" name="end_date" type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
            <FormField label="Time" name="start_time" type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
          </div>
          <FormField label="Location" name="location" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Venue or link" />
          <FormField label="Description" name="description" type="textarea" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
          <div className="flex justify-between pt-2">
            {editEvent && <button onClick={() => { deleteEvent(editEvent.id); setShowModal(false); setLinkedContent(null); }} className="px-4 py-2 text-sm text-red-400 hover:text-red-300">Delete</button>}
            <div className="flex gap-3 ml-auto">
              <button onClick={() => { setShowModal(false); setEditEvent(null); setLinkedContent(null); }} className="px-4 py-2 text-sm text-gray-400">Cancel</button>
              <button onClick={saveEvent} disabled={!form.title || !form.start_date} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm rounded-lg">{editEvent ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
