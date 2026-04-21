export type BrandGroup = 'neo_group' | 'fleursophy' | 'deprosperoo' | 'independent' | 'tsim' | 'other'
export type BrandStatus = 'active' | 'paused' | 'archived'
export type TeamRole = 'admin' | 'manager' | 'designer' | 'copywriter' | 'videographer' | 'intern' | 'custom'
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'archived'
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low'
export type ContentStatus = 'idea' | 'planned' | 'in_progress' | 'review' | 'approved' | 'scheduled' | 'posted' | 'rejected'
export type ContentType = 'reel' | 'carousel' | 'static' | 'story' | 'video' | 'tiktok' | 'blog' | 'edm' | 'other'

export interface Brand {
  id: string
  name: string
  slug: string
  brand_group: BrandGroup
  status: BrandStatus
  logo_url?: string
  website_url?: string
  instagram_handle?: string
  facebook_page_url?: string
  tiktok_handle?: string
  google_sheet_id?: string
  masterfile_tab?: string
  influencer_sheet_id?: string
  fb_ad_account_id?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface TeamMember {
  id: string
  auth_user_id?: string
  name: string
  email: string
  role: TeamRole
  avatar_url?: string
  is_active: boolean
  created_at: string
}

export interface Task {
  id: string
  brand_id?: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  assigned_to?: string
  created_by?: string
  due_date?: string
  completed_at?: string
  tags?: string[]
  parent_task_id?: string
  sort_order: number
  created_at: string
  updated_at: string
  assignee?: TeamMember
  brand?: Brand
}

export interface ContentItem {
  id: string
  brand_id: string
  month: string
  date?: string
  day_of_week?: string
  content_type: ContentType
  title?: string
  contents?: string
  caption?: string
  hashtags?: string
  link?: string
  schedule_time?: string
  status: ContentStatus
  assigned_to?: string
  comments?: string
  views?: number
  likes?: number
  shares?: number
  saves?: number
  created_at: string
  updated_at: string
}

export interface MeetingMinutes {
  id: string
  brand_id: string
  title: string
  meeting_date: string
  meeting_type: 'workplan' | 'review' | 'brainstorm' | 'adhoc'
  attendees: string[]
  content?: string
  transcript_raw?: string
  source: 'manual' | 'plaud' | 'whatsapp'
  action_items_extracted: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

export interface CalendarEvent {
  id: string
  brand_id: string
  title: string
  event_type: 'meeting' | 'shoot' | 'post' | 'kol_visit' | 'campaign' | 'key_date' | 'deadline'
  start_date: string
  end_date?: string
  start_time?: string
  end_time?: string
  all_day: boolean
  color?: string
  description?: string
  location?: string
  assigned_to: string[]
  created_at: string
}

export interface ShootBrief {
  id: string
  brand_id: string
  title: string
  shoot_date?: string
  shoot_time?: string
  duration_hours?: number
  location?: string
  location_url?: string
  status: 'planned' | 'confirmed' | 'completed' | 'cancelled'
  shot_list?: string
  props_checklist: Array<{ item: string; checked: boolean }>
  talent?: string
  client_requirements?: string
  crew: { videographer?: string; photographer?: string; am?: string }
  notes?: string
  created_at: string
}

export interface DesignBrief {
  id: string
  brand_id: string
  title: string
  description?: string
  dimensions?: string
  reference_urls: string[]
  drive_folder_url?: string
  final_artwork_url?: string
  status: 'brief' | 'in_progress' | 'internal_review' | 'client_review' | 'revision' | 'approved'
  assigned_to?: string
  deadline?: string
  revision_count: number
  revision_notes?: string
  created_at: string
}

export interface CadenceSettings {
  id: string
  brand_id: string
  meeting_frequency: 'weekly' | 'biweekly' | 'monthly'
  posting_days: string[]
  stories_per_week: number
  shoots_per_month: number
  kol_invites_per_month: number
}

export const BRAND_GROUPS: Record<BrandGroup, string> = {
  neo_group: 'Neo Group',
  fleursophy: 'Fleursophy',
  deprosperoo: 'Deprosperoo',
  independent: 'Independent',
  tsim: 'Tsim',
  other: 'Other Clients',
}

export const EVENT_COLORS: Record<string, string> = {
  meeting: '#3b82f6',
  shoot: '#22c55e',
  post: '#a855f7',
  kol_visit: '#f97316',
  campaign: '#ef4444',
  key_date: '#eab308',
  deadline: '#f59e0b',
}
