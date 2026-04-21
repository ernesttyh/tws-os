'use client';
import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import StatusBadge from '@/components/ui/StatusBadge';
import { Settings, UserPlus, Shield, Users, Trash2, Edit2 } from 'lucide-react';

interface TeamMember { id: string; name: string; email: string; role: string; auth_user_id: string | null; created_at: string }

const ROLES = [
  { value: 'master_admin', label: '👑 Master Admin' },
  { value: 'admin', label: '🔧 Admin' },
  { value: 'account_manager', label: '📊 Account Manager' },
  { value: 'designer', label: '🎨 Designer' },
  { value: 'videographer', label: '🎬 Videographer' },
  { value: 'intern', label: '📝 Intern' },
];

export default function SettingsPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null);

  const supabase = createBrowserClient();

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUser({ id: user.id, email: user.email || '' });
    const res = await fetch('/api/team');
    if (res.ok) setMembers(await res.json());
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

  const currentMember = members.find(m => m.auth_user_id === currentUser?.id);

  if (loading) return <div className="p-4 sm:p-6"><div className="animate-pulse space-y-4"><div className="h-20 bg-gray-50 rounded" /><div className="h-64 bg-gray-50 rounded" /></div></div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2 sm:gap-3">
        <Settings className="text-purple-400 shrink-0" size={20} />
        <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Settings & Admin</h1>
      </div>

      {/* Current user */}
      {currentMember && (
        <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-xl p-3 sm:p-4 border border-gray-200">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm sm:text-lg font-bold shrink-0">{currentMember.name.charAt(0)}</div>
            <div className="min-w-0">
              <h2 className="text-gray-900 font-semibold text-sm sm:text-base truncate">{currentMember.name}</h2>
              <p className="text-gray-500 text-xs sm:text-sm truncate">{currentMember.email}</p>
              <StatusBadge status={currentMember.role} />
            </div>
          </div>
        </div>
      )}

      {/* Team Members */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Users size={16} className="text-gray-500 shrink-0" />
          <h2 className="text-sm sm:text-lg font-semibold text-gray-900">Team Members</h2>
          <span className="text-xs sm:text-sm text-gray-500">({members.length})</span>
        </div>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm rounded-lg shrink-0"><UserPlus size={14} /><span className="hidden sm:inline">Add Member</span><span className="sm:hidden">Add</span></button>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Name</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Email</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Role</th>
            <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Auth</th>
            <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">Actions</th>
          </tr></thead>
          <tbody>
            {members.map(m => (
              <tr key={m.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="py-3 px-4 font-medium text-gray-900">{m.name}</td>
                <td className="py-3 px-4 text-gray-600">{m.email}</td>
                <td className="py-3 px-4"><StatusBadge status={m.role} /></td>
                <td className="py-3 px-4">{m.auth_user_id ? <span className="text-green-400 text-xs">✓ Active</span> : <span className="text-gray-500 text-xs">Pending</span>}</td>
                <td className="py-3 px-4 text-right">
                  <button onClick={() => deleteMember(m.id)} disabled={m.auth_user_id === currentUser?.id} className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card view */}
      <div className="sm:hidden space-y-2">
        {members.map(m => (
          <div key={m.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-purple-600/30 flex items-center justify-center text-purple-300 text-xs font-bold shrink-0">{m.name.charAt(0)}</div>
                <div className="min-w-0">
                  <div className="text-gray-900 text-sm font-medium truncate">{m.name}</div>
                  <div className="text-gray-500 text-[10px] truncate">{m.email}</div>
                </div>
              </div>
              <button onClick={() => deleteMember(m.id)} disabled={m.auth_user_id === currentUser?.id} className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-red-400 disabled:opacity-30 shrink-0"><Trash2 size={14} /></button>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <StatusBadge status={m.role} />
              {m.auth_user_id ? <span className="text-green-400 text-[10px]">✓ Active</span> : <span className="text-gray-500 text-[10px]">Pending</span>}
            </div>
          </div>
        ))}
      </div>

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
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
            <button onClick={createMember} disabled={!form.name || !form.email} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm rounded-lg">Add Member</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
