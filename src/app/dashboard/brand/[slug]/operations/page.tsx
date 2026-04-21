'use client';
import { useState, useEffect, useCallback, useRef, use } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import dynamic from 'next/dynamic';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import StatusBadge from '@/components/ui/StatusBadge';
import PriorityBadge from '@/components/ui/PriorityBadge';
import EmptyState from '@/components/ui/EmptyState';
import { ClipboardList, Plus, FileText, CheckSquare, BarChart3, Calendar, Trash2, Edit2, ChevronDown, ChevronRight, ArrowLeft, Save, Clock, Building2, Search, X } from 'lucide-react';

// Lazy-load TipTap editor (big bundle, no SSR)
const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), { ssr: false, loading: () => <div className="h-64 bg-gray-50 rounded-lg animate-pulse" /> });

type Tab = 'meetings' | 'tasks' | 'cadence';
type MeetingView = 'brand' | 'group';

interface Brand { id: string; name: string; slug: string; brand_group: string }
interface Meeting { id: string; brand_id: string; title: string; meeting_date: string; meeting_type: string; content: string | null; source: string; action_items_extracted: boolean; transcript_raw: string | null; creator?: { id: string; name: string } | null; brand?: { name: string; slug: string } | null }
interface Task { id: string; title: string; description: string | null; status: string; priority: string; due_date: string | null; assigned_member?: { name: string } | null; tags: string[] | null }

const BRAND_GROUP_LABELS: Record<string, string> = {
  neo_group: 'Neo Group', fleursophy: 'Fleursophy', deprosperoo: 'Deprosperoo', independent: 'Independent', tsim: 'TSIM', other: 'Other'
};

export default function OperationsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [tab, setTab] = useState<Tab>('meetings');
  const [brand, setBrand] = useState<Brand | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [groupMeetings, setGroupMeetings] = useState<Meeting[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [meetingView, setMeetingView] = useState<MeetingView>('brand');
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [isNewMeeting, setIsNewMeeting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [searchQuery, setSearchQuery] = useState('');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = createBrowserClient();

  // New meeting form
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newType, setNewType] = useState('workplan');
  const [newSource, setNewSource] = useState('manual');

  const loadBrand = useCallback(async () => {
    const { data } = await supabase.from('brands').select('id, name, slug, brand_group').eq('slug', slug).single();
    if (data) { setBrand(data); return data; }
    return null;
  }, [slug, supabase]);

  const loadData = useCallback(async (b: Brand) => {
    setLoading(true);
    const [meetingsRes, tasksRes, teamRes] = await Promise.all([
      fetch(`/api/brands/${b.id}/meetings`),
      fetch(`/api/brands/${b.id}/tasks`),
      fetch('/api/team'),
    ]);
    if (meetingsRes.ok) setMeetings(await meetingsRes.json());
    if (tasksRes.ok) setTasks(await tasksRes.json());
    if (teamRes.ok) setTeamMembers(await teamRes.json());
    setLoading(false);
  }, []);

  const loadGroupMeetings = useCallback(async (b: Brand) => {
    const res = await fetch(`/api/group-meetings?group=${b.brand_group}`);
    if (res.ok) setGroupMeetings(await res.json());
  }, []);

  useEffect(() => {
    loadBrand().then(b => { if (b) { loadData(b); loadGroupMeetings(b); } });
  }, [loadBrand, loadData, loadGroupMeetings]);

  // Auto-save meeting content
  const autoSave = useCallback(async (meetingId: string, html: string) => {
    if (!brand) return;
    setSaveStatus('saving');
    await fetch(`/api/brands/${brand.id}/meetings/${meetingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: html }),
    });
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  }, [brand]);

  const handleContentChange = useCallback((meetingId: string, html: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus('saving');
    saveTimerRef.current = setTimeout(() => autoSave(meetingId, html), 1200);
  }, [autoSave]);

  // Create new meeting
  const createMeeting = async () => {
    if (!brand || !newTitle.trim()) return;
    const res = await fetch(`/api/brands/${brand.id}/meetings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle, meeting_date: newDate, meeting_type: newType, source: newSource, content: '<p></p>' }),
    });
    if (res.ok) {
      const meeting = await res.json();
      setMeetings(prev => [meeting, ...prev]);
      setSelectedMeeting(meeting);
      setIsNewMeeting(false);
    }
  };

  // Update meeting metadata
  const updateMeetingMeta = async (meetingId: string, updates: Partial<Meeting>) => {
    if (!brand) return;
    await fetch(`/api/brands/${brand.id}/meetings/${meetingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, ...updates } : m));
    if (selectedMeeting?.id === meetingId) setSelectedMeeting(prev => prev ? { ...prev, ...updates } : prev);
  };

  const deleteMeeting = async (id: string) => {
    if (!brand || !confirm('Delete this meeting note?')) return;
    await fetch(`/api/brands/${brand.id}/meetings/${id}`, { method: 'DELETE' });
    setMeetings(prev => prev.filter(m => m.id !== id));
    if (selectedMeeting?.id === id) { setSelectedMeeting(null); setIsNewMeeting(false); }
    loadGroupMeetings(brand);
  };

  // Task CRUD
  const [taskForm, setTaskForm] = useState({ title: '', description: '', status: 'todo', priority: 'medium', due_date: '', assigned_to: '' });
  const resetTaskForm = () => setTaskForm({ title: '', description: '', status: 'todo', priority: 'medium', due_date: '', assigned_to: '' });

  const saveTask = async () => {
    if (!brand) return;
    const payload = { ...taskForm, assigned_to: taskForm.assigned_to || null, due_date: taskForm.due_date || null, description: taskForm.description || null };
    if (editTask) {
      await fetch(`/api/brands/${brand.id}/tasks/${editTask.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } else {
      await fetch(`/api/brands/${brand.id}/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
    setShowTaskModal(false); setEditTask(null); resetTaskForm();
    loadData(brand);
  };

  const deleteTask = async (id: string) => {
    if (!brand || !confirm('Delete this task?')) return;
    await fetch(`/api/brands/${brand.id}/tasks/${id}`, { method: 'DELETE' });
    loadData(brand);
  };

  const taskStatuses = ['backlog', 'todo', 'in_progress', 'review', 'done'];
  const tasksByStatus = taskStatuses.reduce((acc, s) => { acc[s] = tasks.filter(t => t.status === s); return acc; }, {} as Record<string, Task[]>);

  // Filter meetings
  const displayMeetings = meetingView === 'group' ? groupMeetings : meetings;
  const filteredMeetings = searchQuery
    ? displayMeetings.filter(m => m.title.toLowerCase().includes(searchQuery.toLowerCase()) || m.content?.toLowerCase().includes(searchQuery.toLowerCase()) || m.brand?.name?.toLowerCase().includes(searchQuery.toLowerCase()))
    : displayMeetings;

  const groupLabel = brand ? BRAND_GROUP_LABELS[brand.brand_group] || brand.brand_group : '';

  const tabs: { key: Tab; label: string; shortLabel: string; icon: React.ElementType; count: number }[] = [
    { key: 'meetings', label: 'Meeting Notes', shortLabel: 'Notes', icon: FileText, count: meetings.length },
    { key: 'tasks', label: 'Task Board', shortLabel: 'Tasks', icon: CheckSquare, count: tasks.filter(t => t.status !== 'done' && t.status !== 'archived').length },
    { key: 'cadence', label: 'Cadence Tracker', shortLabel: 'Cadence', icon: BarChart3, count: 0 },
  ];

  if (loading) return <div className="p-4 sm:p-6"><div className="animate-pulse space-y-4"><div className="h-8 bg-gray-50 rounded w-48" /><div className="h-64 bg-gray-50 rounded" /></div></div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-50 rounded-lg p-1 overflow-x-auto scrollbar-hide">
        {tabs.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); if (t.key === 'meetings') { setSelectedMeeting(null); setIsNewMeeting(false); } }} className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition whitespace-nowrap ${tab === t.key ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}>
            <t.icon size={14} className="shrink-0" />
            <span className="sm:hidden">{t.shortLabel}</span>
            <span className="hidden sm:inline">{t.label}</span>
            {t.count > 0 && <span className="ml-0.5 sm:ml-1 px-1.5 py-0.5 text-[10px] sm:text-xs rounded-full bg-gray-100">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ===== MEETINGS TAB ===== */}
      {tab === 'meetings' && !selectedMeeting && !isNewMeeting && (
        <div className="space-y-3 sm:space-y-4 animate-fade-in">
          {/* Header with view toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Meeting Notes</h2>
              {/* Brand / Group toggle */}
              <div className="flex bg-gray-50 rounded-lg p-0.5 text-xs">
                <button onClick={() => setMeetingView('brand')} className={`px-2.5 py-1 rounded-md transition ${meetingView === 'brand' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-900'}`}>
                  Brand
                </button>
                <button onClick={() => { setMeetingView('group'); if (brand) loadGroupMeetings(brand); }} className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 ${meetingView === 'group' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-900'}`}>
                  <Building2 size={11} />{groupLabel}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative flex-1 sm:flex-initial">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input type="text" placeholder="Search notes..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="pl-8 pr-8 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg w-full sm:w-48 focus:w-64 transition-all" />
                {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900"><X size={12} /></button>}
              </div>
              <button onClick={() => { setIsNewMeeting(true); setNewTitle(''); setNewDate(new Date().toISOString().split('T')[0]); setNewType('workplan'); setNewSource('manual'); }} className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm rounded-lg transition shrink-0">
                <Plus size={14} /><span className="hidden sm:inline">New Note</span><span className="sm:hidden">New</span>
              </button>
            </div>
          </div>

          {/* Meeting List */}
          {filteredMeetings.length === 0 ? (
            <EmptyState icon={FileText} title={searchQuery ? 'No matching notes' : 'No meeting notes yet'} description={searchQuery ? 'Try a different search term' : 'Create your first meeting note — it works like a mini Google Doc!'} action={searchQuery ? undefined : { label: 'Create Note', onClick: () => setIsNewMeeting(true) }} />
          ) : (
            <div className="space-y-2">
              {filteredMeetings.map(m => {
                const plainText = m.content?.replace(/<[^>]*>/g, '').trim() || '';
                const preview = plainText.slice(0, 120) + (plainText.length > 120 ? '...' : '');
                return (
                  <div key={m.id} onClick={() => setSelectedMeeting(m)} className="bg-gray-50 rounded-lg border border-gray-200 hover:border-purple-500/40 p-3 sm:p-4 cursor-pointer transition group">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {meetingView === 'group' && m.brand?.name && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-purple-500/20 text-purple-300">{m.brand.name}</span>
                          )}
                          <span className="text-sm text-gray-900 font-medium truncate">{m.title}</span>
                          <StatusBadge status={m.meeting_type} />
                        </div>
                        <div className="flex items-center gap-2 text-[10px] sm:text-xs text-gray-500">
                          <span>{new Date(m.meeting_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          {m.creator?.name && <span>• {m.creator.name}</span>}
                          <span className="badge-neutral badge text-[9px]">{m.source}</span>
                        </div>
                        {preview && <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{preview}</p>}
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); deleteMeeting(m.id); }} className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-red-400 transition shrink-0">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== NEW MEETING FORM ===== */}
      {tab === 'meetings' && isNewMeeting && !selectedMeeting && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsNewMeeting(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition">
              <ArrowLeft size={18} />
            </button>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">New Meeting Note</h2>
          </div>
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 sm:p-6 space-y-4">
            <FormField label="Title" name="title" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g. April Workplan Meeting — Korea Culture" required />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField label="Date" name="meeting_date" type="date" value={newDate} onChange={e => setNewDate(e.target.value)} required />
              <FormField label="Type" name="meeting_type" value={newType} onChange={e => setNewType(e.target.value)} options={[{ value: 'workplan', label: '📋 Workplan' }, { value: 'review', label: '🔍 Review' }, { value: 'brainstorm', label: '💡 Brainstorm' }, { value: 'adhoc', label: '⚡ Ad-hoc' }]} />
              <FormField label="Source" name="source" value={newSource} onChange={e => setNewSource(e.target.value)} options={[{ value: 'manual', label: '✍️ Manual' }, { value: 'plaud', label: '🎙️ Plaud Transcript' }, { value: 'whatsapp', label: '💬 WhatsApp Export' }]} />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setIsNewMeeting(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-900 transition">Cancel</button>
              <button onClick={createMeeting} disabled={!newTitle.trim()} className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm rounded-lg transition flex items-center gap-2">
                <FileText size={14} /> Create & Start Writing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MEETING EDITOR (inline doc view) ===== */}
      {tab === 'meetings' && selectedMeeting && (
        <div className="space-y-3 animate-fade-in">
          {/* Editor header */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={() => { setSelectedMeeting(null); if (brand) { loadData(brand); loadGroupMeetings(brand); } }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition shrink-0">
                <ArrowLeft size={18} />
              </button>
              <div className="min-w-0">
                <input type="text" value={selectedMeeting.title} onChange={e => { const val = e.target.value; setSelectedMeeting(prev => prev ? { ...prev, title: val } : prev); }}
                  onBlur={() => updateMeetingMeta(selectedMeeting.id, { title: selectedMeeting.title })}
                  className="text-base sm:text-lg font-semibold text-gray-900 bg-transparent border-none outline-none w-full truncate p-0 focus:ring-0"
                  style={{ boxShadow: 'none', minHeight: 'auto' }} />
                <div className="flex items-center gap-2 text-[10px] sm:text-xs text-gray-500 mt-0.5">
                  <span>{new Date(selectedMeeting.meeting_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  <StatusBadge status={selectedMeeting.meeting_type} />
                  {selectedMeeting.creator?.name && <span>• {selectedMeeting.creator.name}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Save indicator */}
              {saveStatus === 'saving' && <span className="text-xs text-yellow-400 flex items-center gap-1"><Clock size={12} className="animate-spin" /> Saving...</span>}
              {saveStatus === 'saved' && <span className="text-xs text-green-400 flex items-center gap-1"><Save size={12} /> Saved</span>}
              {/* Metadata edit */}
              <select value={selectedMeeting.meeting_type} onChange={e => { const val = e.target.value; setSelectedMeeting(prev => prev ? { ...prev, meeting_type: val } : prev); updateMeetingMeta(selectedMeeting.id, { meeting_type: val }); }}
                className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1">
                <option value="workplan">📋 Workplan</option>
                <option value="review">🔍 Review</option>
                <option value="brainstorm">💡 Brainstorm</option>
                <option value="adhoc">⚡ Ad-hoc</option>
              </select>
              <button onClick={() => deleteMeeting(selectedMeeting.id)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition">
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* Rich Text Editor */}
          <RichTextEditor
            content={selectedMeeting.content || ''}
            onChange={(html) => handleContentChange(selectedMeeting.id, html)}
            placeholder="Start writing your meeting notes here...&#10;&#10;💡 Tips:&#10;• Use headings for sections (Agenda, Decisions, Action Items)&#10;• Use checklists to track action items&#10;• Your notes auto-save as you type"
            autoFocus
          />

          {/* Transcript section (if available) */}
          {selectedMeeting.transcript_raw && (
            <details className="bg-gray-50 rounded-lg border border-gray-200 p-3 sm:p-4">
              <summary className="text-xs sm:text-sm text-gray-500 cursor-pointer hover:text-gray-600 font-medium">📝 Raw Transcript</summary>
              <pre className="mt-3 text-xs text-gray-500 whitespace-pre-wrap bg-black/20 rounded p-3 max-h-48 overflow-y-auto">{selectedMeeting.transcript_raw}</pre>
            </details>
          )}
        </div>
      )}

      {/* ===== TASKS TAB - Kanban Board ===== */}
      {tab === 'tasks' && (
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Task Board</h2>
            <button onClick={() => { resetTaskForm(); setEditTask(null); setShowTaskModal(true); }} className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm rounded-lg transition shrink-0">
              <Plus size={14} /><span className="hidden sm:inline">New Task</span><span className="sm:hidden">New</span>
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-5">
            {taskStatuses.map(status => (
              <div key={status} className="bg-gray-50 rounded-lg p-3 min-h-[200px] min-w-[220px] sm:min-w-0 flex-shrink-0 sm:flex-shrink">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase">{status.replace('_', ' ')}</span>
                  <span className="text-[10px] sm:text-xs text-gray-500">{tasksByStatus[status]?.length || 0}</span>
                </div>
                <div className="space-y-2">
                  {(tasksByStatus[status] || []).map(task => (
                    <div key={task.id} className="bg-white rounded-lg p-2.5 sm:p-3 border border-gray-200 hover:border-gray-300 transition cursor-pointer group"
                         onClick={() => { setEditTask(task); setTaskForm({ title: task.title, description: task.description || '', status: task.status, priority: task.priority, due_date: task.due_date || '', assigned_to: '' }); setShowTaskModal(true); }}>
                      <div className="flex items-start justify-between">
                        <span className="text-xs sm:text-sm text-gray-900 font-medium leading-tight">{task.title}</span>
                        <button onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 text-gray-500 transition"><Trash2 size={12} /></button>
                      </div>
                      {task.description && <p className="text-[10px] sm:text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>}
                      <div className="flex items-center gap-1.5 sm:gap-2 mt-2 flex-wrap">
                        <PriorityBadge priority={task.priority} />
                        {task.due_date && <span className="text-[10px] sm:text-xs text-gray-500">{new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                        {task.assigned_member && <span className="text-[10px] sm:text-xs text-gray-500">→ {task.assigned_member.name}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CADENCE TAB */}
      {tab === 'cadence' && <CadenceTracker brandId={brand?.id || null} meetings={meetings} tasks={tasks} />}

      {/* Task Modal */}
      <Modal open={showTaskModal} onClose={() => { setShowTaskModal(false); setEditTask(null); }} title={editTask ? 'Edit Task' : 'New Task'} size="lg">
        <div className="space-y-4">
          <FormField label="Task Title" name="title" value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Design April IG carousel" required />
          <FormField label="Description" name="description" type="textarea" value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} placeholder="Detailed task brief, requirements, reference links..." rows={3} />
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Priority" name="priority" value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))} options={[{ value: 'urgent', label: '🔴 Urgent' }, { value: 'high', label: '🟠 High' }, { value: 'medium', label: '🟡 Medium' }, { value: 'low', label: '⚪ Low' }]} />
            <FormField label="Status" name="status" value={taskForm.status} onChange={e => setTaskForm(f => ({ ...f, status: e.target.value }))} options={[{ value: 'backlog', label: 'Backlog' }, { value: 'todo', label: 'To Do' }, { value: 'in_progress', label: 'In Progress' }, { value: 'review', label: 'Review' }, { value: 'done', label: 'Done' }]} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Due Date" name="due_date" type="date" value={taskForm.due_date} onChange={e => setTaskForm(f => ({ ...f, due_date: e.target.value }))} />
            <FormField label="Assign To" name="assigned_to" value={taskForm.assigned_to} onChange={e => setTaskForm(f => ({ ...f, assigned_to: e.target.value }))} options={teamMembers.map(m => ({ value: m.id, label: m.name }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setShowTaskModal(false); setEditTask(null); }} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-900">Cancel</button>
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
    <div className="space-y-4 sm:space-y-6">
      <h2 className="text-base sm:text-lg font-semibold text-gray-900">Cadence Tracker — {thisMonth}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {stats.map((s, i) => {
          const isGood = s.target === null ? true : s.label.includes('Overdue') ? s.value === 0 : s.value >= s.target;
          return (
            <div key={i} className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-200">
              <div className="flex items-center gap-2 text-gray-500 text-xs sm:text-sm mb-2"><s.icon size={16} />{s.label}</div>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl sm:text-3xl font-bold ${isGood ? 'text-green-400' : 'text-red-400'}`}>{s.value}</span>
                {s.target !== null && <span className="text-xs sm:text-sm text-gray-500">/ {s.target} target</span>}
              </div>
            </div>
          );
        })}
      </div>
      {overdueTasks.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 sm:p-4">
          <h3 className="text-xs sm:text-sm font-semibold text-red-400 mb-2">⚠️ Overdue Tasks</h3>
          <div className="space-y-1">
            {overdueTasks.map(t => (
              <div key={t.id} className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-gray-600">{t.title}</span>
                <span className="text-red-400 text-xs">Due {new Date(t.due_date!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
