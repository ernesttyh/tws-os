'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { MeetingMinutes, Task, Brand } from '@/lib/types'
import { Plus, FileText, CheckSquare, X, Upload } from 'lucide-react'

type Tab = 'meetings' | 'tasks'

export default function OperationsPage() {
  const params = useParams()
  const slug = params.slug as string
  const supabase = createClient()
  
  const [tab, setTab] = useState<Tab>('meetings')
  const [brand, setBrand] = useState<Brand | null>(null)
  const [meetings, setMeetings] = useState<MeetingMinutes[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [showModal, setShowModal] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)

  useEffect(() => {
    loadData()
  }, [slug])

  async function loadData() {
    const { data: b } = await supabase.from('brands').select('*').eq('slug', slug).single()
    if (!b) return
    setBrand(b)

    const { data: m } = await supabase.from('meeting_minutes').select('*').eq('brand_id', b.id).order('meeting_date', { ascending: false })
    setMeetings(m || [])

    const { data: t } = await supabase.from('tasks').select('*').eq('brand_id', b.id).order('created_at', { ascending: false })
    setTasks(t || [])
  }

  // Meeting form state
  const [meetingForm, setMeetingForm] = useState({ title: '', meeting_date: '', meeting_type: 'workplan' as const, content: '', source: 'manual' as const })

  async function createMeeting(e: React.FormEvent) {
    e.preventDefault()
    if (!brand) return
    await supabase.from('meeting_minutes').insert({ ...meetingForm, brand_id: brand.id })
    setShowModal(false)
    setMeetingForm({ title: '', meeting_date: '', meeting_type: 'workplan', content: '', source: 'manual' })
    loadData()
  }

  // Task form state
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'medium' as const, due_date: '', status: 'todo' as const })

  async function createTask(e: React.FormEvent) {
    e.preventDefault()
    if (!brand) return
    await supabase.from('tasks').insert({ ...taskForm, brand_id: brand.id })
    setShowTaskModal(false)
    setTaskForm({ title: '', description: '', priority: 'medium', due_date: '', status: 'todo' })
    loadData()
  }

  async function updateTaskStatus(id: string, status: string) {
    await supabase.from('tasks').update({ status, ...(status === 'done' ? { completed_at: new Date().toISOString() } : {}) }).eq('id', id)
    loadData()
  }

  async function deleteMeeting(id: string) {
    await supabase.from('meeting_minutes').delete().eq('id', id)
    loadData()
  }

  async function deleteTask(id: string) {
    await supabase.from('tasks').delete().eq('id', id)
    loadData()
  }

  const statusColors: Record<string, string> = {
    backlog: 'badge-neutral', todo: 'badge-info', in_progress: 'badge-warning',
    review: 'badge-purple', done: 'badge-success', archived: 'badge-neutral',
  }

  const priorityColors: Record<string, string> = {
    urgent: 'badge-danger', high: 'badge-warning', medium: 'badge-info', low: 'badge-neutral',
  }

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-4 mb-6">
        <button onClick={() => setTab('meetings')} className={`flex items-center gap-2 text-sm font-medium pb-1 border-b-2 ${tab === 'meetings' ? 'border-[var(--accent)]' : 'border-transparent'}`}
          style={{ color: tab === 'meetings' ? 'var(--accent)' : 'var(--text-secondary)' }}>
          <FileText size={16} /> Meetings ({meetings.length})
        </button>
        <button onClick={() => setTab('tasks')} className={`flex items-center gap-2 text-sm font-medium pb-1 border-b-2 ${tab === 'tasks' ? 'border-[var(--accent)]' : 'border-transparent'}`}
          style={{ color: tab === 'tasks' ? 'var(--accent)' : 'var(--text-secondary)' }}>
          <CheckSquare size={16} /> Tasks ({tasks.length})
        </button>
      </div>

      {/* MEETINGS TAB */}
      {tab === 'meetings' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Meeting Minutes</h2>
            <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm"><Plus size={14} /> Log Meeting</button>
          </div>

          {meetings.length === 0 ? (
            <div className="card text-center py-12">
              <FileText size={32} className="mx-auto mb-3" style={{ color: 'var(--text-secondary)' }} />
              <p style={{ color: 'var(--text-secondary)' }}>No meetings logged yet</p>
              <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm mt-3"><Plus size={14} /> Log First Meeting</button>
            </div>
          ) : (
            <div className="space-y-3">
              {meetings.map(m => (
                <div key={m.id} className="card card-hover">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{m.title}</span>
                        <span className="badge badge-info">{m.meeting_type}</span>
                        <span className="badge badge-neutral">{m.source}</span>
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {new Date(m.meeting_date).toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                      {m.content && <p className="text-sm mt-2 whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{m.content.substring(0, 200)}{m.content.length > 200 ? '...' : ''}</p>}
                    </div>
                    <button onClick={() => deleteMeeting(m.id)} className="btn btn-ghost btn-sm"><X size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Meeting Modal */}
          {showModal && (
            <div className="modal-overlay" onClick={() => setShowModal(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">Log Meeting Minutes</h3>
                  <button onClick={() => setShowModal(false)} className="btn btn-ghost btn-sm"><X size={16} /></button>
                </div>
                <form onSubmit={createMeeting} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Title</label>
                    <input value={meetingForm.title} onChange={e => setMeetingForm(f => ({...f, title: e.target.value}))} placeholder="Monthly workplan meeting" required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Date</label>
                      <input type="date" value={meetingForm.meeting_date} onChange={e => setMeetingForm(f => ({...f, meeting_date: e.target.value}))} required />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Type</label>
                      <select value={meetingForm.meeting_type} onChange={e => setMeetingForm(f => ({...f, meeting_type: e.target.value as any}))}>
                        <option value="workplan">Workplan</option>
                        <option value="review">Review</option>
                        <option value="brainstorm">Brainstorm</option>
                        <option value="adhoc">Ad-hoc</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Source</label>
                    <select value={meetingForm.source} onChange={e => setMeetingForm(f => ({...f, source: e.target.value as any}))}>
                      <option value="manual">Manual Entry</option>
                      <option value="plaud">Plaud Transcript</option>
                      <option value="whatsapp">WhatsApp Export</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Minutes / Notes</label>
                    <textarea rows={6} value={meetingForm.content} onChange={e => setMeetingForm(f => ({...f, content: e.target.value}))} placeholder="Meeting notes, action items, decisions..." />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary btn-sm">Cancel</button>
                    <button type="submit" className="btn btn-primary btn-sm">Save Meeting</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TASKS TAB */}
      {tab === 'tasks' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Task Board</h2>
            <button onClick={() => setShowTaskModal(true)} className="btn btn-primary btn-sm"><Plus size={14} /> New Task</button>
          </div>

          {tasks.length === 0 ? (
            <div className="card text-center py-12">
              <CheckSquare size={32} className="mx-auto mb-3" style={{ color: 'var(--text-secondary)' }} />
              <p style={{ color: 'var(--text-secondary)' }}>No tasks yet</p>
              <button onClick={() => setShowTaskModal(true)} className="btn btn-primary btn-sm mt-3"><Plus size={14} /> Create Task</button>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {['todo', 'in_progress', 'review', 'done'].map(status => (
                <div key={status} className="kanban-col min-w-[280px]">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <span className={`badge ${statusColors[status]} text-xs`}>{status.replace('_', ' ')}</span>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {tasks.filter(t => t.status === status).length}
                    </span>
                  </div>
                  {tasks.filter(t => t.status === status).map(task => (
                    <div key={task.id} className="kanban-card">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium">{task.title}</span>
                        <button onClick={() => deleteTask(task.id)} className="opacity-0 hover:opacity-100 transition-opacity">
                          <X size={12} style={{ color: 'var(--text-secondary)' }} />
                        </button>
                      </div>
                      {task.description && <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{task.description}</p>}
                      <div className="flex items-center justify-between mt-2">
                        <span className={`badge ${priorityColors[task.priority]} text-[10px]`}>{task.priority}</span>
                        {task.due_date && <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{new Date(task.due_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}</span>}
                      </div>
                      {task.status !== 'done' && (
                        <div className="flex gap-1 mt-2">
                          {task.status === 'todo' && <button onClick={() => updateTaskStatus(task.id, 'in_progress')} className="btn btn-ghost text-[10px] px-2 py-0.5">Start →</button>}
                          {task.status === 'in_progress' && <button onClick={() => updateTaskStatus(task.id, 'review')} className="btn btn-ghost text-[10px] px-2 py-0.5">Review →</button>}
                          {task.status === 'review' && <button onClick={() => updateTaskStatus(task.id, 'done')} className="btn btn-ghost text-[10px] px-2 py-0.5">Done ✓</button>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Task Modal */}
          {showTaskModal && (
            <div className="modal-overlay" onClick={() => setShowTaskModal(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">New Task</h3>
                  <button onClick={() => setShowTaskModal(false)} className="btn btn-ghost btn-sm"><X size={16} /></button>
                </div>
                <form onSubmit={createTask} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Title</label>
                    <input value={taskForm.title} onChange={e => setTaskForm(f => ({...f, title: e.target.value}))} placeholder="Task title" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Description</label>
                    <textarea rows={3} value={taskForm.description} onChange={e => setTaskForm(f => ({...f, description: e.target.value}))} placeholder="Task brief, requirements..." />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Priority</label>
                      <select value={taskForm.priority} onChange={e => setTaskForm(f => ({...f, priority: e.target.value as any}))}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Due Date</label>
                      <input type="date" value={taskForm.due_date} onChange={e => setTaskForm(f => ({...f, due_date: e.target.value}))} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowTaskModal(false)} className="btn btn-secondary btn-sm">Cancel</button>
                    <button type="submit" className="btn btn-primary btn-sm">Create Task</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
