'use client';
import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import StatusBadge from '@/components/ui/StatusBadge';
import { Settings, UserPlus, Shield, Users, Trash2, Edit2, Link2, CheckSquare } from 'lucide-react';

interface TeamMember { id: string; name: string; email: string; role: string; auth_user_id: string | null; created_at: string }
interface Brand { id: string; name: string; slug: string; brand_group: string; status: string }
interface BrandAssignment { id: string; brand_id: string; team_member_id: string; brand?: Brand | null; team_member?: TeamMember | null }

const ROLES = [
  { value: 'master_admin', label: '👑 Master Admin' },
  { value: 'admin', label: '🔧 Admin' },
  { value: 'account_manager', label: '📊 Account Manager' },
  { value: 'designer', label: '🎨 Designer' },
  { value: 'videographer', label: '🎬 Videographer' },
  { value: 'intern', label: '📝 Intern' },
];

const BRAND_GROUPS = ['neo_group', 'penang_culture'];

export default function SettingsPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null);
  const [settingsTab, setSettingsTab] = useState<'members' | 'assignments'>('members');

  // Brand Assignments state
  const [allBrands, setAllBrands] = useState<Brand[]>([]);
  const [assignments, setAssignments] = useState<BrandAssignment[]>([]);
  const [selectedMember, setSelectedMember] = useState<string>('');
  const [assignmentLoading, setAssignmentLoading] = useState(false);

  const supabase = createBrowserClient();

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUser({ id: user.id, email: user.email || '' });
    const res = await fetch('/api/team');
    if (res.ok) setMembers(await res.json());

    // Load brands
    const { data: brandList } = await supabase.from('brands').select('id, name, slug, brand_group, status').eq('status', 'active').order('name');
    if (brandList) setAllBrands(brandList);

    // Load all assignments
    const assignRes = await fetch('/api/brand-assignments');
    if (assignRes.ok) setAssignments(await assignRes.json());

    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  const [form, setForm] = useState({ name: '', email: '', role: 'account_manager', password: '' });
  const resetForm = () => setForm({ name: '', email: '', role: 'account_manager', password: '' });

  const createMember = async () => {
    await fetch('/api/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setShowModal(false); resetForm(); loadData();
  };

  const deleteMember = async (id: string) => {
    if (!confirm('Remove this team member?')) return;
    await fetch(`/api/team/${id}`, { method: 'DELETE' });
    loadData();
  };

  // Brand assignment helpers
  const memberAssignments = assignments.filter(a => a.team_member_id === selectedMember);
  const assignedBrandIds = new Set(memberAssignments.map(a => a.brand_id));

  const toggleBrandAssignment = async (brandId: string) => {
    setAssignmentLoading(true);
    if (assignedBrandIds.has(brandId)) {
      // Remove assignment
      const assignment = memberAssignments.find(a => a.brand_id === brandId);
      if (assignment) {
        await fetch(`/api/brand-assignments?id=${assignment.id}`, { method: 'DELETE' });
      }
    } else {
      // Add assignment
      await fetch('/api/brand-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: brandId, team_member_id: selectedMember }),
      });
    }
    // Reload assignments
    const assignRes = await fetch('/api/brand-assignments');
    if (assignRes.ok) setAssignments(await assignRes.json());
    setAssignmentLoading(false);
  };

  const getAssignmentCount = (memberId: string) => assignments.filter(a => a.team_member_id === memberId).length;

  const groupedBrands = {
    'Neo Group': allBrands.filter(b => b.brand_group === 'neo_group'),
    'Penang Culture': allBrands.filter(b => b.brand_group === 'penang_culture'),
    'Other': allBrands.filter(b => !BRAND_GROUPS.includes(b.brand_group)),
  };

  const currentMember = members.find(m => m.auth_user_id === currentUser?.id);

  if (loading) return <div className="p-4 sm:p-6"><div className="animate-pulse space-y-4"><div className="h-20 bg-white/5 rounded" /><div className="h-64 bg-white/5 rounded" /></div></div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2 sm:gap-3">
        <Settings className="text-purple-400 shrink-0" size={20} />
        <h1 className="text-lg sm:text-2xl font-bold text-white">Settings & Admin</h1>
      </div>

      {/* Current user */}
      {currentMember && (
        <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-xl p-3 sm:p-4 border border-white/10">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm sm:text-lg font-bold shrink-0">{currentMember.name.charAt(0)}</div>
            <div className="min-w-0">
              <h2 className="text-white font-semibold text-sm sm:text-base truncate">{currentMember.name}</h2>
              <p className="text-gray-400 text-xs sm:text-sm truncate">{currentMember.email}</p>
              <StatusBadge status={currentMember.role} />
            </div>
          </div>
        </div>
      )}

      {/* Sub-navigation tabs */}
      <div className="flex gap-1 bg-white/5 rounded-lg p-1 w-fit">
        <button onClick={() => setSettingsTab('members')} className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition ${settingsTab === 'members' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
          <Users size={14} className="shrink-0" />
          <span>Team Members</span>
          <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-white/10">{members.length}</span>
        </button>
        <button onClick={() => setSettingsTab('assignments')} className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition ${settingsTab === 'assignments' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
          <Link2 size={14} className="shrink-0" />
          <span>Brand Assignments</span>
          <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-white/10">{assignments.length}</span>
        </button>
      </div>

      {/* TEAM MEMBERS TAB */}
      {settingsTab === 'members' && (
        <>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Users size={16} className="text-gray-400 shrink-0" />
              <h2 className="text-sm sm:text-lg font-semibold text-white">Team Members</h2>
              <span className="text-xs sm:text-sm text-gray-400">({members.length})</span>
            </div>
            <button onClick={() => { resetForm(); setShowModal(true); }} className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm rounded-lg shrink-0"><UserPlus size={14} /><span className="hidden sm:inline">Add Member</span><span className="sm:hidden">Add</span></button>
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block bg-white/5 rounded-lg border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/10">
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-400">Name</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-400">Email</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-400">Role</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-400">Brands</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-400">Auth</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-gray-400">Actions</th>
              </tr></thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 px-4 font-medium text-white">{m.name}</td>
                    <td className="py-3 px-4 text-gray-300">{m.email}</td>
                    <td className="py-3 px-4"><StatusBadge status={m.role} /></td>
                    <td className="py-3 px-4"><span className="text-xs text-gray-400">{getAssignmentCount(m.id)} brands</span></td>
                    <td className="py-3 px-4">{m.auth_user_id ? <span className="text-green-400 text-xs">✓ Active</span> : <span className="text-gray-500 text-xs">Pending</span>}</td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => deleteMember(m.id)} disabled={m.auth_user_id === currentUser?.id} className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card view */}
          <div className="sm:hidden space-y-2">
            {members.map(m => (
              <div key={m.id} className="bg-white/5 rounded-lg p-3 border border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-purple-600/30 flex items-center justify-center text-purple-300 text-xs font-bold shrink-0">{m.name.charAt(0)}</div>
                    <div className="min-w-0">
                      <div className="text-white text-sm font-medium truncate">{m.name}</div>
                      <div className="text-gray-400 text-[10px] truncate">{m.email}</div>
                    </div>
                  </div>
                  <button onClick={() => deleteMember(m.id)} disabled={m.auth_user_id === currentUser?.id} className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-red-400 disabled:opacity-30 shrink-0"><Trash2 size={14} /></button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <StatusBadge status={m.role} />
                  <span className="text-[10px] text-gray-500">{getAssignmentCount(m.id)} brands</span>
                  {m.auth_user_id ? <span className="text-green-400 text-[10px]">✓ Active</span> : <span className="text-gray-500 text-[10px]">Pending</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* BRAND ASSIGNMENTS TAB */}
      {settingsTab === 'assignments' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Link2 size={16} className="text-gray-400 shrink-0" />
            <h2 className="text-sm sm:text-lg font-semibold text-white">Brand Assignments</h2>
          </div>

          {/* Team member selector */}
          <div className="bg-white/5 rounded-lg p-3 sm:p-4 border border-white/10">
            <label className="block text-xs sm:text-sm text-gray-400 mb-2">Select Team Member</label>
            <select
              value={selectedMember}
              onChange={(e) => setSelectedMember(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
            >
              <option value="" className="bg-[#1a1a2e]">Choose a team member...</option>
              {members.map(m => (
                <option key={m.id} value={m.id} className="bg-[#1a1a2e]">
                  {m.name} ({m.role.replace('_', ' ')}) — {getAssignmentCount(m.id)} brands
                </option>
              ))}
            </select>
          </div>

          {/* Brand assignment grid */}
          {selectedMember ? (
            <div className="space-y-4">
              {Object.entries(groupedBrands).map(([group, groupBrands]) => {
                if (groupBrands.length === 0) return null;
                const assignedInGroup = groupBrands.filter(b => assignedBrandIds.has(b.id)).length;
                return (
                  <div key={group} className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
                    <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-white/10">
                      <h3 className="text-sm font-medium text-white">{group}</h3>
                      <span className="text-xs text-gray-400">{assignedInGroup}/{groupBrands.length} assigned</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0">
                      {groupBrands.map(brand => (
                        <button
                          key={brand.id}
                          onClick={() => toggleBrandAssignment(brand.id)}
                          disabled={assignmentLoading}
                          className={`flex items-center gap-3 px-3 sm:px-4 py-3 text-left transition border-b border-r border-white/5 hover:bg-white/5 disabled:opacity-50 ${assignedBrandIds.has(brand.id) ? 'bg-purple-500/10' : ''}`}
                        >
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition ${assignedBrandIds.has(brand.id) ? 'bg-purple-600 border-purple-600' : 'border-white/20'}`}>
                            {assignedBrandIds.has(brand.id) && <CheckSquare size={12} className="text-white" />}
                          </div>
                          <div className="min-w-0">
                            <div className="text-white text-sm font-medium truncate">{brand.name}</div>
                            <div className="text-gray-500 text-[10px] capitalize">{brand.brand_group?.replace('_', ' ')}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users size={32} className="text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Select a team member above to manage their brand assignments</p>
            </div>
          )}
        </div>
      )}

      {/* Add Member Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Team Member" size="md">
        <div className="space-y-4">
          <FormField label="Full Name" name="name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <FormField label="Email" name="email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          <FormField label="Role" name="role" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} options={ROLES} />
          <FormField label="Temporary Password" name="password" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 8 characters" />
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
            <p className="text-xs text-blue-400">This creates a team member record. An auth account will be provisioned separately.</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-400">Cancel</button>
            <button onClick={createMember} disabled={!form.name || !form.email} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm rounded-lg">Add Member</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
