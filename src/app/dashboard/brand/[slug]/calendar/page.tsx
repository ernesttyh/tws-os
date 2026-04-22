'use client';
import { useState, useEffect, useCallback, use } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import EmptyState from '@/components/ui/EmptyState';
import { Calendar, Plus, ChevronLeft, ChevronRight, Trash2, Edit2, X, Clock, MapPin } from 'lucide-react';

interface CalendarEvent { id: string; title: string; event_type: string; start_date: string; end_date: string | null; start_time: string | null; all_day: boolean; color: string | null; description: string | null; location: string | null; brand_name?: string | null; brand_slug?: string | null }
type ViewMode = 'month' | 'year';

const EVENT_TYPES = [{ value: 'meeting', label: '📋 Meeting' }, { value: 'shoot', label: '📸 Shoot' }, { value: 'post', label: '📱 Post' }, { value: 'kol_visit', label: '🌟 KOL Visit' }, { value: 'campaign', label: '🚀 Campaign' }, { value: 'key_date', label: '📅 Key Date' }, { value: 'deadline', label: '⏰ Deadline' }];
const TYPE_COLORS: Record<string, string> = { meeting: 'bg-blue-500', shoot: 'bg-orange-500', post: 'bg-green-500', kol_visit: 'bg-pink-500', campaign: 'bg-purple-500', key_date: 'bg-yellow-500', deadline: 'bg-red-500' };
const TYPE_LABELS: Record<string, string> = { meeting: '📋 Meeting', shoot: '📸 Shoot', post: '📱 Post', kol_visit: '🌟 KOL Visit', campaign: '🚀 Campaign', key_date: '📅 Key Date', deadline: '⏰ Deadline' };

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
  const [showDayModal, setShowDayModal] = useState(false);
  const [dayModalDate, setDayModalDate] = useState<string | null>(null);

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
    setShowModal(false); setEditEvent(null); resetForm(); loadEvents(brandId);
  };

  const deleteEvent = async (id: string) => { if (!brandId || !confirm('Delete this event?')) return; await fetch(`/api/brands/${brandId}/calendar/${id}`, { method: 'DELETE' }); setShowModal(false); setEditEvent(null); loadEvents(brandId); };

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

  const getEventsForDateStr = (dateStr: string) => {
    return events.filter(e => e.start_date === dateStr || (e.end_date && e.start_date <= dateStr && e.end_date >= dateStr));
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const prevYear = () => setCurrentDate(new Date(year - 1, month, 1));
  const nextYear = () => setCurrentDate(new Date(year + 1, month, 1));

  // Open day detail modal
  const openDayModal = (dateStr: string) => {
    setDayModalDate(dateStr);
    setShowDayModal(true);
  };

  // Open event editor for an event
  const openEditEvent = (e: CalendarEvent) => {
    setEditEvent(e);
    setForm({
      title: e.title,
      event_type: e.event_type,
      start_date: e.start_date,
      end_date: e.end_date || '',
      start_time: e.start_time || '',
      all_day: e.all_day,
      description: e.description || '',
      location: e.location || '',
    });
    setShowDayModal(false);
    setShowModal(true);
  };

  // Open new event form from day modal
  const openNewEventForDate = (dateStr: string) => {
    resetForm();
    setForm(f => ({ ...f, start_date: dateStr }));
    setEditEvent(null);
    setShowDayModal(false);
    setShowModal(true);
  };

  const dayModalEvents = dayModalDate ? getEventsForDateStr(dayModalDate) : [];
  const dayModalLabel = dayModalDate ? new Date(dayModalDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';

  if (loading) return <div className="p-4 sm:p-6"><div className="animate-pulse space-y-4"><div className="h-8 bg-gray-50 rounded w-48" /><div className="h-96 bg-gray-50 rounded" /></div></div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex gap-1 bg-gray-50 rounded-lg p-1">
            <button onClick={() => setViewMode('month')} className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm transition ${viewMode === 'month' ? 'bg-purple-600 text-white' : 'text-gray-500'}`}>Month</button>
            <button onClick={() => setViewMode('year')} className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm transition ${viewMode === 'year' ? 'bg-purple-600 text-white' : 'text-gray-500'}`}>Year</button>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button onClick={viewMode === 'month' ? prevMonth : prevYear} className="p-1 sm:p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft size={16} /></button>
            <span className="text-gray-900 font-semibold text-xs sm:text-sm min-w-[120px] sm:min-w-[180px] text-center">{viewMode === 'month' ? monthName : year}</span>
            <button onClick={viewMode === 'month' ? nextMonth : nextYear} className="p-1 sm:p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronRight size={16} /></button>
          </div>
        </div>
        <button onClick={() => { resetForm(); setEditEvent(null); setShowModal(true); }} className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm rounded-lg transition self-end sm:self-auto"><Plus size={14} /><span className="hidden sm:inline">Add Event</span><span className="sm:hidden">Add</span></button>
      </div>

      {/* Legend */}
      <div className="flex gap-2 sm:gap-4 flex-wrap">
        {EVENT_TYPES.map(t => (
          <div key={t.value} className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-gray-500">
            <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${TYPE_COLORS[t.value]}`} />
            {t.label.split(' ')[1]}
          </div>
        ))}
      </div>

      {/* MONTHLY VIEW */}
      {viewMode === 'month' && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-7">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} className="py-1.5 sm:py-2 text-center text-[10px] sm:text-xs font-medium text-gray-500 border-b border-gray-200">
                <span className="sm:hidden">{d}</span>
                <span className="hidden sm:inline">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]}</span>
              </div>
            ))}
            {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} className="min-h-[48px] sm:min-h-[100px] border-b border-r border-gray-200" />)}
            {days.map(d => {
              const dayEvents = getEventsForDate(year, month, d);
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              const isToday = dateStr === new Date().toISOString().split('T')[0];
              return (
                <div key={d} className={`min-h-[48px] sm:min-h-[100px] border-b border-r border-gray-200 p-0.5 sm:p-1.5 cursor-pointer hover:bg-gray-50 transition ${isToday ? 'bg-purple-50' : ''}`}
                     onClick={() => openDayModal(dateStr)}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] sm:text-xs font-medium ${isToday ? 'bg-purple-600 text-white px-1 sm:px-1.5 py-0.5 rounded-full' : 'text-gray-500'}`}>{d}</span>
                    {dayEvents.length > 2 && <span className="text-[7px] sm:text-[10px] bg-purple-100 text-purple-600 font-semibold px-1 rounded-full">{dayEvents.length}</span>}
                  </div>
                  <div className="space-y-0.5 mt-0.5">
                    {dayEvents.slice(0, 2).map(e => (
                      <div key={e.id} className={`text-[8px] sm:text-xs px-1 sm:px-1.5 py-0 sm:py-0.5 rounded truncate text-white ${TYPE_COLORS[e.event_type] || 'bg-gray-600'}`}
                           onClick={(ev) => { ev.stopPropagation(); openEditEvent(e); }}>
                        {e.title.length > 8 ? e.title.slice(0, 8) + '…' : e.title}
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
              <div key={mi} className="bg-gray-50 rounded-lg border border-gray-200 p-2 sm:p-3 cursor-pointer hover:border-gray-300 transition" onClick={() => { setCurrentDate(new Date(year, mi, 1)); setViewMode('month'); }}>
                <h3 className="text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">{new Date(year, mi).toLocaleString('en-US', { month: 'short' })} <span className="text-gray-500 font-normal">({mEvents.length})</span></h3>
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

      {/* Day Detail Modal */}
      <Modal open={showDayModal} onClose={() => setShowDayModal(false)} title={dayModalLabel} size="md">
        <div className="space-y-3">
          {dayModalEvents.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">No events on this day</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {dayModalEvents.map(e => (
                <div key={e.id} onClick={() => openEditEvent(e)} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-purple-300 cursor-pointer transition group">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${TYPE_COLORS[e.event_type] || 'bg-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{e.title}</span>
                      <span className="text-[10px] text-gray-500">{TYPE_LABELS[e.event_type] || e.event_type}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] sm:text-xs text-gray-500">
                      {e.start_time && <span className="flex items-center gap-0.5"><Clock size={10} />{e.start_time}</span>}
                      {e.location && <span className="flex items-center gap-0.5"><MapPin size={10} />{e.location}</span>}
                      {e.brand_name && <span className="px-1 py-0.5 bg-purple-100 text-purple-600 rounded text-[9px] font-medium">{e.brand_name}</span>}
                    </div>
                    {e.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{e.description}</p>}
                  </div>
                  <Edit2 size={14} className="text-gray-400 group-hover:text-purple-500 shrink-0 mt-1 transition" />
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-gray-200">
            <button onClick={() => setShowDayModal(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-900">Close</button>
            <button onClick={() => dayModalDate && openNewEventForDate(dayModalDate)} className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition">
              <Plus size={14} /> New Event
            </button>
          </div>
        </div>
      </Modal>

      {/* Event Modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setEditEvent(null); }} title={editEvent ? 'Edit Event' : 'New Event'} size="md">
        <div className="space-y-4">
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
            {editEvent && <button onClick={() => { deleteEvent(editEvent.id); setShowModal(false); }} className="px-4 py-2 text-sm text-red-400 hover:text-red-300">Delete</button>}
            <div className="flex gap-3 ml-auto">
              <button onClick={() => { setShowModal(false); setEditEvent(null); }} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
              <button onClick={saveEvent} disabled={!form.title || !form.start_date} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm rounded-lg">{editEvent ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
