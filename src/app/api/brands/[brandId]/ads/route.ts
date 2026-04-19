import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ad_campaigns')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Get metrics summary for each campaign
  const campaignIds = (data || []).map(c => c.id);
  let metrics: Record<string, unknown>[] = [];
  if (campaignIds.length > 0) {
    const { data: m } = await supabase.from('ad_daily_metrics').select('*').in('campaign_id', campaignIds).order('date', { ascending: false });
    metrics = m || [];
  }
  return NextResponse.json({ campaigns: data, metrics });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const supabase = await createClient();
  const body = await req.json();
  const { data, error } = await supabase.from('ad_campaigns').insert({ ...body, brand_id: brandId }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
