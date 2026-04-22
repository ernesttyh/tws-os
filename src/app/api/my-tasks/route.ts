import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  
  // Get the current authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  
  // Find the team member record for this auth user
  const { data: teamMember } = await supabase
    .from('team_members')
    .select('id, name, role')
    .eq('auth_user_id', user.id)
    .single();
  
  if (!teamMember) {
    return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
  }
  
  // Get all tasks assigned to this team member across all brands
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*, brand:brands!tasks_brand_id_fkey(id,name,slug), assigned_member:team_members!tasks_assigned_to_fkey(id,name)')
    .eq('assigned_to', teamMember.id)
    .order('due_date', { ascending: true, nullsFirst: false });
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({
    member: teamMember,
    tasks: tasks || [],
  });
}
