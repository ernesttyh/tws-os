'use client';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import { Settings, UserPlus, Shield, Users } from 'lucide-react';

interface TeamMember { id: string; name: string; email: string; role: string; is_active: boolean; created_at: string }
interface BrandAssignment { id: string; brand_id: string; team_member_id: string; role: string; module_permissions: Record<string, string> }

const ROLES = [{ value: 'admin', label: 'Admin (Master)' }, { value: 'manager', label: 'Account Manager' }, { value: 'designer', label: 'Designer' }, { value: 'copywriter', label: 'Copywriter' }, { value: 'videographer', label: 'Videographer' }, { value: 'intern', label: 'Intern' }, { value: 'custom', label: 'Custom' }];

export default function SettingsPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [assignments, setAssignments] = useState<BrandAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  const supabase = createBrowserClient();

  useEffect(() => {
    async function load() {
      const [m, b, a] = await Promise.all([
        supabase.from('team_members').select('*').order('name'),
        supabase.from('brands').select('id,name').eq('status', 'active').order('name'),
        supabase.from('brand_assignments').select('*'),
      ]);
      setMembers(m.data || []);
      setBrands(b.data || []);
      setAssignments(a.data || []);
      setLoading(false);
    }
    load();
  }, [supabase]);

  const [memberForm, setMemberForm] = useState({ name: '', email: '', role: 'manager' });
  const resetMemberForm = () => setMemberForm({ name: '', email: '', role: 'manager' });

  const saveMember = async () => {
    await supabase.from('team_members').insert(memberForm);
    const { data } = await supabase.from('team_members').select('*').order('name');
    setMembers(data || []);
    setShowMemberModal(false);
    resetMemberForm();
  };

  const [assignForm, setAssignForm] = useState({ brand_id: '', role: '' });

  const saveAssignment = async () => {
    if (!selectedMember) return;
    await supabase.from('brand_assignments').insert({ team_member_id: selectedMember.id, brand_id: assignForm.brand_id, role: assignForm.role || 'Account Manager' });
    const { data } = await supabase.from('brand_assignments').select('*');
    setAssignments(data || []);
    setShowAssignModal(false);
  };

  const getMemberBrands = (memberId: string) => {
    const memberAssigns = assignments.filter(a => a.team_member_id === memberId);
    return memberAssigns.map(a => brands.find(b => b.id === a.brand_id)?.name).filter(Boolean);
  };

  if (loading) return <div className="p-6"><div className="animate-pulse"><div className="h-64 bg-white/5 rounded" /></div></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-white flex items-center gap-2"><Settings size={24} />Settings & Admin</h1></div>
      </div>

      {/* Team Members */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Users size={18} />Team Members</h2>
          <button onClick={() => { resetMemberForm(); setShowMemberModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg"><UserPlus size={16} />Add Member</button>
        </div>
        <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/10">
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400">Name</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400">Email</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400">Role</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400">Brands</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400">Actions</th>
            </tr></thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id} className="border-b border-white/5 hover:bg-white/5 transition">
                  <td className="py-3 px-4 text-white font-medium">{m.name}</td>
                  <td className="py-3 px-4 text-gray-400">{m.email}</td>
                  <td className="py-3 px-4"><span className="px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-400 capitalize">{m.role}</span></td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1 flex-wrap">
                      {getMemberBrands(m.id).map((b, i) => <span key={i} className="px-2 py-0.5 rounded text-xs bg-white/5 text-gray-300">{b}</span>)}
                      {getMemberBrands(m.id).length === 0 && <span className="text-xs text-gray-500">None assigned</span>}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <button onClick={() => { setSelectedMember(m); setAssignForm({ brand_id: '', role: '' }); setShowAssignModal(true); }} className="text-xs text-purple-400 hover:text-purple-300">Assign Brand</button>
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-gray-500">No team members yet. Add your first team member.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Member Modal */}
      <Modal open={showMemberModal} onClose={() => setShowMemberModal(false)} title="Add Team Member" size="md">
        <div className="space-y-4">
          <FormField label="Name" name="name" value={memberForm.name} onChange={e => setMemberForm(f => ({ ...f, name: e.target.value }))} required />
          <FormField label="Email" name="email" type="email" value={memberForm.email} onChange={e => setMemberForm(f => ({ ...f, email: e.target.value }))} required />
          <FormField label="Role" name="role" value={memberForm.role} onChange={e => setMemberForm(f => ({ ...f, role: e.target.value }))} options={ROLES} />
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowMemberModal(false)} className="px-4 py-2 text-sm text-gray-400">Cancel</button>
            <button onClick={saveMember} disabled={!memberForm.name || !memberForm.email} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm rounded-lg">Add Member</button>
          </div>
        </div>
      </Modal>

      {/* Assign Brand Modal */}
      <Modal open={showAssignModal} onClose={() => setShowAssignModal(false)} title={`Assign Brand to ${selectedMember?.name}`} size="md">
        <div className="space-y-4">
          <FormField label="Brand" name="brand_id" value={assignForm.brand_id} onChange={e => setAssignForm(f => ({ ...f, brand_id: e.target.value }))} options={brands.map(b => ({ value: b.id, label: b.name }))} required />
          <FormField label="Role for this brand" name="role" value={assignForm.role} onChange={e => setAssignForm(f => ({ ...f, role: e.target.value }))} placeholder="e.g. Account Manager" />
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowAssignModal(false)} className="px-4 py-2 text-sm text-gray-400">Cancel</button>
            <button onClick={saveAssignment} disabled={!assignForm.brand_id} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm rounded-lg">Assign</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
