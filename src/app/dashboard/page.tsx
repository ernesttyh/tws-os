'use client';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface BrandSummary { id: string; name: string; slug: string; brand_group: string; tasks_total: number; tasks_overdue: number; content_count: number; meetings_this_month: number; active_ads: number; kol_count: number; shoots_count: number; health: number }

export default function DashboardPage() {
  const [brands, setBrands] = useState<BrandSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createBrowserClient();

  useEffect(() => {
    async function load() {
      // Wait for auth session to be ready
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const { data: brandList } = await supabase.from('brands').select('*').eq('status', 'active').order('name');
      if (!brandList) { setLoading(false); return; }

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

      const summaries: BrandSummary[] = await Promise.all(brandList.map(async (b) => {
        const [tasks, content, meetings, ads, kol, shoots] = await Promise.all([
          supabase.from('tasks').select('id,status,due_date').eq('brand_id', b.id),
          supabase.from('content_items').select('id').eq('brand_id', b.id),
          supabase.from('meeting_minutes').select('id').eq('brand_id', b.id).gte('meeting_date', monthStart),
          supabase.from('ad_campaigns').select('id').eq('brand_id', b.id).eq('status', 'active'),
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

        // Health score: based on content, meetings, shoots, ads/kols
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
  const brandsWithContent = brands.filter(b => b.content_count > 0).length;
  const totalContent = brands.reduce((s, b) => s + b.content_count, 0);
  const totalShoots = brands.reduce((s, b) => s + b.shoots_count, 0);
  const totalOverdue = brands.reduce((s, b) => s + b.tasks_overdue, 0);
  const avgHealth = brands.length ? Math.round(brands.reduce((s, b) => s + b.health, 0) / brands.length) : 0;

  if (loading) return <div className="p-4 sm:p-6"><div className="animate-pulse space-y-4"><div className="h-24 bg-white/5 rounded-xl" /><div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-white/5 rounded-xl" />)}</div></div></div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-xs sm:text-sm">Account overview across all brands</p>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-white/5 rounded-xl p-3 sm:p-4 border border-white/10"><div className="text-[10px] sm:text-xs text-gray-400 mb-1">Active Brands</div><div className="text-2xl sm:text-3xl font-bold text-white">{totalBrands}</div></div>
        <div className="bg-white/5 rounded-xl p-3 sm:p-4 border border-white/10"><div className="text-[10px] sm:text-xs text-gray-400 mb-1">With Content</div><div className="text-2xl sm:text-3xl font-bold text-purple-400">{brandsWithContent}</div></div>
        <div className="bg-white/5 rounded-xl p-3 sm:p-4 border border-white/10"><div className="text-[10px] sm:text-xs text-gray-400 mb-1">Total Content</div><div className="text-2xl sm:text-3xl font-bold text-blue-400">{totalContent}</div></div>
        <div className="bg-white/5 rounded-xl p-3 sm:p-4 border border-white/10"><div className="text-[10px] sm:text-xs text-gray-400 mb-1">Shoot Briefs</div><div className="text-2xl sm:text-3xl font-bold text-orange-400">{totalShoots}</div></div>
        <div className="bg-white/5 rounded-xl p-3 sm:p-4 border border-white/10"><div className="text-[10px] sm:text-xs text-gray-400 mb-1">Overdue Tasks</div><div className={`text-2xl sm:text-3xl font-bold ${totalOverdue > 0 ? 'text-red-400' : 'text-green-400'}`}>{totalOverdue}</div></div>
        <div className="bg-white/5 rounded-xl p-3 sm:p-4 border border-white/10"><div className="text-[10px] sm:text-xs text-gray-400 mb-1">Avg Health</div><div className={`text-2xl sm:text-3xl font-bold ${healthColor(avgHealth)}`}>{avgHealth}</div></div>
      </div>

      {/* Brand Cards — Mobile */}
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

      {/* Brand Table — Desktop */}
      <div className="hidden sm:block bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/10">
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-400">Brand</th>
              <th className="text-center py-3 px-4 text-xs font-medium text-gray-400">Health</th>
              <th className="text-center py-3 px-4 text-xs font-medium text-gray-400">Content</th>
              <th className="text-center py-3 px-4 text-xs font-medium text-gray-400">Shoots</th>
              <th className="text-center py-3 px-4 text-xs font-medium text-gray-400">Meetings</th>
              <th className="text-center py-3 px-4 text-xs font-medium text-gray-400">Tasks</th>
              <th className="text-center py-3 px-4 text-xs font-medium text-gray-400">Ads</th>
              <th className="text-center py-3 px-4 text-xs font-medium text-gray-400">KOLs</th>
            </tr></thead>
            <tbody>
              {brands.map(b => (
                <tr key={b.id} className="border-b border-white/5 hover:bg-white/5 transition cursor-pointer" onClick={() => window.location.href = `/dashboard/brand/${b.slug}`}>
                  <td className="py-3 px-4">
                    <Link href={`/dashboard/brand/${b.slug}`} className="text-white hover:text-purple-400 font-medium transition">{b.name}</Link>
                    <div className="text-xs text-gray-500 capitalize">{b.brand_group?.replace('_', ' ')}</div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden"><div className={`h-full rounded-full ${healthBg(b.health)}`} style={{ width: `${b.health}%` }} /></div>
                      <span className={`text-xs font-semibold ${healthColor(b.health)}`}>{b.health}</span>
                    </div>
                  </td>
                  <td className={`py-3 px-4 text-center font-medium ${b.content_count > 0 ? 'text-purple-400' : 'text-gray-600'}`}>{b.content_count}</td>
                  <td className={`py-3 px-4 text-center font-medium ${b.shoots_count > 0 ? 'text-orange-400' : 'text-gray-600'}`}>{b.shoots_count}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={b.meetings_this_month >= 1 ? 'text-green-400' : 'text-gray-600'}>{b.meetings_this_month}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-gray-300">{b.tasks_total}</span>
                    {b.tasks_overdue > 0 && <span className="text-red-400 text-xs ml-1">({b.tasks_overdue} ⚠️)</span>}
                  </td>
                  <td className={`py-3 px-4 text-center ${b.active_ads > 0 ? 'text-blue-400' : 'text-gray-600'}`}>{b.active_ads}</td>
                  <td className={`py-3 px-4 text-center ${b.kol_count > 0 ? 'text-green-400' : 'text-gray-600'}`}>{b.kol_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
