import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const teamMemberId = req.nextUrl.searchParams.get('team_member_id');

  let query = supabase
    .from('brand_assignments')
    .select('*, brand:brands(id,name,slug,brand_group,status), team_member:team_members(id,name,email,role)')
    .order('created_at', { ascending: false });

  if (teamMemberId) {
    query = query.eq('team_member_id', teamMemberId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json();
  const { brand_id, team_member_id, role } = body;

  const { data, error } = await supabase
    .from('brand_assignments')
    .upsert(
      { brand_id, team_member_id, role: role || null },
      { onConflict: 'brand_id,team_member_id' }
    )
    .select('*, brand:brands(id,name,slug,brand_group,status), team_member:team_members(id,name,email,role)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const id = req.nextUrl.searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });

  const { error } = await supabase.from('brand_assignments').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
