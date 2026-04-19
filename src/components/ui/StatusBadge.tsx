const statusColors: Record<string, string> = {
  // Task statuses
  backlog: 'bg-gray-500/20 text-gray-400',
  todo: 'bg-blue-500/20 text-blue-400',
  in_progress: 'bg-yellow-500/20 text-yellow-400',
  review: 'bg-purple-500/20 text-purple-400',
  done: 'bg-green-500/20 text-green-400',
  archived: 'bg-gray-500/20 text-gray-500',
  // Content statuses
  idea: 'bg-gray-500/20 text-gray-400',
  planned: 'bg-blue-500/20 text-blue-400',
  approved: 'bg-green-500/20 text-green-400',
  scheduled: 'bg-cyan-500/20 text-cyan-400',
  posted: 'bg-emerald-500/20 text-emerald-400',
  rejected: 'bg-red-500/20 text-red-400',
  // Pipeline statuses
  shooting: 'bg-orange-500/20 text-orange-400',
  shot: 'bg-amber-500/20 text-amber-400',
  edited: 'bg-teal-500/20 text-teal-400',
  captions: 'bg-indigo-500/20 text-indigo-400',
  client_approval: 'bg-pink-500/20 text-pink-400',
  // Design statuses
  brief: 'bg-blue-500/20 text-blue-400',
  internal_review: 'bg-purple-500/20 text-purple-400',
  client_review: 'bg-pink-500/20 text-pink-400',
  revision: 'bg-orange-500/20 text-orange-400',
  // Campaign statuses
  active: 'bg-green-500/20 text-green-400',
  paused: 'bg-yellow-500/20 text-yellow-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
  draft: 'bg-gray-500/20 text-gray-400',
  // Influencer statuses
  prospecting: 'bg-gray-500/20 text-gray-400',
  contacted: 'bg-blue-500/20 text-blue-400',
  negotiating: 'bg-yellow-500/20 text-yellow-400',
  confirmed: 'bg-green-500/20 text-green-400',
  declined: 'bg-red-500/20 text-red-400',
  // Shoot statuses
  cancelled: 'bg-red-500/20 text-red-400',
};

export default function StatusBadge({ status }: { status: string }) {
  const color = statusColors[status] || 'bg-gray-500/20 text-gray-400';
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{label}</span>;
}
