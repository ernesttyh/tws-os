'use client';
import { useState, useEffect, useCallback, use } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import StatusBadge from '@/components/ui/StatusBadge';
import PriorityBadge from '@/components/ui/PriorityBadge';
import EmptyState from '@/components/ui/EmptyState';
import { ClipboardList, Plus, FileText, CheckSquare, BarChart3, Calendar, Trash2, Edit2, ChevronDown, ChevronRight } from 'lucide-react';

type Tab = 'meetings' | 'tasks' | 'cadence';

interface Meeting { id: string; title: string; meeting_date: string; meeting_type: string; content: string | null; source: string; action_items_extracted: boolean; transcript_raw: string | null; creator?: { name: string } | null }
interface Task { id: string; title: string; description: string | null; status: string; priority: string; due_date: string | null; assigned_member?: { name: string } | null; tags: string[] | null }

export default function OperationsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [tab, setTab] = useState<Tab>('meetings');
  const [brandId, setBrandId] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [expandedMeeting, setExpandedMeeting] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([]);

  const supabase = createBrowserClient();

  const loadBrand = useCallback(async () => {
    const { data } = await supabase.from('brands').select('id').eq('slug', slug).single();
    if (data) { setBrandId(data.id); return data.id; }
    return null;
  }, [slug, supabase]);

  const loadData = useCallback(async (bid: string) => {
    setLoading(true);
    const [meetingsRes, tasksRes, teamRes] = await Promise.all([
      fetch(`/api/brands/${bid}/meetings`),
      fetch(`/api/brands/${bid}/tasks`),
      fetch('/api/team'),
    ]);
    if (meetingsRes.ok) setMeetings(await meetingsRes.json());
    if (tasksRes.ok) setTasks(await tasksRes.json());
    if (teamRes.ok) setTeamMembers(await teamRes.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    loadBrand().then(bid => { if (bid) loadData(bid); });
  }, [loadBrand, loadData]);

  const tabs: { key: Tab; label: string; icon: React.ElementType; count: number }[] = [
    { key: 'meetings', label: 'Meeting Minutes', icon: FileText, count: meetings.length },
    { key: 'tasks', label: 'Task Board', icon: CheckSquare, count: tasks.filter(t => t.status !== 'done' && t.status !== 'archived').length },
    { key: 'cadence', label: 'Cadence Tracker', icon: BarChart3, count: 0 },
  ];

  // Meeting form state
  const [meetingForm, setMeetingForm] = useState({ title: '', meeting_date: '', meeting_type: 'workplan', content: '', source: 'manual', transcript_raw: '' });
  const resetMeetingForm = () => setMeetingForm({ title: '', meeting_date: new Date().toISOString().split('T')[0], meeting_type: 'workplan', content: '', source: 'manual', transcript_raw: '' });

  const saveMeeting = async () => {
    if (!brandId) return;
    const payload = { ...meetingForm, transcript_raw: meetingForm.transcript_raw || null };
    if (editMeeting) {
      await fetch(`/api/brands/${brandId}/meetings/${editMeeting.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } else {
      await fetch(`/api/brands/${brandId}/meetings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
    setShowMeetingModal(false); setEditMeeting(null); resetMeetingForm();
    loadData(brandId);
  };

  const deleteMeeting = async (id: string) => {
    if (!brandId || !confirm('Delete this meeting?')) return;
    await fetch(`/api/brands/${brandId}/meetings/${id}`, { method: 'DELETE' });
    loadData(brandId);
  };

  // Task form state
  const [taskForm, setTaskForm] = useState({ title: '', description: '', status: 'todo', priority: 'medium', due_date: '', assigned_to: '' });
  const resetTaskForm = () => setTaskForm({ title: '', description: '', status: 'todo', priority: 'medium', due_date: '', assigned_to: '' });

  const saveTask = async () => {
    if (!brandId) return;
    const payload = { ...taskForm, assigned_to: taskForm.assigned_to || null, due_date: taskForm.due_date || null, description: taskForm.description || null };
    if (editTask) {
      await fetch(`/api/brands/${brandId}/tasks/${editTask.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } else {
      await fetch(`/api/brands/${brandId}/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
    setShowTaskModal(false); setEditTask(null); resetTaskForm();
    loadData(brandId);
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    if (!brandId) return;
    await fetch(`/api/brands/${brandId}/tasks/${taskId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, ...(status === 'done' ? { completed_at: new Date().toISOString() } : { completed_at: null }) }) });
    loadData(brandId);
  };

  const deleteTask = async (id: string) => {
    if (!brandId || !confirm('Delete this task?')) return;
    await fetch(`/api/brands/${brandId}/tasks/${id}`, { method: 'DELETE' });
    loadData(brandId);
  };

  const taskStatuses = ['backlog', 'todo', 'in_progress', 'review', 'done'];
  const tasksByStatus = taskStatuses.reduce((acc, s) => { acc[s] = tasks.filter(t => t.status === s); return acc; }, {} as Record<string, Task[]>);

  if (loading) return <div className="p-6"><div className="animate-pulse space-y-4"><div className="h-8 bg-white/5 rounded w-48" /><div className="h-64 bg-white/5 rounded" /></div></div>;

  return (
    <div className="p-6 space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-white/5 rounded-lg p-1 w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${tab === t.key ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
            <t.icon size={16} />{t.label}{t.count > 0 && <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-white/10">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* MEETINGS TAB */}
      {tab === 'meetings' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Meeting Minutes</h2>
            <button onClick={() => { resetMeetingForm(); setEditMeeting(null); setShowMeetingModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition">
              <Plus size={16} />New Meeting
            </button>
          </div>
          {meetings.length === 0 ? (
            <EmptyState icon={FileText} title="No meetings yet" description="Record your first workplan meeting or upload a Plaud transcript" action={{ label: 'Add Meeting', onClick: () => { resetMeetingForm(); setShowMeetingModal(true); } }} />
          ) : (
            <div className="space-y-2">
              {meetings.map(m => (
                <div key={m.id} className="bg-white/5 rounded-lg border border-white/10">
                  <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpandedMeeting(expandedMeeting === m.id ? null : m.id)}>
                    {expandedMeeting === m.id ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{m.title}</span>
                        <StatusBadge status={m.meeting_type} />
                        <span className="text-xs text-gray-500">{m.source}</span>
                      </div>
                      <span className="text-xs text-gray-400">{new Date(m.meeting_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={(e) => { e.stopPropagation(); setEditMeeting(m); setMeetingForm({ title: m.title, meeting_date: m.meeting_date, meeting_type: m.meeting_type, content: m.content || '', source: m.source, transcript_raw: m.transcript_raw || '' }); setShowMeetingModal(true); }} className="p-1.5 rounded hover:bg-white/10 text-gray-400"><Edit2 size={14} /></button>
                      <button onClick={(e) => { e.stopPropagation(); deleteMeeting(m.id); }} className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-red-400"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  {expandedMeeting === m.id && (
                    <div className="px-4 pb-4 border-t border-white/5 pt-3">
                      {m.content ? (
                        <div className="text-sm text-gray-300 whitespace-pre-wrap">{m.content}</div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">No notes yet. Click edit to add meeting minutes.</p>
                      )}
                      {m.transcript_raw && (
                        <details className="mt-3">
                          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300">View raw transcript</summary>
                          <pre className="mt-2 text-xs text-gray-500 whitespace-pre-wrap bg-black/20 rounded p-3 max-h-48 overflow-y-auto">{m.transcript_raw}</pre>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TASKS TAB - Kanban Board */}
      {tab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Task Board</h2>
            <button onClick={() => { resetTaskForm(); setEditTask(null); setShowTaskModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition">
              <Plus size={16} />New Task
            </button>
          </div>
          <div className="grid grid-cols-5 gap-3">
            {taskStatuses.map(status => (
              <div key={status} className="bg-white/5 rounded-lg p-3 min-h-[200px]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-400 uppercase">{status.replace('_', ' ')}</span>
                  <span className="text-xs text-gray-500">{tasksByStatus[status]?.length || 0}</span>
                </div>
                <div className="space-y-2">
                  {(tasksByStatus[status] || []).map(task => (
                    <div key={task.id} className="bg-[#1a1a2e] rounded-lg p-3 border border-white/5 hover:border-white/20 transition cursor-pointer group"
                         onClick={() => { setEditTask(task); setTaskForm({ title: task.title, description: task.description || '', status: task.status, priority: task.priority, due_date: task.due_date || '', assigned_to: '' }); setShowTaskModal(true); }}>
                      <div className="flex items-start justify-between">
                        <span className="text-sm text-white font-medium leading-tight">{task.title}</span>
                        <button onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 text-gray-500 transition"><Trash2 size={12} /></button>
                      </div>
                      {task.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{task.description}</p>}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <PriorityBadge priority={task.priority} />
                        {task.due_date && <span className="text-xs text-gray-500">{new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                        {task.assigned_member && <span className="text-xs text-gray-400">→ {task.assigned_member.name}</span>}
                      </div>
                      {status !== 'done' && (
                        <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition">
                          {taskStatuses.filter(s => s !== status).slice(0, 2).map(s => (
                            <button key={s} onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, s); }} className="text-xs px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-gray-400 transition">
                              → {s.replace('_', ' ')}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CADENCE TAB */}
      {tab === 'cadence' && <CadenceTracker brandId={brandId} meetings={meetings} tasks={tasks} />}

      {/* Meeting Modal */}
      <Modal open={showMeetingModal} onClose={() => { setShowMeetingModal(false); setEditMeeting(null); }} title={editMeeting ? 'Edit Meeting' : 'New Meeting'} size="lg">
        <div className="space-y-4">
          <FormField label="Title" name="title" value={meetingForm.title} onChange={e => setMeetingForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. April Workplan Meeting" required />
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Date" name="meeting_date" type="date" value={meetingForm.meeting_date} onChange={e => setMeetingForm(f => ({ ...f, meeting_date: e.target.value }))} required />
            <FormField label="Type" name="meeting_type" value={meetingForm.meeting_type} onChange={e => setMeetingForm(f => ({ ...f, meeting_type: e.target.value }))} options={[{ value: 'workplan', label: 'Workplan' }, { value: 'review', label: 'Review' }, { value: 'brainstorm', label: 'Brainstorm' }, { value: 'adhoc', label: 'Ad-hoc' }]} />
            <FormField label="Source" name="source" value={meetingForm.source} onChange={e => setMeetingForm(f => ({ ...f, source: e.target.value }))} options={[{ value: 'manual', label: 'Manual' }, { value: 'plaud', label: 'Plaud Transcript' }, { value: 'whatsapp', label: 'WhatsApp Export' }]} />
          </div>
          <FormField label="Meeting Notes" name="content" type="textarea" value={meetingForm.content} onChange={e => setMeetingForm(f => ({ ...f, content: e.target.value }))} placeholder="Key discussions, decisions, and action items..." rows={8} />
          <FormField label="Raw Transcript (optional)" name="transcript_raw" type="textarea" value={meetingForm.transcript_raw} onChange={e => setMeetingForm(f => ({ ...f, transcript_raw: e.target.value }))} placeholder="Paste Plaud transcript or WhatsApp export here..." rows={4} />
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setShowMeetingModal(false); setEditMeeting(null); }} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
            <button onClick={saveMeeting} disabled={!meetingForm.title || !meetingForm.meeting_date} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm rounded-lg transition">
              {editMeeting ? 'Update' : 'Create'} Meeting
            </button>
          </div>
        </div>
      </Modal>

      {/* Task Modal */}
      <Modal open={showTaskModal} onClose={() => { setShowTaskModal(false); setEditTask(null); }} title={editTask ? 'Edit Task' : 'New Task'} size="lg">
        <div className="space-y-4">
          <FormField label="Task Title" name="title" value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Design April IG carousel" required />
          <FormField label="Description" name="description" type="textarea" value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} placeholder="Detailed task brief, requirements, reference links..." rows={4} />
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Priority" name="priority" value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))} options={[{ value: 'urgent', label: '🔴 Urgent' }, { value: 'high', label: '🟠 High' }, { value: 'medium', label: '🟡 Medium' }, { value: 'low', label: '⚪ Low' }]} />
            <FormField label="Status" name="status" value={taskForm.status} onChange={e => setTaskForm(f => ({ ...f, status: e.target.value }))} options={[{ value: 'backlog', label: 'Backlog' }, { value: 'todo', label: 'To Do' }, { value: 'in_progress', label: 'In Progress' }, { value: 'review', label: 'Review' }, { value: 'done', label: 'Done' }]} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Due Date" name="due_date" type="date" value={taskForm.due_date} onChange={e => setTaskForm(f => ({ ...f, due_date: e.target.value }))} />
            <FormField label="Assign To" name="assigned_to" value={taskForm.assigned_to} onChange={e => setTaskForm(f => ({ ...f, assigned_to: e.target.value }))} options={teamMembers.map(m => ({ value: m.id, label: m.name }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setShowTaskModal(false); setEditTask(null); }} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
            <button onClick={saveTask} disabled={!taskForm.title} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm rounded-lg transition">
              {editTask ? 'Update' : 'Create'} Task
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Cadence Tracker Sub-component
function CadenceTracker({ brandId, meetings, tasks }: { brandId: string | null; meetings: Meeting[]; tasks: Task[] }) {
  const now = new Date();
  const thisMonth = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const thisMonthMeetings = meetings.filter(m => { const d = new Date(m.meeting_date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
  const activeTasks = tasks.filter(t => t.status !== 'done' && t.status !== 'archived');
  const overdueTasks = activeTasks.filter(t => t.due_date && new Date(t.due_date) < now);

  const stats = [
    { label: 'Meetings This Month', value: thisMonthMeetings.length, target: 2, icon: Calendar },
    { label: 'Active Tasks', value: activeTasks.length, target: null, icon: CheckSquare },
    { label: 'Overdue Tasks', value: overdueTasks.length, target: 0, icon: ClipboardList },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-white">Cadence Tracker — {thisMonth}</h2>
      <div className="grid grid-cols-3 gap-4">
        {stats.map((s, i) => {
          const isGood = s.target === null ? true : s.label.includes('Overdue') ? s.value === 0 : s.value >= s.target;
          return (
            <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2"><s.icon size={16} />{s.label}</div>
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-bold ${isGood ? 'text-green-400' : 'text-red-400'}`}>{s.value}</span>
                {s.target !== null && <span className="text-sm text-gray-500">/ {s.target} target</span>}
              </div>
            </div>
          );
        })}
      </div>
      {overdueTasks.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-red-400 mb-2">⚠️ Overdue Tasks</h3>
          <div className="space-y-1">
            {overdueTasks.map(t => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{t.title}</span>
                <span className="text-red-400 text-xs">Due {new Date(t.due_date!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
