'use client';
import { useState, useEffect, useCallback, use } from 'react';
import { createBrowserClient } from '@/lib/supabase/client';
import { BarChart3, FileText, CheckSquare, Camera, Users, Calendar, TrendingUp, AlertTriangle, Target, Clock, ArrowRight, Megaphone, DollarSign, Eye, MousePointerClick, ChevronRight } from 'lucide-react';

interface Brand { id: string; name: string; slug: string; brand_group: string }

export default function BrandOverview({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    tasks: { id: string; title: string; status: string; due_date: string | null; priority: string }[];
    content: { id: string; title: string; status: string; date: string | null; month: string | null }[];
    meetings: { id: string; title: string; start_date: string; event_type: string; location: string | null }[];
    events: { id: string; title: string; start_date: string; event_type: string; location: string | null }[];
    invitations: { id: string; event_name: string; event_month: string | null; confirmed: boolean; attended: boolean; posted: boolean; ig_post_url: string | null; tt_post_url: string | null; xhs_post_url: string | null; l8_post_url: string | null }[];
    campaigns: { id: string; campaign_name: string; status: string; spend: number; impressions: number; clicks: number; ctr: number; cpc: number; cpm: number; reach: number }[];
    contentAll: { id: string; status: string; date: string | null; month: string }[];
  } | null>(null);

  const supabase = createBrowserClient();

  const loadData = useCallback(async () => {
    const { data: b } = await supabase.from('brands').select('*').eq('slug', slug).single();
    if (!b) { setLoading(false); return; }
    setBrand(b);

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const monthStart = `${y}-${m}-01`;
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    const monthEnd = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
    const todayStr = `${y}-${m}-${String(now.getDate()).padStart(2, '0')}`;

    // Also get group brands for group-level data
    const { data: groupBrands } = await supabase.from('brands').select('id').eq('brand_group', b.brand_group).eq('status', 'active');
    const groupBrandIds = (groupBrands || []).map(gb => gb.id);

    const [tasks, content, meetings, events, invitations, campaigns, contentAll] = await Promise.all([
      supabase.from('tasks').select('id,title,status,due_date,priority').eq('brand_id', b.id).neq('status', 'archived').order('due_date', { ascending: true, nullsFirst: false }),
      supabase.from('content_items').select('id,title,status,date,month').eq('brand_id', b.id).order('date', { ascending: false, nullsFirst: true }).limit(50),
      supabase.from('calendar_events').select('id,title,start_date,event_type,location').in('brand_id', groupBrandIds).gte('start_date', monthStart).lte('start_date', monthEnd).order('start_date', { ascending: true }),
      supabase.from('calendar_events').select('id,title,start_date,event_type,location').in('brand_id', groupBrandIds).gte('start_date', todayStr).order('start_date', { ascending: true }).limit(5),
      supabase.from('influencer_invitations').select('id,event_name,event_month,confirmed,attended,posted,ig_post_url,tt_post_url,xhs_post_url,l8_post_url').eq('brand_id', b.id),
      supabase.from('ad_campaigns').select('id,campaign_name,status,spend,impressions,clicks,ctr,cpc,cpm,reach').eq('brand_id', b.id),
      supabase.from('content_items').select('id,status,date,month').eq('brand_id', b.id),
    ]);

    setData({
      tasks: tasks.data || [],
      content: content.data || [],
      meetings: (meetings.data || []).filter(m => m.event_type === 'meeting' || m.title?.toLowerCase().includes('meeting') || m.title?.toLowerCase().includes('workplan')),
      events: events.data || [],
      invitations: invitations.data || [],
      campaigns: campaigns.data || [],
      contentAll: contentAll.data || [],
    });
    setLoading(false);
  }, [slug, supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading || !data || !brand) return (
    <div className="p-4 sm:p-6"><div className="animate-pulse space-y-4">
      <div className="h-28 bg-gray-100 rounded-xl" />
      <div className="grid grid-cols-2 gap-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}</div>
    </div></div>
  );

  const now = new Date();
  const activeTasks = data.tasks.filter(t => t.status !== 'done');
  const doneTasks = data.tasks.filter(t => t.status === 'done');
  const overdueTasks = activeTasks.filter(t => t.due_date && new Date(t.due_date) < now);
  const upcomingTasks = activeTasks.filter(t => t.due_date && new Date(t.due_date) >= now).slice(0, 5);

  const currentMonthLabel = now.toLocaleString('en-US', { month: 'long' }) + ' ' + now.getFullYear();
  const thisMonthContent = data.contentAll.filter(c => {
    if (c.month === currentMonthLabel) return true;
    if (!c.date) return false;
    const d = new Date(c.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const postedThisMonth = thisMonthContent.filter(c => c.status === 'posted' || c.status === 'scheduled');

  const meetingsThisMonth = data.meetings.length;
  const activeCampaigns = data.campaigns.filter(c => c.status === 'active');
  const totalAdSpend = data.campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
  const totalImpressions = data.campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);

  const kolTotal = data.invitations.length;
  const kolPosted = data.invitations.filter(i => i.ig_post_url || i.tt_post_url || i.xhs_post_url).length;
  const kolAttended = data.invitations.filter(i => i.attended === true || i.confirmed === true).length;

  // Health Score — weighted and meaningful
  const taskScore = activeTasks.length === 0 ? 20 : Math.max(0, 20 - (overdueTasks.length * 4));
  const meetingScore = meetingsThisMonth >= 2 ? 20 : meetingsThisMonth * 10;
  const contentScore = Math.min(20, postedThisMonth.length * 2);
  const adScore = activeCampaigns.length > 0 ? 20 : totalAdSpend > 0 ? 10 : 5;
  const kolScore = kolTotal > 0 ? (kolPosted > 0 ? 20 : 10) : 5;
  const healthScore = Math.min(100, taskScore + meetingScore + contentScore + adScore + kolScore);
  const healthColor = healthScore >= 80 ? 'text-green-600' : healthScore >= 50 ? 'text-amber-500' : 'text-red-500';
  const healthBg = healthScore >= 80 ? 'from-green-50 to-emerald-50 border-green-200' : healthScore >= 50 ? 'from-amber-50 to-yellow-50 border-amber-200' : 'from-red-50 to-pink-50 border-red-200';

  const BRAND_GROUP_LABELS: Record<string, string> = {
    neo_group: 'Neo Group', fleursophy: 'Fleursophy', deprosperoo: 'Deprosperoo', independent: 'Independent', tsim: 'TSIM', other: 'Other'
  };

  const monthName = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // Alerts
  const alerts: { type: 'danger' | 'warning' | 'info'; message: string }[] = [];
  if (overdueTasks.length > 0) alerts.push({ type: 'danger', message: `${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''} need attention` });
  if (meetingsThisMonth === 0) alerts.push({ type: 'warning', message: `No meetings recorded this month` });
  if (postedThisMonth.length === 0 && data.contentAll.length > 0) alerts.push({ type: 'warning', message: `No content posted this month yet` });
  if (activeCampaigns.length === 0 && data.campaigns.length > 0) alerts.push({ type: 'info', message: `No active ad campaigns running` });

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Health Banner */}
      <div className={`bg-gradient-to-r ${healthBg} rounded-xl p-4 sm:p-5 border`}>
        <div className="flex items-start justify-between">
          <div className="min-w-0 mr-3">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{brand.name}</h1>
            <p className="text-xs text-gray-500 mt-0.5">{BRAND_GROUP_LABELS[brand.brand_group] || brand.brand_group} • {monthName}</p>
          </div>
          <div className="text-right shrink-0">
            <div className={`text-3xl sm:text-4xl font-bold ${healthColor}`}>{healthScore}</div>
            <div className="text-[10px] text-gray-500 font-medium">Health Score</div>
          </div>
        </div>
        {/* Score breakdown */}
        <div className="mt-3 grid grid-cols-5 gap-1">
          {[
            { label: 'Tasks', score: taskScore, max: 20 },
            { label: 'Meetings', score: meetingScore, max: 20 },
            { label: 'Content', score: contentScore, max: 20 },
            { label: 'Ads', score: adScore, max: 20 },
            { label: 'KOL', score: kolScore, max: 20 },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <div className="w-full bg-white/60 rounded-full h-1.5 mb-1">
                <div className={`h-1.5 rounded-full ${item.score >= item.max * 0.8 ? 'bg-green-500' : item.score >= item.max * 0.4 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${(item.score / item.max) * 100}%` }} />
              </div>
              <span className="text-[9px] text-gray-500">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div key={i} className={`flex items-center gap-2 text-xs sm:text-sm px-3 py-2 rounded-lg ${
              alert.type === 'danger' ? 'bg-red-50 text-red-700 border border-red-200' :
              alert.type === 'warning' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
              'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
              <AlertTriangle size={14} className="shrink-0" />
              {alert.message}
            </div>
          ))}
        </div>
      )}

      {/* Monthly Cadence — THE KEY SECTION */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><TrendingUp size={16} />Monthly Cadence</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <CadenceCard icon={Calendar} label="Meetings" value={meetingsThisMonth} target={2} sub={meetingsThisMonth >= 2 ? '✓ On track' : 'Target: 2/mo'} />
          <CadenceCard icon={Target} label="Content Posted" value={postedThisMonth.length} target={null} sub={`${thisMonthContent.length} total this month`} />
          <CadenceCard icon={Users} label="KOL Posts" value={kolPosted} target={null} sub={`${kolTotal} total invitations`} />
          <CadenceCard icon={Megaphone} label="Active Ads" value={activeCampaigns.length} target={null} sub={totalAdSpend > 0 ? `$${totalAdSpend.toLocaleString()} spent` : 'No spend'} />
        </div>
      </div>

      {/* Ad Performance Quick Stats (if has ads) */}
      {totalAdSpend > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><BarChart3 size={16} />Ad Performance</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-lg p-3 border border-gray-200 text-center">
              <DollarSign size={14} className="mx-auto text-green-500 mb-1" />
              <div className="text-lg font-bold text-gray-900">${totalAdSpend.toLocaleString()}</div>
              <div className="text-[10px] text-gray-500">Total Spend</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-gray-200 text-center">
              <Eye size={14} className="mx-auto text-blue-500 mb-1" />
              <div className="text-lg font-bold text-gray-900">{totalImpressions >= 1000000 ? `${(totalImpressions/1000000).toFixed(1)}M` : totalImpressions >= 1000 ? `${(totalImpressions/1000).toFixed(0)}K` : totalImpressions}</div>
              <div className="text-[10px] text-gray-500">Impressions</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-gray-200 text-center">
              <MousePointerClick size={14} className="mx-auto text-purple-500 mb-1" />
              <div className="text-lg font-bold text-gray-900">{data.campaigns.reduce((s, c) => s + (c.clicks || 0), 0).toLocaleString()}</div>
              <div className="text-[10px] text-gray-500">Clicks</div>
            </div>
          </div>
        </div>
      )}

      {/* Two columns: Tasks + Events */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Task Summary */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><CheckSquare size={16} />Tasks</h2>
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
            <div className="p-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">Active</span>
              <span className="text-sm font-semibold text-gray-900">{activeTasks.length}</span>
            </div>
            <div className="p-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">Completed</span>
              <span className="text-sm font-semibold text-green-600">{doneTasks.length}</span>
            </div>
            <div className="p-3 flex items-center justify-between">
              <span className="text-xs text-red-500 font-medium">Overdue</span>
              <span className={`text-sm font-bold ${overdueTasks.length > 0 ? 'text-red-500' : 'text-gray-400'}`}>{overdueTasks.length}</span>
            </div>
            {overdueTasks.slice(0, 3).map(t => (
              <div key={t.id} className="px-3 py-2 flex items-center justify-between text-xs">
                <span className="text-gray-700 truncate mr-2">{t.title}</span>
                <span className="text-red-400 shrink-0">Due {new Date(t.due_date!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
              </div>
            ))}
            {upcomingTasks.length > 0 && (
              <>
                <div className="px-3 py-2 bg-gray-50 text-[10px] text-gray-400 font-medium uppercase tracking-wider">Upcoming</div>
                {upcomingTasks.slice(0, 3).map(t => (
                  <div key={t.id} className="px-3 py-2 flex items-center justify-between text-xs">
                    <span className="text-gray-600 truncate mr-2">{t.title}</span>
                    <span className="text-gray-400 shrink-0">{new Date(t.due_date!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Upcoming Events */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><Calendar size={16} />Upcoming Events</h2>
          {data.events.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-xs text-gray-400">No upcoming events</div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
              {data.events.map(ev => {
                const d = new Date(ev.start_date);
                const isToday = d.toDateString() === now.toDateString();
                const typeEmoji = ev.event_type === 'shoot' ? '📸' : ev.event_type === 'meeting' ? '🤝' : ev.event_type === 'event' ? '🎉' : '📅';
                return (
                  <div key={ev.id} className={`px-3 py-2.5 ${isToday ? 'bg-blue-50' : ''}`}>
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 mr-2">
                        <span className="text-xs font-medium text-gray-800">{typeEmoji} {ev.title}</span>
                        {ev.location && <p className="text-[10px] text-gray-400 mt-0.5 truncate">📍 {ev.location}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-[10px] font-medium ${isToday ? 'text-blue-600' : 'text-gray-500'}`}>
                          {isToday ? 'TODAY' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </div>
                        <div className="text-[10px] text-gray-400">{d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Content Pipeline Summary */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><FileText size={16} />Content Pipeline</h2>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          {(() => {
            const statuses = ['idea', 'planned', 'in_progress', 'review', 'approved', 'scheduled', 'posted'];
            const statusLabels: Record<string, string> = { idea: 'Idea', planned: 'Planned', in_progress: 'In Progress', review: 'Review', approved: 'Approved', scheduled: 'Scheduled', posted: 'Posted' };
            const statusColors: Record<string, string> = { idea: 'bg-gray-200', planned: 'bg-gray-300', in_progress: 'bg-amber-300', review: 'bg-orange-300', approved: 'bg-blue-300', scheduled: 'bg-purple-300', posted: 'bg-green-400' };
            const counts = statuses.map(s => ({ status: s, count: data.contentAll.filter(c => c.status === s).length }));
            const total = data.contentAll.length || 1;
            return (
              <div>
                <div className="flex rounded-full overflow-hidden h-3 mb-3">
                  {counts.filter(c => c.count > 0).map(c => (
                    <div key={c.status} className={`${statusColors[c.status]} transition-all`} style={{ width: `${(c.count / total) * 100}%` }} />
                  ))}
                  {total === 1 && data.contentAll.length === 0 && <div className="bg-gray-100 w-full" />}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {counts.filter(c => c.count > 0).map(c => (
                    <div key={c.status} className="flex items-center gap-1.5 text-xs">
                      <div className={`w-2 h-2 rounded-full ${statusColors[c.status]}`} />
                      <span className="text-gray-600">{statusLabels[c.status]}</span>
                      <span className="font-semibold text-gray-900">{c.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* KOL Summary (if has invitations) */}
      {kolTotal > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><Users size={16} />KOL Activity</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-lg p-3 border border-gray-200 text-center">
              <div className="text-lg font-bold text-gray-900">{kolTotal}</div>
              <div className="text-[10px] text-gray-500">Invitations</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-gray-200 text-center">
              <div className="text-lg font-bold text-green-600">{kolAttended}</div>
              <div className="text-[10px] text-gray-500">Confirmed</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-gray-200 text-center">
              <div className="text-lg font-bold text-purple-600">{kolPosted}</div>
              <div className="text-[10px] text-gray-500">Posted</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CadenceCard({ icon: Icon, label, value, target, sub }: { icon: React.ElementType; label: string; value: number; target: number | null; sub: string }) {
  const isGood = target === null ? value > 0 : value >= target;
  return (
    <div className="bg-white rounded-lg p-3 border border-gray-200">
      <div className="flex items-center gap-1.5 text-gray-500 text-[10px] sm:text-xs mb-1">
        <Icon size={14} className="shrink-0" /><span>{label}</span>
      </div>
      <div className={`text-xl sm:text-2xl font-bold ${isGood ? 'text-green-600' : value === 0 ? 'text-red-400' : 'text-amber-500'}`}>{value}</div>
      <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>
    </div>
  );
}
