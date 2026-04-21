const colors: Record<string, string> = {
  urgent: 'bg-red-500/20 text-red-400',
  high: 'bg-orange-500/20 text-orange-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  low: 'bg-gray-100 text-gray-500',
};

export default function PriorityBadge({ priority }: { priority: string }) {
  const color = colors[priority] || colors.medium;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</span>;
}
