import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const includeGroup = url.searchParams.get('includeGroup') !== 'false'; // default true
  const supabase = await createClient();

  // Get the brand's group to include sibling brand events for meetings/shoots
  let brandIds = [brandId];
  if (includeGroup) {
    const { data: brand } = await supabase.from('brands').select('brand_group').eq('id', brandId).single();
    if (brand?.brand_group && brand.brand_group !== 'independent') {
      const { data: siblings } = await supabase
        .from('brands')
        .select('id')
        .eq('brand_group', brand.brand_group)
        .eq('status', 'active');
      if (siblings) {
        brandIds = siblings.map(s => s.id);
      }
    }
  }

  // Fetch events for this brand AND group siblings (for meetings/shoots)
  let query = supabase
    .from('calendar_events')
    .select('*, brands!inner(name, slug)')
    .in('brand_id', brandIds)
    .order('start_date', { ascending: true });

  if (from) query = query.gte('start_date', from);
  if (to) query = query.lte('start_date', to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Add brand_name to each event for display
  const enriched = (data || []).map(e => ({
    ...e,
    brand_name: (e as any).brands?.name || null,
    brand_slug: (e as any).brands?.slug || null,
    brands: undefined
  }));

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const supabase = await createClient();
  const body = await req.json();
  const { data, error } = await supabase.from('calendar_events').insert({ ...body, brand_id: brandId }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
