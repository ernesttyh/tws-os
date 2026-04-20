'use client';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import StatusBadge from '@/components/ui/StatusBadge';
import PriorityBadge from '@/components/ui/PriorityBadge';
import EmptyState from '@/components/ui/EmptyState';
import { Palette, Clock, CheckCircle, AlertTriangle } from 'lucide-react';

interface DesignBrief {
  id: string;
  brand_id: string;
  title: string;
  status: string;
  assigned_to: string | null;
  due_date: string | null;
  description: string | null;
  priority: string;
  brand?: { name: string; slug: string } | null;
}

const KANBAN_COLUMNS = [
  { key: 'brief', label: 'BRIEF' },
  { key: 'in_progress', label: 'IN PROGRESS' },
  { key: 'internal_review', label: 'INTERNAL REVIEW' },
  { key: 'client_review', label: 'CLIENT REVIEW' },
  { key: 'revision', label: 'REVISION' },
  { key: 'approved', label: 'APPROVED' },
];

export default function DesignerDashboard() {
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [briefs, setBriefs] = useState<DesignBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: member } = await supabase
        .from('team_members')
        .select('id, name, role')
        .eq('auth_user_id', user.id)
        .single();

      if (!member) { setLoading(false); return; }
      setUserName(member.name);
      setUserRole(member.role);

      // Get design briefs assigned to this user (by name or id)
      const { data: designBriefs } = await supabase
        .from('design_briefs')
        .select('*, brand:brands(name, slug)')
        .or(`assigned_to.eq.${member.name},assigned_to.eq.${member.id}`)
        .order('created_at', { ascending: false });

      setBriefs(designBriefs || []);
      setLoading(false);
    }
    load();
  }, [supabase]);

  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const totalBriefs = briefs.length;
  const inProgressCount = briefs.filter(b => b.status === 'in_progress').length;
  const dueThisWeek = briefs.filter(b => b.due_date && new Date(b.due_date) <= weekFromNow && new Date(b.due_date) >= now && b.status !== 'approved').length;
  const completedCount = briefs.filter(b => b.status === 'approved').length;

  const briefsByStatus = KANBAN_COLUMNS.reduce((acc, col) => {
    acc[col.key] = briefs.filter(b => b.status === col.key);
    return acc;
  }, {} as Record<string, DesignBrief[]>);

  if (loading) return <div className="p-4 sm:p-6"><div className="animate-pulse space-y-4"><div className="h-24 bg-white/5 rounded-xl" /><div className="h-64 bg-white/5 rounded-xl" /></div></div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Welcome Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-xl sm:text-2xl font-bold text-white">Welcome, {userName}</h1>
          <StatusBadge status={userRole} />
        </div>
        <p className="text-gray-400 text-xs sm:text-sm">Your design briefs and tasks across all brands</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white/5 rounded-xl p-3 sm:p-4 border border-white/10">
          <div className="flex items-center gap-2 text-gray-400 text-[10px] sm:text-xs mb-1"><Palette size={14} />Total Briefs</div>
          <div className="text-2xl sm:text-3xl font-bold text-white">{totalBriefs}</div>
        </div>
        <div className="bg-white/5 rounded-xl p-3 sm:p-4 border border-white/10">
          <div className="flex items-center gap-2 text-gray-400 text-[10px] sm:text-xs mb-1"><Clock size={14} />In Progress</div>
          <div className="text-2xl sm:text-3xl font-bold text-yellow-400">{inProgressCount}</div>
        </div>
        <div className="bg-white/5 rounded-xl p-3 sm:p-4 border border-white/10">
          <div className="flex items-center gap-2 text-gray-400 text-[10px] sm:text-xs mb-1"><AlertTriangle size={14} />Due This Week</div>
          <div className={`text-2xl sm:text-3xl font-bold ${dueThisWeek > 0 ? 'text-orange-400' : 'text-green-400'}`}>{dueThisWeek}</div>
        </div>
        <div className="bg-white/5 rounded-xl p-3 sm:p-4 border border-white/10">
          <div className="flex items-center gap-2 text-gray-400 text-[10px] sm:text-xs mb-1"><CheckCircle size={14} />Completed</div>
          <div className="text-2xl sm:text-3xl font-bold text-green-400">{completedCount}</div>
        </div>
      </div>

      {/* Kanban Board */}
      {briefs.length === 0 ? (
        <EmptyState
          icon={Palette}
          title="No design briefs yet"
          description="You haven't been assigned any design briefs. Briefs assigned to you will appear here."
        />
      ) : (
        <div className="space-y-3">
          <h2 className="text-base sm:text-lg font-semibold text-white">Design Board</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-6">
            {KANBAN_COLUMNS.map(col => (
              <div key={col.key} className="bg-white/5 rounded-lg p-3 min-h-[200px] min-w-[200px] sm:min-w-0 flex-shrink-0 sm:flex-shrink border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase">{col.label}</span>
                  <span className="text-[10px] sm:text-xs text-gray-500">{briefsByStatus[col.key]?.length || 0}</span>
                </div>
                <div className="space-y-2">
                  {(briefsByStatus[col.key] || []).map(brief => (
                    <div key={brief.id} className="bg-[#1a1a2e] rounded-lg p-2.5 sm:p-3 border border-white/5 hover:border-white/20 transition">
                      {brief.brand && (
                        <span className="inline-block px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] rounded mb-1.5">{brief.brand.name}</span>
                      )}
                      <div className="text-xs sm:text-sm text-white font-medium leading-tight">{brief.title}</div>
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {brief.priority && <PriorityBadge priority={brief.priority} />}
                        {brief.due_date && (
                          <span className={`text-[10px] sm:text-xs ${new Date(brief.due_date) < now && brief.status !== 'approved' ? 'text-red-400' : 'text-gray-500'}`}>
                            {new Date(brief.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {briefs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base sm:text-lg font-semibold text-white">Recent Briefs</h2>
          <div className="bg-white/5 rounded-xl border border-white/10 divide-y divide-white/5">
            {briefs.slice(0, 10).map(brief => (
              <div key={brief.id} className="flex items-center justify-between p-3 sm:p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="text-white text-sm font-medium truncate">{brief.title}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {brief.brand && <span className="text-[10px] text-gray-500">{brief.brand.name}</span>}
                      {brief.due_date && <span className="text-[10px] text-gray-500">Due {new Date(brief.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {brief.priority && <PriorityBadge priority={brief.priority} />}
                  <StatusBadge status={brief.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
