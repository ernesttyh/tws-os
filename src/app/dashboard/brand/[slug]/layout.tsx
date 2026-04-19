import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import BrandTabs from '@/components/BrandTabs'

export default async function BrandLayout({ 
  children, 
  params 
}: { 
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: brand } = await supabase
    .from('brands')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!brand) notFound()

  return (
    <div>
      <div className="flex items-center gap-2 sm:gap-3 mb-1">
        <Link href="/dashboard" className="text-xs" style={{ color: 'var(--text-secondary)' }}>Dashboard</Link>
        <span style={{ color: 'var(--text-secondary)' }}>/</span>
        <span className="text-xs sm:text-sm font-medium truncate">{brand.name}</span>
      </div>
      
      <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-base sm:text-lg font-bold shrink-0"
          style={{ background: 'var(--accent)' + '20', color: 'var(--accent)' }}>
          {brand.name.charAt(0)}
        </div>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold truncate">{brand.name}</h1>
          <span className="badge badge-neutral text-[10px] sm:text-xs">{brand.brand_group.replace('_', ' ')}</span>
        </div>
      </div>

      <BrandTabs slug={slug} />

      <div className="mt-3 sm:mt-4">
        {children}
      </div>
    </div>
  )
}
