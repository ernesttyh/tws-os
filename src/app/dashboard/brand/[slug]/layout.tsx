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

  const sheetUrl = brand.google_sheet_id 
    ? `https://docs.google.com/spreadsheets/d/${brand.google_sheet_id}/edit` 
    : null;

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
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 sm:gap-3">
            <h1 className="text-lg sm:text-xl font-bold truncate">{brand.name}</h1>
            {sheetUrl && (
              <a
                href={sheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition shrink-0"
                title="Open Google Sheet"
              >
                <svg viewBox="0 0 24 24" className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <span className="hidden sm:inline">Google Sheet</span>
                <span className="sm:hidden">Sheet</span>
                <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            )}
          </div>
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
