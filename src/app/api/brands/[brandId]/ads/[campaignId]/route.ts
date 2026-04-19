import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ brandId: string; campaignId: string }> }) {
  const { campaignId } = await params;
  const supabase = await createClient();
  const body = await req.json();
  const { data, error } = await supabase.from('ad_campaigns').update(body).eq('id', campaignId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ brandId: string; campaignId: string }> }) {
  const { campaignId } = await params;
  const supabase = await createClient();
  const { error } = await supabase.from('ad_campaigns').delete().eq('id', campaignId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
