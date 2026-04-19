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
      <div className="flex items-center gap-3 mb-1">
        <Link href="/dashboard" className="text-xs" style={{ color: 'var(--text-secondary)' }}>Dashboard</Link>
        <span style={{ color: 'var(--text-secondary)' }}>/</span>
        <span className="text-sm font-medium">{brand.name}</span>
      </div>
      
      <div className="flex items-center gap-4 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
          style={{ background: 'var(--accent)' + '20', color: 'var(--accent)' }}>
          {brand.name.charAt(0)}
        </div>
        <div>
          <h1 className="text-xl font-bold">{brand.name}</h1>
          <span className="badge badge-neutral text-xs">{brand.brand_group.replace('_', ' ')}</span>
        </div>
      </div>

      <BrandTabs slug={slug} />

      <div className="mt-4">
        {children}
      </div>
    </div>
  )
}
