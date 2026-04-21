import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const group = req.nextUrl.searchParams.get('group');
  if (!group) return NextResponse.json({ error: 'group parameter required' }, { status: 400 });

  const supabase = await createClient();

  // Get all active brands in this group
  const { data: brands, error: brandsErr } = await supabase
    .from('brands')
    .select('id, name, slug')
    .eq('brand_group', group)
    .eq('status', 'active');

  if (brandsErr || !brands?.length) return NextResponse.json([]);

  const brandIds = brands.map(b => b.id);
  const brandMap = Object.fromEntries(brands.map(b => [b.id, { name: b.name, slug: b.slug }]));

  // Get all meetings for these brands
  const { data: meetings, error: meetingsErr } = await supabase
    .from('meeting_minutes')
    .select('*, creator:team_members!meeting_minutes_created_by_fkey(id,name)')
    .in('brand_id', brandIds)
    .order('meeting_date', { ascending: false })
    .limit(100);

  if (meetingsErr) return NextResponse.json({ error: meetingsErr.message }, { status: 500 });

  // Attach brand info to each meeting
  const enriched = (meetings || []).map(m => ({
    ...m,
    brand: brandMap[m.brand_id] || null,
  }));

  return NextResponse.json(enriched);
}
