import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.from('cadence_settings').select('*').eq('brand_id', brandId).single();
  if (error && error.code !== 'PGRST116') return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || { meeting_frequency: 'monthly', posting_days: ['tuesday', 'friday'], stories_per_week: 3, shoots_per_month: 2, kol_invites_per_month: 4 });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const supabase = await createClient();
  const body = await req.json();
  const { data, error } = await supabase.from('cadence_settings').upsert({ ...body, brand_id: brandId }, { onConflict: 'brand_id' }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
