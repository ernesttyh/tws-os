'use client';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { BarChart3, AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import Link from 'next/link';

interface BrandSummary { id: string; name: string; slug: string; brand_group: string; tasks_total: number; tasks_overdue: number; content_count: number; meetings_this_month: number; active_ads: number; kol_count: number; health: number }

export default function DashboardPage() {
  const [brands, setBrands] = useState<BrandSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserClient();

  useEffect(() => {
    async function load() {
      const { data: brandList } = await supabase.from('brands').select('*').eq('status', 'active').order('name');
      if (!brandList) { setLoading(false); return; }

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

      const summaries: BrandSummary[] = await Promise.all(brandList.map(async (b) => {
        const [tasks, content, meetings, ads, kol] = await Promise.all([
          supabase.from('tasks').select('id,status,due_date').eq('brand_id', b.id),
          supabase.from('content_items').select('id').eq('brand_id', b.id),
          supabase.from('meeting_minutes').select('id').eq('brand_id', b.id).gte('meeting_date', monthStart),
          supabase.from('ad_campaigns').select('id').eq('brand_id', b.id).eq('status', 'active'),
          supabase.from('brand_influencer_campaigns').select('id').eq('brand_id', b.id),
        ]);

        const taskList = tasks.data || [];
        const overdue = taskList.filter(t => t.due_date && new Date(t.due_date) < now && t.status !== 'done' && t.status !== 'archived').length;
        const health = Math.min(100, Math.round(
          (overdue === 0 ? 25 : Math.max(0, 25 - overdue * 5)) +
          ((meetings.data || []).length >= 1 ? 25 : 0) +
          ((content.data || []).length > 0 ? 25 : 10) +
          ((ads.data || []).length > 0 || (kol.data || []).length > 0 ? 25 : 10)
        ));

        return {
          id: b.id, name: b.name, slug: b.slug, brand_group: b.brand_group,
          tasks_total: taskList.length, tasks_overdue: overdue,
          content_count: (content.data || []).length,
          meetings_this_month: (meetings.data || []).length,
          active_ads: (ads.data || []).length,
          kol_count: (kol.data || []).length,
          health,
        };
      }));

      setBrands(summaries.sort((a, b) => a.health - b.health));
      setLoading(false);
    }
    load();
  }, [supabase]);

  const healthColor = (h: number) => h >= 80 ? 'text-green-400' : h >= 50 ? 'text-yellow-400' : 'text-red-400';
  const healthBg = (h: number) => h >= 80 ? 'bg-green-500' : h >= 50 ? 'bg-yellow-500' : 'bg-red-500';

  const totalBrands = brands.length;
  const needsAttention = brands.filter(b => b.health < 50).length;
  const totalOverdue = brands.reduce((s, b) => s + b.tasks_overdue, 0);

  if (loading) return <div className="p-4 sm:p-6"><div className="animate-pulse space-y-4"><div className="h-24 bg-gray-50 rounded-xl" /><div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-gray-50 rounded-xl" />)}</div></div></div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-xs sm:text-sm">Account overview across all brands</p>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-200"><div className="text-[10px] sm:text-xs text-gray-500 mb-1">Active Brands</div><div className="text-2xl sm:text-3xl font-bold text-gray-900">{totalBrands}</div></div>
        <div className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-200"><div className="text-[10px] sm:text-xs text-gray-500 mb-1">Needs Attention</div><div className={`text-2xl sm:text-3xl font-bold ${needsAttention > 0 ? 'text-red-400' : 'text-green-400'}`}>{needsAttention}</div></div>
        <div className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-200"><div className="text-[10px] sm:text-xs text-gray-500 mb-1">Overdue Tasks</div><div className={`text-2xl sm:text-3xl font-bold ${totalOverdue > 0 ? 'text-red-400' : 'text-green-400'}`}>{totalOverdue}</div></div>
        <div className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-200"><div className="text-[10px] sm:text-xs text-gray-500 mb-1">Avg Health</div><div className={`text-2xl sm:text-3xl font-bold ${healthColor(brands.reduce((s, b) => s + b.health, 0) / (brands.length || 1))}`}>{Math.round(brands.reduce((s, b) => s + b.health, 0) / (brands.length || 1))}</div></div>
      </div>

      {/* Brand Cards — Mobile */}
      <div className="sm:hidden space-y-2">
        {brands.map(b => (
          <Link key={b.id} href={`/dashboard/brand/${b.slug}`} className="block bg-gray-50 rounded-lg p-3 border border-gray-200 active:bg-gray-100 transition">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-gray-900 font-medium text-sm">{b.name}</span>
                <div className="text-[10px] text-gray-500 capitalize">{b.brand_group?.replace('_', ' ')}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-10 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${healthBg(b.health)}`} style={{ width: `${b.health}%` }} /></div>
                <span className={`text-xs font-semibold ${healthColor(b.health)}`}>{b.health}</span>
              </div>
            </div>
            <div className="flex gap-3 text-[10px] text-gray-500">
              <span>📋 {b.tasks_total} tasks{b.tasks_overdue > 0 ? <span className="text-red-400 ml-0.5">({b.tasks_overdue}⚠️)</span> : ''}</span>
              <span>📝 {b.content_count}</span>
              <span>📅 {b.meetings_this_month}</span>
              <span>📊 {b.active_ads}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Brand Table — Desktop */}
      <div className="hidden sm:block bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Brand</th>
              <th className="text-center py-3 px-4 text-xs font-medium text-gray-500">Health</th>
              <th className="text-center py-3 px-4 text-xs font-medium text-gray-500">Tasks</th>
              <th className="text-center py-3 px-4 text-xs font-medium text-gray-500">Content</th>
              <th className="text-center py-3 px-4 text-xs font-medium text-gray-500">Meetings</th>
              <th className="text-center py-3 px-4 text-xs font-medium text-gray-500">Ads</th>
              <th className="text-center py-3 px-4 text-xs font-medium text-gray-500">KOLs</th>
            </tr></thead>
            <tbody>
              {brands.map(b => (
                <tr key={b.id} className="border-b border-gray-200 hover:bg-gray-50 transition">
                  <td className="py-3 px-4">
                    <Link href={`/dashboard/brand/${b.slug}`} className="text-gray-900 hover:text-purple-400 font-medium transition">{b.name}</Link>
                    <div className="text-xs text-gray-500 capitalize">{b.brand_group?.replace('_', ' ')}</div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${healthBg(b.health)}`} style={{ width: `${b.health}%` }} /></div>
                      <span className={`text-xs font-semibold ${healthColor(b.health)}`}>{b.health}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-gray-600">{b.tasks_total}</span>
                    {b.tasks_overdue > 0 && <span className="text-red-400 text-xs ml-1">({b.tasks_overdue} ⚠️)</span>}
                  </td>
                  <td className="py-3 px-4 text-center text-gray-600">{b.content_count}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={b.meetings_this_month >= 1 ? 'text-green-400' : 'text-gray-500'}>{b.meetings_this_month}</span>
                  </td>
                  <td className="py-3 px-4 text-center text-gray-600">{b.active_ads}</td>
                  <td className="py-3 px-4 text-center text-gray-600">{b.kol_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
