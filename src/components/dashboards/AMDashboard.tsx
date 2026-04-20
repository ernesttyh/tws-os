'use client';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import Link from 'next/link';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import { Briefcase, AlertTriangle, Camera, CheckSquare } from 'lucide-react';

interface BrandSummary {
  id: string; name: string; slug: string; brand_group: string;
  tasks_total: number; tasks_overdue: number; content_count: number;
  meetings_this_month: number; active_ads: number; kol_count: number;
  shoots_count: number; health: number;
}

export default function AMDashboard() {
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [brands, setBrands] = useState<BrandSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Get team member record
      const { data: member } = await supabase
        .from('team_members')
        .select('id, name, role')
        .eq('auth_user_id', user.id)
        .single();

      if (!member) { setLoading(false); return; }
      setUserName(member.name);
      setUserRole(member.role);

      // Get brand assignments
      const { data: assignments } = await supabase
        .from('brand_assignments')
        .select('brand_id, brand:brands(id, name, slug, brand_group, status)')
        .eq('team_member_id', member.id);

      if (!assignments || assignments.length === 0) { setLoading(false); return; }

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

      const assignedBrands = assignments
        .map(a => a.brand)
        .filter((b): b is { id: string; name: string; slug: string; brand_group: string; status: string } => !!b && b.status === 'active');

      const summaries: BrandSummary[] = await Promise.all(assignedBrands.map(async (b) => {
        const [tasks, content, meetings, ads, kol, shoots] = await Promise.all([
          supabase.from('tasks').select('id,status,due_date').eq('brand_id', b.id),
          supabase.from('content_items').select('id').eq('brand_id', b.id),
          supabase.from('meeting_minutes').select('id').eq('brand_id', b.id).gte('meeting_date', monthStart),
          supabase.from('ad_campaigns').select('id').eq('brand_id', b.id),
          supabase.from('brand_influencer_campaigns').select('id').eq('brand_id', b.id),
          supabase.from('shoot_briefs').select('id').eq('brand_id', b.id),
        ]);

        const taskList = tasks.data || [];
        const contentCount = (content.data || []).length;
        const meetingsCount = (meetings.data || []).length;
        const adsCount = (ads.data || []).length;
        const kolCount = (kol.data || []).length;
        const shootsCount = (shoots.data || []).length;
        const overdue = taskList.filter(t => t.due_date && new Date(t.due_date) < now && t.status !== 'done' && t.status !== 'archived').length;

        const health = Math.min(100, Math.round(
          (overdue === 0 ? 20 : Math.max(0, 20 - overdue * 5)) +
          (meetingsCount >= 1 ? 20 : 0) +
          (contentCount > 0 ? 20 + Math.min(10, contentCount) : 5) +
          (shootsCount > 0 ? 15 : 0) +
          (adsCount > 0 || kolCount > 0 ? 15 : 0)
        ));

        return {
          id: b.id, name: b.name, slug: b.slug, brand_group: b.brand_group,
          tasks_total: taskList.length, tasks_overdue: overdue,
          content_count: contentCount,
          meetings_this_month: meetingsCount,
          active_ads: adsCount,
          kol_count: kolCount,
          shoots_count: shootsCount,
          health,
        };
      }));

      setBrands(summaries.sort((a, b) => b.content_count - a.content_count || a.name.localeCompare(b.name)));
      setLoading(false);
    }
    load();
  }, [supabase]);

  const healthColor = (h: number) => h >= 70 ? 'text-green-400' : h >= 40 ? 'text-yellow-400' : 'text-red-400';
  const healthBg = (h: number) => h >= 70 ? 'bg-green-500' : h >= 40 ? 'bg-yellow-500' : 'bg-red-500';

  const totalBrands = brands.length;
  const totalTasks = brands.reduce((s, b) => s + b.tasks_total, 0);
  const totalOverdue = brands.reduce((s, b) => s + b.tasks_overdue, 0);
  const totalShoots = brands.reduce((s, b) => s + b.shoots_count, 0);

  if (loading) return <div className="p-4 sm:p-6"><div className="animate-pulse space-y-4"><div className="h-24 bg-white/5 rounded-xl" /><div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-white/5 rounded-xl" />)}</div></div></div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Welcome Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-xl sm:text-2xl font-bold text-white">Welcome, {userName}</h1>
          <StatusBadge status={userRole} />
        </div>
        <p className="text-gray-400 text-xs sm:text-sm">Your assigned brands and key metrics</p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white/5 rounded-xl p-3 sm:p-4 border border-white/10">
          <div className="flex items-center gap-2 text-gray-400 text-[10px] sm:text-xs mb-1"><Briefcase size={14} />Assigned Brands</div>
          <div className="text-2xl sm:text-3xl font-bold text-white">{totalBrands}</div>
        </div>
        <div className="bg-white/5 rounded-xl p-3 sm:p-4 border border-white/10">
          <div className="flex items-center gap-2 text-gray-400 text-[10px] sm:text-xs mb-1"><CheckSquare size={14} />Total Tasks</div>
          <div className="text-2xl sm:text-3xl font-bold text-purple-400">{totalTasks}</div>
        </div>
        <div className="bg-white/5 rounded-xl p-3 sm:p-4 border border-white/10">
          <div className="flex items-center gap-2 text-gray-400 text-[10px] sm:text-xs mb-1"><AlertTriangle size={14} />Overdue Tasks</div>
          <div className={`text-2xl sm:text-3xl font-bold ${totalOverdue > 0 ? 'text-red-400' : 'text-green-400'}`}>{totalOverdue}</div>
        </div>
        <div className="bg-white/5 rounded-xl p-3 sm:p-4 border border-white/10">
          <div className="flex items-center gap-2 text-gray-400 text-[10px] sm:text-xs mb-1"><Camera size={14} />This Month&apos;s Shoots</div>
          <div className="text-2xl sm:text-3xl font-bold text-orange-400">{totalShoots}</div>
        </div>
      </div>

      {/* Brand Cards */}
      {brands.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No brands assigned yet"
          description="You haven't been assigned to any brands. Contact your admin to get brand assignments."
        />
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="sm:hidden space-y-2">
            {brands.map(b => (
              <Link key={b.id} href={`/dashboard/brand/${b.slug}`} className="block bg-white/5 rounded-lg p-3 border border-white/10 active:bg-white/10 transition">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-white font-medium text-sm">{b.name}</span>
                    <div className="text-[10px] text-gray-500 capitalize">{b.brand_group?.replace('_', ' ')}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-10 h-1.5 bg-white/10 rounded-full overflow-hidden"><div className={`h-full rounded-full ${healthBg(b.health)}`} style={{ width: `${b.health}%` }} /></div>
                    <span className={`text-xs font-semibold ${healthColor(b.health)}`}>{b.health}</span>
                  </div>
                </div>
                <div className="flex gap-3 text-[10px] text-gray-400">
                  <span>📝 {b.content_count}</span>
                  <span>🎬 {b.shoots_count}</span>
                  <span>📅 {b.meetings_this_month}</span>
                  <span>📊 {b.active_ads}</span>
                  <span>👥 {b.kol_count}</span>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop Grid */}
          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {brands.map(b => (
              <Link key={b.id} href={`/dashboard/brand/${b.slug}`} className="block bg-white/5 rounded-xl p-4 border border-white/10 hover:border-purple-500/50 hover:bg-white/[0.07] transition group">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-white font-semibold group-hover:text-purple-400 transition">{b.name}</h3>
                    <span className="text-xs text-gray-500 capitalize">{b.brand_group?.replace('_', ' ')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-2 bg-white/10 rounded-full overflow-hidden"><div className={`h-full rounded-full ${healthBg(b.health)}`} style={{ width: `${b.health}%` }} /></div>
                    <span className={`text-xs font-semibold ${healthColor(b.health)}`}>{b.health}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-white/5 rounded-lg p-2 text-center"><div className="text-gray-400 text-[10px]">Content</div><div className="text-white font-semibold">{b.content_count}</div></div>
                  <div className="bg-white/5 rounded-lg p-2 text-center"><div className="text-gray-400 text-[10px]">Tasks</div><div className="text-white font-semibold">{b.tasks_total}{b.tasks_overdue > 0 && <span className="text-red-400 ml-0.5">({b.tasks_overdue})</span>}</div></div>
                  <div className="bg-white/5 rounded-lg p-2 text-center"><div className="text-gray-400 text-[10px]">Shoots</div><div className="text-white font-semibold">{b.shoots_count}</div></div>
                  <div className="bg-white/5 rounded-lg p-2 text-center"><div className="text-gray-400 text-[10px]">Ads</div><div className="text-white font-semibold">{b.active_ads}</div></div>
                  <div className="bg-white/5 rounded-lg p-2 text-center"><div className="text-gray-400 text-[10px]">KOLs</div><div className="text-white font-semibold">{b.kol_count}</div></div>
                  <div className="bg-white/5 rounded-lg p-2 text-center"><div className="text-gray-400 text-[10px]">Meetings</div><div className="text-white font-semibold">{b.meetings_this_month}</div></div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
