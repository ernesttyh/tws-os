'use client';
import { useState, useEffect, useCallback, use } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { BarChart3, FileText, CheckSquare, Camera, Users, Palette, Calendar, TrendingUp, AlertTriangle, Target } from 'lucide-react';

interface BrandStats { tasks: { total: number; done: number; overdue: number }; content: { total: number; posted: number }; meetings: number; shoots: number; influencers: number; ads: number; designs: number; events: number }

export default function BrandOverview({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [brand, setBrand] = useState<{ id: string; name: string; brand_group: string } | null>(null);
  const [stats, setStats] = useState<BrandStats | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createBrowserClient();

  const loadData = useCallback(async () => {
    const { data: b } = await supabase.from('brands').select('*').eq('slug', slug).single();
    if (!b) { setLoading(false); return; }
    setBrand(b);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    const [tasks, content, meetings, shoots, influencers, ads, designs, events] = await Promise.all([
      supabase.from('tasks').select('id,status,due_date').eq('brand_id', b.id),
      supabase.from('content_items').select('id,status').eq('brand_id', b.id),
      supabase.from('meeting_minutes').select('id').eq('brand_id', b.id).gte('meeting_date', monthStart),
      supabase.from('shoot_briefs').select('id').eq('brand_id', b.id),
      supabase.from('brand_influencer_campaigns').select('id').eq('brand_id', b.id),
      supabase.from('ad_campaigns').select('id').eq('brand_id', b.id).eq('status', 'active'),
      supabase.from('design_briefs').select('id').eq('brand_id', b.id),
      supabase.from('calendar_events').select('id').eq('brand_id', b.id),
    ]);

    const taskList = tasks.data || [];
    const overdue = taskList.filter(t => t.due_date && new Date(t.due_date) < now && t.status !== 'done' && t.status !== 'archived');

    setStats({
      tasks: { total: taskList.length, done: taskList.filter(t => t.status === 'done').length, overdue: overdue.length },
      content: { total: (content.data || []).length, posted: (content.data || []).filter(c => c.status === 'posted').length },
      meetings: (meetings.data || []).length,
      shoots: (shoots.data || []).length,
      influencers: (influencers.data || []).length,
      ads: (ads.data || []).length,
      designs: (designs.data || []).length,
      events: (events.data || []).length,
    });
    setLoading(false);
  }, [slug, supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading || !stats) return <div className="p-4 sm:p-6"><div className="animate-pulse space-y-4"><div className="h-24 sm:h-32 bg-gray-50 rounded-xl" /><div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-20 sm:h-24 bg-gray-50 rounded-xl" />)}</div></div></div>;

  const modules = [
    { label: 'Tasks', icon: CheckSquare, value: `${stats.tasks.done}/${stats.tasks.total}`, sub: stats.tasks.overdue > 0 ? `${stats.tasks.overdue} overdue` : 'On track', color: stats.tasks.overdue > 0 ? 'text-red-400' : 'text-green-400', subColor: stats.tasks.overdue > 0 ? 'text-red-400' : 'text-green-400' },
    { label: 'Content', icon: Target, value: stats.content.total, sub: `${stats.content.posted} posted`, color: 'text-blue-400', subColor: 'text-gray-500' },
    { label: 'Meetings', icon: FileText, value: stats.meetings, sub: 'This month', color: stats.meetings >= 2 ? 'text-green-400' : 'text-yellow-400', subColor: 'text-gray-500' },
    { label: 'Shoots', icon: Camera, value: stats.shoots, sub: 'Scheduled', color: 'text-orange-400', subColor: 'text-gray-500' },
    { label: 'KOL Campaigns', icon: Users, value: stats.influencers, sub: 'Total', color: 'text-pink-400', subColor: 'text-gray-500' },
    { label: 'Active Ads', icon: BarChart3, value: stats.ads, sub: 'Running', color: stats.ads > 0 ? 'text-green-400' : 'text-gray-500', subColor: 'text-gray-500' },
    { label: 'Design Briefs', icon: Palette, value: stats.designs, sub: 'In pipeline', color: 'text-purple-400', subColor: 'text-gray-500' },
    { label: 'Events', icon: Calendar, value: stats.events, sub: 'Scheduled', color: 'text-cyan-400', subColor: 'text-gray-500' },
  ];

  const healthScore = Math.min(100, Math.round(
    (stats.tasks.overdue === 0 ? 20 : Math.max(0, 20 - stats.tasks.overdue * 5)) +
    (stats.meetings >= 2 ? 20 : stats.meetings * 10) +
    (stats.content.posted > 0 ? 20 : 0) +
    (stats.ads > 0 ? 20 : 10) +
    (stats.influencers > 0 ? 20 : 10)
  ));

  const healthColor = healthScore >= 80 ? 'text-green-400' : healthScore >= 50 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Health Banner */}
      <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-xl p-4 sm:p-6 border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="min-w-0 mr-3">
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{brand?.name}</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1 capitalize">{brand?.brand_group?.replace('_', ' ')} group</p>
          </div>
          <div className="text-right shrink-0">
            <div className={`text-3xl sm:text-4xl font-bold ${healthColor}`}>{healthScore}</div>
            <div className="text-[10px] sm:text-xs text-gray-500">Health Score</div>
          </div>
        </div>
        {stats.tasks.overdue > 0 && (
          <div className="mt-3 sm:mt-4 flex items-center gap-2 text-xs sm:text-sm text-red-400"><AlertTriangle size={16} />{stats.tasks.overdue} overdue task{stats.tasks.overdue > 1 ? 's' : ''} need attention</div>
        )}
      </div>

      {/* Module Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {modules.map((m, i) => (
          <div key={i} className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-200 hover:border-gray-300 transition">
            <div className="flex items-center gap-1.5 sm:gap-2 text-gray-500 text-[10px] sm:text-xs mb-1 sm:mb-2"><m.icon size={14} className="shrink-0" /><span className="truncate">{m.label}</span></div>
            <div className={`text-xl sm:text-2xl font-bold ${m.color}`}>{m.value}</div>
            <div className={`text-[10px] sm:text-xs mt-0.5 sm:mt-1 ${m.subColor}`}>{m.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
