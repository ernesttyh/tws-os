'use client';
import { useState, useEffect, useCallback, use } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { Palette, Plus, Edit2, ExternalLink, Trash2 } from 'lucide-react';

interface DesignBrief { id: string; title: string; description: string | null; dimensions: string | null; status: string; deadline: string | null; revision_count: number; revision_notes: string | null; drive_folder_url: string | null; final_artwork_url: string | null; assignee?: { id: string; name: string } | null; creator?: { id: string; name: string } | null }

const DESIGN_STATUSES = [{ value: 'brief', label: 'Brief' }, { value: 'in_progress', label: 'In Progress' }, { value: 'internal_review', label: 'Internal Review' }, { value: 'client_review', label: 'Client Review' }, { value: 'revision', label: 'Revision' }, { value: 'approved', label: 'Approved' }];

export default function DesignPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [briefs, setBriefs] = useState<DesignBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editBrief, setEditBrief] = useState<DesignBrief | null>(null);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([]);

  const supabase = createBrowserClient();
  const loadBrand = useCallback(async () => { const { data } = await supabase.from('brands').select('id').eq('slug', slug).single(); if (data) { setBrandId(data.id); return data.id; } return null; }, [slug, supabase]);
  const loadData = useCallback(async (bid: string) => { setLoading(true); const [bRes, tRes] = await Promise.all([fetch(`/api/brands/${bid}/design`), fetch('/api/team')]); if (bRes.ok) setBriefs(await bRes.json()); if (tRes.ok) setTeamMembers(await tRes.json()); setLoading(false); }, []);
  useEffect(() => { loadBrand().then(bid => { if (bid) loadData(bid); }); }, [loadBrand, loadData]);

  const [form, setForm] = useState({ title: '', description: '', dimensions: '', status: 'brief', deadline: '', assigned_to: '', drive_folder_url: '', revision_notes: '' });
  const resetForm = () => setForm({ title: '', description: '', dimensions: '', status: 'brief', deadline: '', assigned_to: '', drive_folder_url: '', revision_notes: '' });

  const save = async () => {
    if (!brandId) return;
    const payload = { ...form, assigned_to: form.assigned_to || null, deadline: form.deadline || null, description: form.description || null, dimensions: form.dimensions || null, drive_folder_url: form.drive_folder_url || null, revision_notes: form.revision_notes || null };
    if (editBrief) {
      await fetch(`/api/brands/${brandId}/design/${editBrief.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } else {
      await fetch(`/api/brands/${brandId}/design`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
    setShowModal(false); setEditBrief(null); resetForm(); loadData(brandId);
  };

  const deleteBrief = async (id: string) => { if (!brandId || !confirm('Delete this brief?')) return; await fetch(`/api/brands/${brandId}/design/${id}`, { method: 'DELETE' }); loadData(brandId); };

  // Group by status for pipeline view
  const pipeline = DESIGN_STATUSES.map(s => ({ ...s, items: briefs.filter(b => b.status === s.value) }));

  if (loading) return <div className="p-6"><div className="animate-pulse"><div className="h-64 bg-white/5 rounded" /></div></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Design Pipeline</h2>
          <p className="text-sm text-gray-400">{briefs.length} briefs · {briefs.filter(b => b.status === 'approved').length} approved</p>
        </div>
        <button onClick={() => { resetForm(); setEditBrief(null); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg"><Plus size={16} />New Brief</button>
      </div>

      {briefs.length === 0 ? (
        <EmptyState icon={Palette} title="No design briefs" description="Create design briefs for your designers" action={{ label: 'Create Brief', onClick: () => { resetForm(); setShowModal(true); } }} />
      ) : (
        <div className="grid grid-cols-6 gap-3">
          {pipeline.map(stage => (
            <div key={stage.value} className="bg-white/5 rounded-lg p-3 min-h-[200px]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-400 uppercase">{stage.label}</span>
                <span className="text-xs text-gray-500">{stage.items.length}</span>
              </div>
              <div className="space-y-2">
                {stage.items.map(b => (
                  <div key={b.id} className="bg-[#1a1a2e] rounded-lg p-3 border border-white/5 hover:border-white/20 transition cursor-pointer group"
                       onClick={() => { setEditBrief(b); setForm({ title: b.title, description: b.description || '', dimensions: b.dimensions || '', status: b.status, deadline: b.deadline || '', assigned_to: b.assignee?.id || '', drive_folder_url: b.drive_folder_url || '', revision_notes: b.revision_notes || '' }); setShowModal(true); }}>
                    <div className="flex items-start justify-between">
                      <span className="text-sm text-white font-medium leading-tight">{b.title}</span>
                      <button onClick={e => { e.stopPropagation(); deleteBrief(b.id); }} className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-500 hover:text-red-400"><Trash2 size={12} /></button>
                    </div>
                    {b.dimensions && <p className="text-xs text-gray-500 mt-1">📐 {b.dimensions}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      {b.assignee && <span className="text-xs text-gray-400">→ {b.assignee.name}</span>}
                      {b.deadline && <span className="text-xs text-gray-500">{new Date(b.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                    </div>
                    {b.revision_count > 0 && <span className="text-xs text-orange-400 mt-1">Rev {b.revision_count}</span>}
                    {b.drive_folder_url && (
                      <a href={b.drive_folder_url} target="_blank" rel="noopener" onClick={e => e.stopPropagation()} className="flex items-center gap-1 text-xs text-purple-400 mt-1 hover:text-purple-300"><ExternalLink size={10} />Drive</a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => { setShowModal(false); setEditBrief(null); }} title={editBrief ? 'Edit Brief' : 'New Design Brief'} size="lg">
        <div className="space-y-4">
          <FormField label="Title" name="title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="e.g. April Promo Banner" />
          <FormField label="Description" name="description" type="textarea" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Design requirements, references, copy text..." rows={4} />
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Dimensions" name="dimensions" value={form.dimensions} onChange={e => setForm(f => ({ ...f, dimensions: e.target.value }))} placeholder="1080x1080" />
            <FormField label="Status" name="status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} options={DESIGN_STATUSES} />
            <FormField label="Deadline" name="deadline" type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Assign To" name="assigned_to" value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} options={teamMembers.map(m => ({ value: m.id, label: m.name }))} />
            <FormField label="Google Drive Folder" name="drive_folder_url" value={form.drive_folder_url} onChange={e => setForm(f => ({ ...f, drive_folder_url: e.target.value }))} placeholder="https://drive.google.com/..." />
          </div>
          {editBrief && <FormField label="Revision Notes" name="revision_notes" type="textarea" value={form.revision_notes} onChange={e => setForm(f => ({ ...f, revision_notes: e.target.value }))} rows={2} />}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setShowModal(false); setEditBrief(null); }} className="px-4 py-2 text-sm text-gray-400">Cancel</button>
            <button onClick={save} disabled={!form.title} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm rounded-lg">{editBrief ? 'Update' : 'Create'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
