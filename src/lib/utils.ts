import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-SG', {
    day: 'numeric', month: 'short', year: 'numeric'
  })
}

export function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - new Date().getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item)
    if (!acc[k]) acc[k] = []
    acc[k].push(item)
    return acc
  }, {} as Record<string, T[]>)
}
