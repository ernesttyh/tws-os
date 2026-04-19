import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('brand_influencer_campaigns')
    .select('*, influencer:influencers(*)')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const supabase = await createClient();
  const body = await req.json();
  // If creating a new influencer + campaign
  if (body.influencer_name) {
    const { data: inf, error: infErr } = await supabase.from('influencers')
      .insert({ name: body.influencer_name, instagram_handle: body.instagram_handle, tier: body.tier, followers_ig: body.followers_ig })
      .select().single();
    if (infErr) return NextResponse.json({ error: infErr.message }, { status: 500 });
    const { data, error } = await supabase.from('brand_influencer_campaigns')
      .insert({ brand_id: brandId, influencer_id: inf.id, campaign_name: body.campaign_name, status: body.status || 'prospecting', notes: body.notes })
      .select('*, influencer:influencers(*)').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  }
  // Existing influencer
  const { data, error } = await supabase.from('brand_influencer_campaigns')
    .insert({ ...body, brand_id: brandId })
    .select('*, influencer:influencers(*)').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
