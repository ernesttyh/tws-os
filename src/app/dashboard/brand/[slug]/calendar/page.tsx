'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { CalendarEvent, Brand } from '@/lib/types'
import { EVENT_COLORS } from '@/lib/types'
import { Plus, X, ChevronLeft, ChevronRight } from 'lucide-react'

export default function CalendarPage() {
  const params = useParams()
  const slug = params.slug as string
  const supabase = createClient()

  const [brand, setBrand] = useState<Brand | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<'month' | 'year'>('month')
  const [showModal, setShowModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [form, setForm] = useState({
    title: '', event_type: 'key_date' as const, start_date: '',
    end_date: '', description: '', location: '', all_day: true,
  })

  useEffect(() => { loadData() }, [slug])

  async function loadData() {
    const { data: b } = await supabase.from('brands').select('*').eq('slug', slug).single()
    if (!b) return
    setBrand(b)
    const { data } = await supabase.from('calendar_events').select('*').eq('brand_id', b.id).order('start_date')
    setEvents(data || [])
  }

  async function createEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!brand) return
    await supabase.from('calendar_events').insert({ ...form, brand_id: brand.id, color: EVENT_COLORS[form.event_type] })
    setShowModal(false)
    setForm({ title: '', event_type: 'key_date', start_date: '', end_date: '', description: '', location: '', all_day: true })
    loadData()
  }

  async function deleteEvent(id: string) {
    await supabase.from('calendar_events').delete().eq('id', id)
    loadData()
  }

  // Calendar helpers
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const blanks = Array.from({ length: firstDay }, (_, i) => i)

  function getEventsForDay(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter(e => e.start_date === dateStr)
  }

  function openAddEvent(day?: number) {
    const dateStr = day
      ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      : ''
    setForm(f => ({ ...f, start_date: dateStr }))
    setShowModal(true)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">Brand Calendar</h2>
          <div className="flex gap-1">
            <button onClick={() => setView('month')} className={`btn btn-sm ${view === 'month' ? 'btn-primary' : 'btn-secondary'}`}>Month</button>
            <button onClick={() => setView('year')} className={`btn btn-sm ${view === 'year' ? 'btn-primary' : 'btn-secondary'}`}>Year</button>
          </div>
        </div>
        <button onClick={() => openAddEvent()} className="btn btn-primary btn-sm"><Plus size={14} /> Add Event</button>
      </div>

      {/* Event type legend */}
      <div className="flex gap-4 mb-4 text-xs flex-wrap">
        {Object.entries(EVENT_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            <span style={{ color: 'var(--text-secondary)' }}>{type.replace('_', ' ')}</span>
          </div>
        ))}
      </div>

      {view === 'month' && (
        <>
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCurrentDate(new Date(year, month - 1))} className="btn btn-ghost btn-sm"><ChevronLeft size={16} /></button>
            <span className="font-medium">{monthName}</span>
            <button onClick={() => setCurrentDate(new Date(year, month + 1))} className="btn btn-ghost btn-sm"><ChevronRight size={16} /></button>
          </div>

          {/* Calendar grid */}
          <div className="card p-2">
            <div className="grid grid-cols-7 gap-px">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                <div key={d} className="text-center text-xs font-medium py-2" style={{ color: 'var(--text-secondary)' }}>{d}</div>
              ))}
              {blanks.map(i => <div key={`b${i}`} className="min-h-[80px]" />)}
              {days.map(day => {
                const dayEvents = getEventsForDay(day)
                const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year
                return (
                  <div key={day} 
                    className="min-h-[80px] p-1 rounded-lg cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                    style={{ background: isToday ? 'var(--accent)' + '10' : 'transparent' }}
                    onClick={() => openAddEvent(day)}>
                    <div className={`text-xs font-medium mb-1 ${isToday ? 'text-[var(--accent)]' : ''}`}>{day}</div>
                    {dayEvents.map(evt => (
                      <div key={evt.id} className="text-[10px] px-1 py-0.5 rounded mb-0.5 truncate"
                        style={{ background: (evt.color || '#6366f1') + '30', color: evt.color || '#6366f1' }}
                        onClick={e => { e.stopPropagation(); deleteEvent(evt.id) }}>
                        {evt.title}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {view === 'year' && (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 12 }, (_, m) => {
            const mName = new Date(year, m).toLocaleDateString('en-US', { month: 'short' })
            const mEvents = events.filter(e => {
              const d = new Date(e.start_date)
              return d.getMonth() === m && d.getFullYear() === year
            })
            return (
              <div key={m} className="card cursor-pointer card-hover" onClick={() => { setCurrentDate(new Date(year, m)); setView('month') }}>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-sm">{mName}</span>
                  {mEvents.length > 0 && <span className="text-xs badge badge-info">{mEvents.length}</span>}
                </div>
                <div className="flex flex-wrap gap-1">
                  {mEvents.slice(0, 5).map(evt => (
                    <div key={evt.id} className="w-2 h-2 rounded-full" style={{ background: evt.color || 'var(--accent)' }} />
                  ))}
                  {mEvents.length > 5 && <span className="text-[9px]" style={{ color: 'var(--text-secondary)' }}>+{mEvents.length - 5}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Upcoming events list */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold mb-3">Upcoming Events</h3>
        {events.filter(e => new Date(e.start_date) >= new Date()).length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No upcoming events</p>
        ) : (
          <div className="space-y-2">
            {events.filter(e => new Date(e.start_date) >= new Date()).slice(0, 10).map(evt => (
              <div key={evt.id} className="flex items-center justify-between card card-hover py-2 px-3">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ background: evt.color || 'var(--accent)' }} />
                  <div>
                    <span className="text-sm font-medium">{evt.title}</span>
                    <span className="text-xs ml-2" style={{ color: 'var(--text-secondary)' }}>{evt.event_type.replace('_',' ')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {new Date(evt.start_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}
                  </span>
                  <button onClick={() => deleteEvent(evt.id)} className="btn btn-ghost btn-sm"><X size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Event Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Add Event</h3>
              <button onClick={() => setShowModal(false)} className="btn btn-ghost btn-sm"><X size={16} /></button>
            </div>
            <form onSubmit={createEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Title</label>
                <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder="Event title" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Type</label>
                  <select value={form.event_type} onChange={e => setForm(f => ({...f, event_type: e.target.value as any}))}>
                    <option value="meeting">Meeting</option>
                    <option value="shoot">Shoot</option>
                    <option value="post">Post</option>
                    <option value="kol_visit">KOL Visit</option>
                    <option value="campaign">Campaign</option>
                    <option value="key_date">Key Date</option>
                    <option value="deadline">Deadline</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Date</label>
                  <input type="date" value={form.start_date} onChange={e => setForm(f => ({...f, start_date: e.target.value}))} required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Description</label>
                <textarea rows={2} value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder="Optional details" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Location</label>
                <input value={form.location} onChange={e => setForm(f => ({...f, location: e.target.value}))} placeholder="Optional" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary btn-sm">Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">Add Event</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
