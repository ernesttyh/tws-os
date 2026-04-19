import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ brandId: string; taskId: string }> }) {
  const { taskId } = await params;
  const supabase = await createClient();
  const body = await req.json();
  const { data, error } = await supabase.from('tasks').update(body).eq('id', taskId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ brandId: string; taskId: string }> }) {
  const { taskId } = await params;
  const supabase = await createClient();
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
