'use client';
import { useState, useEffect, useCallback, useRef, use } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import dynamic from 'next/dynamic';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import StatusBadge from '@/components/ui/StatusBadge';
import PriorityBadge from '@/components/ui/PriorityBadge';
import EmptyState from '@/components/ui/EmptyState';
import { ClipboardList, Plus, FileText, CheckSquare, Calendar, Trash2, Edit2, ChevronDown, ChevronRight, ArrowLeft, Save, Clock, Building2, Search, X, Upload, Sparkles, ListTodo, GripVertical, MoreHorizontal, Filter } from 'lucide-react';

// Lazy-load TipTap editor (big bundle, no SSR)
const RichTextEditor = dynamic(() => import('@/components/RichTextEditor'), { ssr: false, loading: () => <div className="h-64 bg-gray-50 rounded-lg animate-pulse" /> });

type Tab = 'meetings' | 'tasks';
type MeetingView = 'brand' | 'group';
type TaskViewMode = 'table' | 'kanban';

interface Brand { id: string; name: string; slug: string; brand_group: string }
interface Meeting { id: string; brand_id: string; title: string; meeting_date: string; meeting_type: string; content: string | null; source: string; action_items_extracted: boolean; transcript_raw: string | null; creator?: { id: string; name: string } | null; brand?: { name: string; slug: string } | null }
interface Task { id: string; title: string; description: string | null; status: string; priority: string; due_date: string | null; assigned_to: string | null; assigned_member?: { id: string; name: string; email: string } | null; tags: string[] | null; created_at?: string }

const BRAND_GROUP_LABELS: Record<string, string> = {
  neo_group: 'Neo Group', fleursophy: 'Fleursophy', deprosperoo: 'Deprosperoo', independent: 'Independent', tsim: 'TSIM', other: 'Other'
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  backlog: { label: 'Backlog', color: 'text-gray-500', bg: 'bg-gray-100', icon: '📋' },
  todo: { label: 'To Do', color: 'text-blue-600', bg: 'bg-blue-50', icon: '📌' },
  in_progress: { label: 'In Progress', color: 'text-amber-600', bg: 'bg-amber-50', icon: '🔄' },
  review: { label: 'Review', color: 'text-purple-600', bg: 'bg-purple-50', icon: '👀' },
  done: { label: 'Done', color: 'text-green-600', bg: 'bg-green-50', icon: '✅' },
};

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const STATUS_ORDER: Record<string, number> = { in_progress: 0, todo: 1, review: 2, backlog: 3, done: 4 };

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
  const [taskViewMode, setTaskViewMode] = useState<TaskViewMode>('table');
  const [taskFilter, setTaskFilter] = useState<string>('active'); // 'all', 'active', status
  const [showExtractModal, setShowExtractModal] = useState(false);
  const [extractedTasks, setExtractedTasks] = useState<{ title: string; selected: boolean }[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number; content: string } | null>(null);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showProcessSuccess, setShowProcessSuccess] = useState(false);
  const [foundActionItems, setFoundActionItems] = useState(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  // Load pdf.js from CDN for PDF text extraction
  const loadPdfJs = useCallback(async () => {
    if ((window as any).pdfjsLib) return (window as any).pdfjsLib;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        const lib = (window as any).pdfjsLib;
        lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(lib);
      };
      script.onerror = () => reject(new Error('Failed to load PDF parser'));
      document.head.appendChild(script);
    });
  }, []);

  // Extract text from PDF using pdf.js
  const extractPdfText = useCallback(async (file: File): Promise<string> => {
    const pdfjsLib = await loadPdfJs() as any;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: any) => {
          // Add newline for large Y-position gaps (new lines in PDF)
          return item.str;
        })
        .join(' ')
        .replace(/  +/g, ' ')
        .trim();
      if (pageText) pages.push(pageText);
    }
    return pages.join('\n');
  }, [loadPdfJs]);

  // File upload handler — supports PDF, TXT, MD files
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      let text = '';
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'pdf') {
        text = await extractPdfText(file);
      } else {
        text = await file.text();
      }

      if (!text.trim()) {
        throw new Error('Could not extract text from this file. Please try exporting as .txt instead.');
      }
      setUploadedFile({ name: file.name, size: file.size, content: text });
      setRawFile(file);
    } catch (err) {
      console.error('Upload failed:', err);
      const msg = err instanceof Error ? err.message : 'Failed to read file';
      alert(`⚠️ ${msg}\n\nTip: For Plaud recordings, try exporting as .txt format instead of PDF.`);
    }
    setUploadingFile(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Smart transcript processor — structures raw text into organized meeting notes
  // Convert AI-structured result to rich HTML for the editor
  // Convert AI markdown response to rich HTML for TipTap editor
  const aiResultToHtml = (aiData: { formattedContent?: string; actionItems?: { task: string; assignee?: string | null; priority?: string }[]; raw_ai_response?: string }): { html: string; actionItemCount: number } => {
    const md = aiData.formattedContent || aiData.raw_ai_response || '';
    if (!md.trim()) return { html: '<p>AI returned empty response</p>', actionItemCount: 0 };
    
    // Convert markdown to HTML
    let html = md
      // Headers
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
      // Horizontal rules
      .replace(/^---$/gm, '<hr/>')
      // Bullet lists with sub-bullets (indented with 2+ spaces)
      .replace(/^  - (.+)$/gm, '@@SUB@@$1@@/SUB@@')
      .replace(/^- (.+)$/gm, '@@LI@@$1@@/LI@@');
    
    // Process list items and sub-items into proper HTML
    const lines = html.split('\n');
    let result = '';
    let inList = false;
    let inSubList = false;
    
    for (const line of lines) {
      if (line.includes('@@LI@@')) {
        if (inSubList) { result += '</ul>'; inSubList = false; }
        if (!inList) { result += '<ul>'; inList = true; }
        result += '<li>' + line.replace(/@@LI@@(.+)@@\/LI@@/, '$1') + '</li>';
      } else if (line.includes('@@SUB@@')) {
        if (!inSubList) { result += '<ul>'; inSubList = true; }
        result += '<li>' + line.replace(/@@SUB@@(.+)@@\/SUB@@/, '$1') + '</li>';
      } else {
        if (inSubList) { result += '</ul>'; inSubList = false; }
        if (inList) { result += '</ul>'; inList = false; }
        // Handle action items specially — make them task list items
        if (line.includes('📌 Action Items')) {
          result += line;
          // Start a task list after this heading
        } else if (line.trim() === '') {
          result += '';
        } else if (!line.startsWith('<h') && !line.startsWith('<hr') && !line.startsWith('<ul') && !line.startsWith('<li') && line.trim()) {
          result += '<p>' + line + '</p>';
        } else {
          result += line;
        }
      }
    }
    if (inSubList) result += '</ul>';
    if (inList) result += '</ul>';
    
    // Convert action items section to task list
    const actionSection = result.match(/<h[23]>📌 Action Items<\/h[23]>(.*?)(?=<h[23]>|$)/s);
    if (actionSection) {
      let taskHtml = actionSection[0];
      // Replace the regular ul/li with taskList items
      taskHtml = taskHtml.replace(/<ul>/, '<ul data-type="taskList">');
      taskHtml = taskHtml.replace(/<li>/g, '<li data-type="taskItem" data-checked="false">');
      result = result.replace(actionSection[0], taskHtml);
    }
    
    // Add header
    result = '<p><em>AI-processed transcript. Review and edit as needed.</em></p>' + result;
    
    return { html: result, actionItemCount: aiData.actionItems?.length || 0 };
  };

  // Fallback: basic text processing when AI is unavailable
  const processTranscriptBasic = (text: string): { html: string; actionItemCount: number } => {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length === 0) return { html: '<p></p>', actionItemCount: 0 };
    let html = '<h2>📋 Meeting Notes</h2>';
    html += '<p><em>AI processing unavailable. Raw transcript shown below — edit manually.</em></p>';
    html += '<hr/><h3>💬 Transcript</h3>';
    const displayLines = lines.slice(0, 80);
    html += displayLines.map(l => `<p>${l.trim()}</p>`).join('');
    if (lines.length > 80) html += `<p><em>... ${lines.length - 80} more lines ...</em></p>`;
    html += '<hr/><h3>📌 Action Items</h3>';
    html += '<ul data-type="taskList"><li data-type="taskItem" data-checked="false">Review transcript and add action items manually</li></ul>';
    return { html, actionItemCount: 0 };
  };

  // Create meeting and process uploaded transcript
  const createAndProcessMeeting = async () => {
    if (!brand) return;
    setIsProcessing(true);
    const rawText = uploadedFile?.content || '';
    // Send raw file to server for proper extraction + AI processing
    let processed: { html: string; actionItemCount: number };
    let serverExtractedText = rawText;
    try {
      setNewTitle(newTitle || 'Processing...');
      const formData = new FormData();
      if (rawFile) {
        formData.append('file', rawFile);
      } else {
        formData.append('transcript', rawText);
      }
      const aiRes = await fetch('/api/process-transcript', {
        method: 'POST',
        body: formData,
      });
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        processed = aiResultToHtml(aiData);
        // Use server-extracted text as the raw transcript (more complete than client-side)
        if (aiData.extractedText) serverExtractedText = aiData.extractedText;
      } else {
        const errData = await aiRes.json().catch(() => ({}));
        console.warn('AI processing failed:', errData);
        alert(`⚠️ AI processing failed: ${errData.error || 'Unknown error'}. Falling back to basic view.`);
        processed = processTranscriptBasic(rawText);
      }
    } catch (err) {
      console.warn('AI API unreachable, using basic processing:', err);
      processed = processTranscriptBasic(rawText);
    }
    try {
      const res = await fetch(`/api/brands/${brand.id}/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle || `${newSource === 'plaud' ? 'Plaud' : newSource === 'whatsapp' ? 'WhatsApp' : 'Transcript'} Notes — ${new Date(newDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
          meeting_date: newDate,
          meeting_type: newType,
          source: newSource,
          transcript_raw: serverExtractedText || rawText,
          content: processed.html,
        }),
      });
      if (res.ok) {
        const meeting = await res.json();
        setMeetings(prev => [meeting, ...prev]);
        setSelectedMeeting(meeting);
        setIsNewMeeting(false);
        setUploadedFile(null); setRawFile(null);
        setNewTitle('');
        setShowProcessSuccess(true);
        setFoundActionItems(processed.actionItemCount);
        setTimeout(() => setShowProcessSuccess(false), 15000);
      } else {
        const errData = await res.json().catch(() => ({ error: 'Unknown error' }));
        alert(`⚠️ Failed to create meeting note: ${errData.error || 'Server error'}\n\nPlease try again.`);
      }
    } catch (err) { console.error('Create failed:', err); alert('⚠️ Network error creating meeting note. Please try again.'); }
    setIsProcessing(false);
  };

  // Re-process an existing meeting's transcript
  const reprocessTranscript = async () => {
    if (!selectedMeeting?.transcript_raw || !brand) return;
    setIsProcessing(true);
    // Call AI API to reprocess
    let processed: { html: string; actionItemCount: number };
    try {
      const formData = new FormData();
      formData.append('transcript', selectedMeeting.transcript_raw);
      const aiRes = await fetch('/api/process-transcript', {
        method: 'POST',
        body: formData,
      });
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        processed = aiResultToHtml(aiData);
      } else {
        processed = processTranscriptBasic(selectedMeeting.transcript_raw);
      }
    } catch {
      processed = processTranscriptBasic(selectedMeeting.transcript_raw);
    }
    await handleContentChange(selectedMeeting.id, processed.html);
    setSelectedMeeting(prev => prev ? { ...prev, content: processed.html } : prev);
    setShowProcessSuccess(true);
    setFoundActionItems(processed.actionItemCount);
    setTimeout(() => setShowProcessSuccess(false), 15000);
    setIsProcessing(false);
  };

  // Extract tasks from meeting content
  const extractTasksFromContent = (html: string): { title: string; selected: boolean }[] => {
    if (!html) return [];
    const items: { title: string; selected: boolean }[] = [];
    const seen = new Set<string>();

    // 1. Extract TipTap task items (checklists)
    const taskItemRegex = /data-type="taskItem"[^>]*>([^<]*(?:<[^/][^>]*>[^<]*)*)/gi;
    let match;
    while ((match = taskItemRegex.exec(html)) !== null) {
      const text = match[1].replace(/<[^>]*>/g, '').trim();
      if (text.length > 3 && !seen.has(text.toLowerCase())) {
        seen.add(text.toLowerCase());
        items.push({ title: text, selected: true });
      }
    }

    // 2. Look for action item patterns in plain text
    const plainText = html.replace(/<[^>]*>/g, '\n');
    const actionPatterns = [
      /(?:action\s*items?|follow[- ]?ups?|to[- ]?dos?|next\s*steps?)\s*:?\s*\n((?:[-•*]\s*.+\n?)+)/gi,
      /[-•*]\s*((?:follow up|send|prepare|create|update|check|confirm|schedule|review|draft|share|organize|coordinate|plan|complete|finalize|arrange|book|set up|reach out)[^.\n]*)/gi,
    ];

    for (const pattern of actionPatterns) {
      while ((match = pattern.exec(plainText)) !== null) {
        const text = match[1].replace(/^[-•*]\s*/, '').trim();
        if (text.length > 5 && text.length < 200 && !seen.has(text.toLowerCase())) {
          seen.add(text.toLowerCase());
          items.push({ title: text.charAt(0).toUpperCase() + text.slice(1), selected: true });
        }
      }
    }

    // 3. Lines starting with checkbox-like patterns
    const lines = plainText.split('\n');
    for (const line of lines) {
      const cleaned = line.replace(/^[\s\-•*☐☑✓✗\[\]]+/, '').trim();
      if (cleaned.length > 5 && cleaned.length < 200) {
        const isAction = /^(need to|must|should|will|to |please |ensure |make sure|let'?s|action:|todo:|task:)/i.test(cleaned);
        if (isAction && !seen.has(cleaned.toLowerCase())) {
          seen.add(cleaned.toLowerCase());
          items.push({ title: cleaned.charAt(0).toUpperCase() + cleaned.slice(1), selected: true });
        }
      }
    }

    return items;
  };

  const handleExtractTasks = () => {
    if (!selectedMeeting?.content) return;
    const found = extractTasksFromContent(selectedMeeting.content);
    if (found.length === 0) {
      alert('No action items found. Tip: Use the checklist feature (☑) in the editor to mark action items, or write lines starting with "Follow up", "Send", "Prepare", etc.');
      return;
    }
    setExtractedTasks(found);
    setShowExtractModal(true);
  };

  const createExtractedTasks = async () => {
    if (!brand) return;
    const selected = extractedTasks.filter(t => t.selected);
    for (const t of selected) {
      await fetch(`/api/brands/${brand.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: t.title, status: 'todo', priority: 'medium', description: `From meeting: ${selectedMeeting?.title || ''}` }),
      });
    }
    // Mark meeting as extracted
    if (selectedMeeting) {
      await fetch(`/api/brands/${brand.id}/meetings/${selectedMeeting.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_items_extracted: true }),
      });
      setSelectedMeeting(prev => prev ? { ...prev, action_items_extracted: true } : prev);
    }
    setShowExtractModal(false);
    setExtractedTasks([]);
    loadData(brand);
    setTab('tasks');
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

  const quickUpdateTask = async (taskId: string, updates: Record<string, string | null>) => {
    if (!brand) return;
    await fetch(`/api/brands/${brand.id}/tasks/${taskId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
    if ('assigned_to' in updates) {
      const member = teamMembers.find(m => m.id === updates.assigned_to);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates, assigned_member: member ? { id: member.id, name: member.name, email: '' } : null } as unknown as Task : t));
    } else {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates as Record<string, string> } : t));
    }
  };

  const deleteTask = async (id: string) => {
    if (!brand || !confirm('Delete this task?')) return;
    await fetch(`/api/brands/${brand.id}/tasks/${id}`, { method: 'DELETE' });
    loadData(brand);
  };

  // Task filtering & sorting
  const filteredTasks = tasks
    .filter(t => {
      if (taskFilter === 'all') return true;
      if (taskFilter === 'active') return t.status !== 'done';
      return t.status === taskFilter;
    })
    .sort((a, b) => {
      const sa = STATUS_ORDER[a.status] ?? 9;
      const sb = STATUS_ORDER[b.status] ?? 9;
      if (sa !== sb) return sa - sb;
      const pa = PRIORITY_ORDER[a.priority] ?? 9;
      const pb = PRIORITY_ORDER[b.priority] ?? 9;
      if (pa !== pb) return pa - pb;
      if (a.due_date && b.due_date) return b.due_date.localeCompare(a.due_date);
      if (a.due_date) return 1;
      if (b.due_date) return -1;
      return 0;
    });

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
            {t.count > 0 && <span className={`ml-0.5 sm:ml-1 px-1.5 py-0.5 text-[10px] sm:text-xs rounded-full ${tab === t.key ? 'bg-white/20' : 'bg-gray-200'}`}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ===== MEETINGS TAB — LIST VIEW ===== */}
      {tab === 'meetings' && !selectedMeeting && !isNewMeeting && (
        <div className="space-y-3 sm:space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Meeting Notes</h2>
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
              <div className="relative flex-1 sm:flex-initial">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Search notes..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="pl-8 pr-8 py-1.5 text-xs bg-white border border-gray-200 rounded-lg w-full sm:w-48 focus:w-64 transition-all focus:ring-1 focus:ring-purple-500 focus:border-purple-500" />
                {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900"><X size={12} /></button>}
              </div>
              <button onClick={() => { setIsNewMeeting(true); setNewTitle(''); setNewDate(new Date().toISOString().split('T')[0]); setNewType('workplan'); setNewSource('manual'); }} className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm rounded-lg transition shrink-0">
                <Plus size={14} /><span className="hidden sm:inline">New Note</span><span className="sm:hidden">New</span>
              </button>
            </div>
          </div>

          {filteredMeetings.length === 0 ? (
            <EmptyState icon={FileText} title={searchQuery ? 'No matching notes' : 'No meeting notes yet'} description={searchQuery ? 'Try a different search term' : 'Create your first meeting note — it works like a mini Google Doc!'} action={searchQuery ? undefined : { label: 'Create Note', onClick: () => setIsNewMeeting(true) }} />
          ) : (
            <div className="space-y-2">
              {filteredMeetings.map(m => {
                const plainText = m.content?.replace(/<[^>]*>/g, '').trim() || '';
                const preview = plainText.slice(0, 120) + (plainText.length > 120 ? '...' : '');
                return (
                  <div key={m.id} onClick={() => setSelectedMeeting(m)} className="bg-white rounded-lg border border-gray-200 hover:border-purple-400 p-3 sm:p-4 cursor-pointer transition group">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {meetingView === 'group' && m.brand?.name && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-purple-100 text-purple-700">{m.brand.name}</span>
                          )}
                          <span className="text-sm text-gray-900 font-medium truncate">{m.title}</span>
                          <StatusBadge status={m.meeting_type} />
                          {m.source !== 'manual' && (
                            <span className="px-1.5 py-0.5 text-[9px] rounded bg-blue-50 text-blue-600 font-medium">{m.source === 'plaud' ? '🎙️ Plaud' : m.source === 'whatsapp' ? '💬 WA' : '📄 Upload'}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] sm:text-xs text-gray-500">
                          <span>{new Date(m.meeting_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          {m.creator?.name && <span>• {m.creator.name}</span>}
                        </div>
                        {preview && <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{preview}</p>}
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); deleteMeeting(m.id); }} className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition shrink-0">
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
            <button onClick={() => { setIsNewMeeting(false); setUploadedFile(null); setRawFile(null); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition">
              <ArrowLeft size={18} />
            </button>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">New Meeting Note</h2>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 space-y-4">
            <FormField label="Title" name="title" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g. April Workplan Meeting — Korea Culture" required />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField label="Date" name="meeting_date" type="date" value={newDate} onChange={e => setNewDate(e.target.value)} required />
              <FormField label="Type" name="meeting_type" value={newType} onChange={e => setNewType(e.target.value)} options={[{ value: 'workplan', label: '📋 Workplan' }, { value: 'review', label: '🔍 Review' }, { value: 'brainstorm', label: '💡 Brainstorm' }, { value: 'adhoc', label: '⚡ Ad-hoc' }]} />
              <FormField label="Source" name="source" value={newSource} onChange={e => { setNewSource(e.target.value); setUploadedFile(null); setRawFile(null); }} options={[{ value: 'manual', label: '✍️ Type Manually' }, { value: 'plaud', label: '🎙️ Plaud Transcript' }, { value: 'whatsapp', label: '💬 WhatsApp Export' }, { value: 'transcript', label: '📄 Upload Transcript' }]} />
            </div>

            {/* File upload section for non-manual sources */}
            {newSource !== 'manual' && (
              <div className="space-y-3">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg shrink-0">
                      <Upload size={20} className="text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-purple-900">
                        {newSource === 'plaud' ? 'Upload Plaud Transcript' : newSource === 'whatsapp' ? 'Upload WhatsApp Export' : 'Upload Transcript File'}
                      </h4>
                      <p className="text-xs text-purple-700 mt-1">
                        {newSource === 'plaud' ? 'Export your Plaud transcript as .txt and upload it here. We\'ll auto-detect speakers and extract action items.' :
                         newSource === 'whatsapp' ? 'Export your WhatsApp chat (without media) and upload the .txt file.' :
                         'Upload a .txt or .pdf transcript file. Speaker labels and timestamps will be detected.'}
                      </p>
                      {!uploadedFile && (
                        <>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".txt,.pdf,.md,.doc,.docx"
                            onChange={handleFileUpload}
                            className="mt-3 text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-purple-600 file:text-white hover:file:bg-purple-700 file:cursor-pointer"
                            disabled={uploadingFile}
                          />
                          {uploadingFile && <p className="text-xs text-purple-600 mt-2 flex items-center gap-1.5"><Clock size={12} className="animate-spin" /> Reading file...</p>}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* File preview after upload */}
                {uploadedFile && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2 bg-green-100 rounded-lg shrink-0">
                          <FileText size={20} className="text-green-600" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-medium text-green-900 flex items-center gap-2">
                            ✅ File Ready
                          </h4>
                          <p className="text-xs text-green-700 mt-0.5">{uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(1)} KB)</p>
                          <p className="text-xs text-green-600 mt-1.5 line-clamp-2 font-mono bg-green-100/50 rounded px-2 py-1">
                            {uploadedFile.content.slice(0, 200)}{uploadedFile.content.length > 200 ? '...' : ''}
                          </p>
                          <p className="text-[10px] text-green-600 mt-1">{uploadedFile.content.split('\n').filter(l => l.trim()).length} lines detected</p>
                        </div>
                      </div>
                      <button onClick={() => setUploadedFile(null)} className="p-1 rounded hover:bg-green-200 text-green-600 transition shrink-0">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => { setIsNewMeeting(false); setUploadedFile(null); setRawFile(null); }} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-900 transition">Cancel</button>
              {newSource === 'manual' ? (
                <button onClick={createMeeting} disabled={!newTitle.trim()} className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm rounded-lg transition flex items-center gap-2">
                  <FileText size={14} /> Create & Start Writing
                </button>
              ) : (
                <button
                  onClick={createAndProcessMeeting}
                  disabled={!newTitle.trim() || !uploadedFile || isProcessing}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm rounded-lg transition flex items-center gap-2 relative"
                >
                  {isProcessing ? (
                    <><Clock size={14} className="animate-spin" /> Processing...</>
                  ) : (
                    <><Sparkles size={14} /> Create & Process Notes</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== MEETING EDITOR ===== */}
      {tab === 'meetings' && selectedMeeting && (
        <div className="space-y-3 animate-fade-in">
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
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {saveStatus === 'saving' && <span className="text-xs text-amber-500 flex items-center gap-1"><Clock size={12} className="animate-spin" /> Saving...</span>}
              {saveStatus === 'saved' && <span className="text-xs text-green-600 flex items-center gap-1"><Save size={12} /> Saved</span>}
              
              {/* Extract Tasks button */}
              <button onClick={handleExtractTasks} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs rounded-lg transition border border-amber-200" title="Extract action items as tasks">
                <ListTodo size={13} /><span className="hidden sm:inline">Extract Tasks</span>
              </button>

              <select value={selectedMeeting.meeting_type} onChange={e => { const val = e.target.value; setSelectedMeeting(prev => prev ? { ...prev, meeting_type: val } : prev); updateMeetingMeta(selectedMeeting.id, { meeting_type: val }); }}
                className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-purple-500">
                <option value="workplan">📋 Workplan</option>
                <option value="review">🔍 Review</option>
                <option value="brainstorm">💡 Brainstorm</option>
                <option value="adhoc">⚡ Ad-hoc</option>
              </select>
              <button onClick={() => deleteMeeting(selectedMeeting.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition">
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* Process success banner */}
          {showProcessSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-2 text-sm text-green-800">
                <Sparkles size={16} className="text-green-600 shrink-0" />
                <span>
                  <strong>Notes generated!</strong> {foundActionItems > 0 ? `${foundActionItems} action item${foundActionItems > 1 ? 's' : ''} detected.` : 'Review and edit as needed.'}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {foundActionItems > 0 && (
                  <button onClick={handleExtractTasks} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs rounded-lg transition font-medium">
                    <ListTodo size={13} /> Extract {foundActionItems} Task{foundActionItems > 1 ? 's' : ''}
                  </button>
                )}
                <button onClick={() => setShowProcessSuccess(false)} className="p-1 rounded hover:bg-green-200 text-green-600 transition">
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Reprocess button for transcript-based notes */}
          {selectedMeeting.transcript_raw && !showProcessSuccess && (
            <div className="flex items-center gap-2">
              <button
                onClick={reprocessTranscript}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs rounded-lg transition border border-purple-200"
              >
                {isProcessing ? <><Clock size={12} className="animate-spin" /> Reprocessing...</> : <><Sparkles size={12} /> Reprocess Transcript</>}
              </button>
              <span className="text-[10px] text-gray-400">Re-analyze the raw transcript to regenerate notes</span>
            </div>
          )}

          <RichTextEditor
            content={selectedMeeting.content || ''}
            onChange={(html) => handleContentChange(selectedMeeting.id, html)}
            placeholder={"Start writing your meeting notes here...\n\n💡 Tips:\n• Use headings for sections (Agenda, Decisions, Action Items)\n• Use checklists to track action items\n• Click 'Extract Tasks' to generate tasks from your notes\n• Your notes auto-save as you type"}
            autoFocus
          />

          {selectedMeeting.transcript_raw && (
            <details className="bg-gray-50 rounded-lg border border-gray-200 p-3 sm:p-4">
              <summary className="text-xs sm:text-sm text-gray-600 cursor-pointer hover:text-gray-900 font-medium">📝 Raw Transcript</summary>
              <pre className="mt-3 text-xs text-gray-600 whitespace-pre-wrap bg-gray-100 rounded p-3 max-h-48 overflow-y-auto">{selectedMeeting.transcript_raw}</pre>
            </details>
          )}
        </div>
      )}

      {/* ===== TASKS TAB ===== */}
      {tab === 'tasks' && (
        <div className="space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Task Board</h2>
              {/* View mode toggle */}
              <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs">
                <button onClick={() => setTaskViewMode('table')} className={`px-2.5 py-1 rounded-md transition ${taskViewMode === 'table' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-900'}`}>
                  Table
                </button>
                <button onClick={() => setTaskViewMode('kanban')} className={`px-2.5 py-1 rounded-md transition ${taskViewMode === 'kanban' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-900'}`}>
                  Kanban
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Filter */}
              {taskViewMode === 'table' && (
                <select value={taskFilter} onChange={e => setTaskFilter(e.target.value)} className="text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-purple-500">
                  <option value="active">Active Tasks</option>
                  <option value="all">All Tasks</option>
                  {taskStatuses.map(s => <option key={s} value={s}>{STATUS_CONFIG[s]?.icon} {STATUS_CONFIG[s]?.label || s}</option>)}
                </select>
              )}
              <button onClick={() => { resetTaskForm(); setEditTask(null); setShowTaskModal(true); }} className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm rounded-lg transition shrink-0">
                <Plus size={14} /><span className="hidden sm:inline">New Task</span><span className="sm:hidden">New</span>
              </button>
            </div>
          </div>

          {/* TABLE VIEW (default, mobile-friendly) */}
          {taskViewMode === 'table' && (
            filteredTasks.length === 0 ? (
              <EmptyState icon={CheckSquare} title="No tasks yet" description="Create tasks manually or extract them from meeting notes." action={{ label: 'Create Task', onClick: () => { resetTaskForm(); setEditTask(null); setShowTaskModal(true); } }} />
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden sm:block bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-8">Status</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Task</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Priority</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">Assignee</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Due Date</th>
                        <th className="w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredTasks.map(task => {
                        const sc = STATUS_CONFIG[task.status] || STATUS_CONFIG.backlog;
                        const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
                        return (
                          <tr key={task.id} className="hover:bg-gray-50 transition group cursor-pointer"
                              onClick={() => { setEditTask(task); setTaskForm({ title: task.title, description: task.description || '', status: task.status, priority: task.priority, due_date: task.due_date || '', assigned_to: task.assigned_to || '' }); setShowTaskModal(true); }}>
                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                              <select value={task.status} onChange={e => quickUpdateTask(task.id, { status: e.target.value })}
                                className={`text-xs font-medium rounded-md px-1.5 py-1 border-0 cursor-pointer ${sc.bg} ${sc.color} focus:ring-1 focus:ring-purple-500`}>
                                {taskStatuses.map(s => <option key={s} value={s}>{STATUS_CONFIG[s]?.icon} {STATUS_CONFIG[s]?.label}</option>)}
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">{task.title}</div>
                              {task.description && <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{task.description}</div>}
                            </td>
                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                              <select value={task.priority} onChange={e => quickUpdateTask(task.id, { priority: e.target.value })}
                                className="text-xs font-medium bg-transparent border-0 cursor-pointer focus:ring-1 focus:ring-purple-500 rounded-md p-1">
                                <option value="urgent">🔴 Urgent</option>
                                <option value="high">🟠 High</option>
                                <option value="medium">🟡 Medium</option>
                                <option value="low">⚪ Low</option>
                              </select>
                            </td>
                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                              <select value={task.assigned_to || ''} onChange={e => quickUpdateTask(task.id, { assigned_to: e.target.value || null })}
                                className="text-xs font-medium bg-transparent border-0 cursor-pointer focus:ring-1 focus:ring-purple-500 rounded-md p-1 text-gray-600 w-full max-w-[140px]">
                                <option value="">— Unassigned</option>
                                {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                              </select>
                            </td>
                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                              <input
                                type="date"
                                value={task.due_date || ''}
                                onChange={e => quickUpdateTask(task.id, { due_date: e.target.value || null })}
                                className={`text-xs border-0 bg-transparent cursor-pointer focus:ring-1 focus:ring-purple-500 rounded-md p-1 ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-600'}`}
                              />
                            </td>
                            <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                              <button onClick={() => deleteTask(task.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 transition">
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile card list */}
                <div className="sm:hidden space-y-2">
                  {filteredTasks.map(task => {
                    const sc = STATUS_CONFIG[task.status] || STATUS_CONFIG.backlog;
                    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
                    return (
                      <div key={task.id} className="bg-white rounded-lg border border-gray-200 p-3 active:bg-gray-50 transition"
                           onClick={() => { setEditTask(task); setTaskForm({ title: task.title, description: task.description || '', status: task.status, priority: task.priority, due_date: task.due_date || '', assigned_to: task.assigned_to || '' }); setShowTaskModal(true); }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${sc.bg} ${sc.color}`}>{sc.icon} {sc.label}</span>
                              <PriorityBadge priority={task.priority} />
                            </div>
                            <div className="text-sm font-medium text-gray-900">{task.title}</div>
                            {task.description && <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{task.description}</div>}
                            <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500">
                              <span onClick={e => e.stopPropagation()} className="flex items-center">
                              <select value={task.assigned_to || ''} onChange={e => { e.stopPropagation(); quickUpdateTask(task.id, { assigned_to: e.target.value || null }); }}
                                className="text-[10px] bg-transparent border-0 cursor-pointer focus:ring-1 focus:ring-purple-500 rounded p-0 text-gray-500">
                                <option value="">👤 Unassigned</option>
                                {teamMembers.map(m => <option key={m.id} value={m.id}>👤 {m.name}</option>)}
                              </select>
                            </span>
                              {task.due_date && <span className={isOverdue ? 'text-red-500 font-medium' : ''}>{isOverdue ? '⚠️ ' : '📅 '}{new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                            </div>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }} className="p-1 text-gray-400 hover:text-red-500 transition shrink-0">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )
          )}

          {/* KANBAN VIEW */}
          {taskViewMode === 'kanban' && (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-5">
              {taskStatuses.map(status => {
                const sc = STATUS_CONFIG[status];
                return (
                  <div key={status} className="bg-gray-50 rounded-lg p-3 min-h-[200px] min-w-[220px] sm:min-w-0 flex-shrink-0 sm:flex-shrink">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase">{sc?.icon} {sc?.label || status}</span>
                      <span className="text-[10px] sm:text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded-full">{tasksByStatus[status]?.length || 0}</span>
                    </div>
                    <div className="space-y-2">
                      {(tasksByStatus[status] || []).map(task => (
                        <div key={task.id} className="bg-white rounded-lg p-2.5 sm:p-3 border border-gray-200 hover:border-purple-300 transition cursor-pointer group"
                             onClick={() => { setEditTask(task); setTaskForm({ title: task.title, description: task.description || '', status: task.status, priority: task.priority, due_date: task.due_date || '', assigned_to: task.assigned_to || '' }); setShowTaskModal(true); }}>
                          <div className="flex items-start justify-between">
                            <span className="text-xs sm:text-sm text-gray-900 font-medium leading-tight">{task.title}</span>
                            <button onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 text-gray-400 transition"><Trash2 size={12} /></button>
                          </div>
                          {task.description && <p className="text-[10px] sm:text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>}
                          <div className="flex items-center gap-1.5 sm:gap-2 mt-2 flex-wrap">
                            <PriorityBadge priority={task.priority} />
                            {task.due_date && <span className="text-[10px] sm:text-xs text-gray-500">{new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                            <span onClick={e => e.stopPropagation()}>
                              <select value={task.assigned_to || ''} onChange={e => { e.stopPropagation(); quickUpdateTask(task.id, { assigned_to: e.target.value || null }); }}
                                className="text-[10px] sm:text-xs bg-transparent border-0 cursor-pointer focus:ring-1 focus:ring-purple-500 rounded p-0 text-gray-500 max-w-[100px]">
                                <option value="">→ Unassigned</option>
                                {teamMembers.map(m => <option key={m.id} value={m.id}>→ {m.name}</option>)}
                              </select>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CADENCE TAB */}

      {/* Task Modal */}
      <Modal open={showTaskModal} onClose={() => { setShowTaskModal(false); setEditTask(null); }} title={editTask ? 'Edit Task' : 'New Task'} size="lg">
        <div className="space-y-4">
          <FormField label="Task Title" name="title" value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Design April IG carousel" required />
          <FormField label="Description" name="description" type="textarea" value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} placeholder="Detailed task brief, requirements, reference links..." rows={3} />
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Priority" name="priority" value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))} options={[{ value: 'urgent', label: '🔴 Urgent' }, { value: 'high', label: '🟠 High' }, { value: 'medium', label: '🟡 Medium' }, { value: 'low', label: '⚪ Low' }]} />
            <FormField label="Status" name="status" value={taskForm.status} onChange={e => setTaskForm(f => ({ ...f, status: e.target.value }))} options={[{ value: 'backlog', label: '📋 Backlog' }, { value: 'todo', label: '📌 To Do' }, { value: 'in_progress', label: '🔄 In Progress' }, { value: 'review', label: '👀 Review' }, { value: 'done', label: '✅ Done' }]} />
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

      {/* Extract Tasks Modal */}
      <Modal open={showExtractModal} onClose={() => setShowExtractModal(false)} title="Extract Tasks from Meeting Notes" size="lg">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Found {extractedTasks.length} potential action items. Select which ones to create as tasks:</p>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {extractedTasks.map((t, i) => (
              <label key={i} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${t.selected ? 'bg-purple-50 border-purple-300' : 'bg-gray-50 border-gray-200'}`}>
                <input type="checkbox" checked={t.selected} onChange={() => setExtractedTasks(prev => prev.map((x, j) => j === i ? { ...x, selected: !x.selected } : x))}
                  className="mt-0.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                <span className="text-sm text-gray-900">{t.title}</span>
              </label>
            ))}
          </div>
          {extractedTasks.length === 0 && (
            <div className="text-center py-6">
              <p className="text-sm text-gray-500">No action items found. Try using checklist items or phrases like &quot;Follow up&quot;, &quot;Send&quot;, &quot;Prepare&quot; in your notes.</p>
            </div>
          )}
          <div className="flex items-center justify-between pt-2">
            <button onClick={() => { setExtractedTasks(prev => prev.map(t => ({ ...t, selected: !prev.every(x => x.selected) }))); }} className="text-xs text-purple-600 hover:text-purple-800 transition">
              {extractedTasks.every(t => t.selected) ? 'Deselect All' : 'Select All'}
            </button>
            <div className="flex gap-3">
              <button onClick={() => setShowExtractModal(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-900">Cancel</button>
              <button onClick={createExtractedTasks} disabled={!extractedTasks.some(t => t.selected)} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm rounded-lg transition flex items-center gap-2">
                <ListTodo size={14} /> Create {extractedTasks.filter(t => t.selected).length} Tasks
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
