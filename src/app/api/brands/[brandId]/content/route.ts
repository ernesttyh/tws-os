import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const url = new URL(req.url);
  const month = url.searchParams.get('month');
  const supabase = await createClient();
  let query = supabase.from('content_items').select('*').eq('brand_id', brandId).order('date', { ascending: true });
  if (month) query = query.eq('month', month);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const supabase = await createClient();
  const body = await req.json();
  const { data, error } = await supabase.from('content_items').insert({ ...body, brand_id: brandId }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
