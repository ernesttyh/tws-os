import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const url = new URL(req.url);
  const search = url.searchParams.get('search') || '';
  const tier = url.searchParams.get('tier') || '';
  const page = parseInt(url.searchParams.get('page') || '0');
  const limit = 50;

  let query = supabase.from('influencers').select('*', { count: 'exact' })
    .order('followers_ig', { ascending: false, nullsFirst: false })
    .range(page * limit, (page + 1) * limit - 1);

  if (search) query = query.or(`name.ilike.%${search}%,instagram_handle.ilike.%${search}%,tiktok_handle.ilike.%${search}%`);
  if (tier && tier !== 'all') query = query.eq('tier', tier);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, total: count, page, limit });
}
