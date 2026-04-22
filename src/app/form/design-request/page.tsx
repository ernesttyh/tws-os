'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Brand {
  id: string
  name: string
  slug: string
}

const ARTWORK_SPECS_OPTIONS = [
  'Instagram Post (1080x1080)',
  'Instagram Story (1080x1920)',
  'Instagram Reel Cover (1080x1920)',
  'Facebook Post (1200x630)',
  'Facebook Cover (820x312)',
  'TikTok Thumbnail (1080x1920)',
  'XHS Post (1080x1440)',
  'Menu Design',
  'Poster (A3)',
  'Poster (A4)',
  'Flyer (A5)',
  'Banner',
  'EDM / Newsletter',
  'Tent Card',
  'Table Sticker',
  'Other (specify in notes)',
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: '🟢 Low', desc: 'No rush — 5+ working days' },
  { value: 'normal', label: '🟡 Normal', desc: '3-5 working days' },
  { value: 'high', label: '🟠 High', desc: '2-3 working days' },
  { value: 'urgent', label: '🔴 Urgent', desc: 'Needs approval from manager' },
]

export default function DesignRequestForm() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [selectedSpecs, setSelectedSpecs] = useState<string[]>([])
  
  // Brand autocomplete state
  const [brandSearch, setBrandSearch] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null)
  const brandInputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  
  const [form, setForm] = useState({
    brand_id: '',
    title: '',
    deadline: '',
    dishes_to_feature: '',
    copy_messaging: '',
    artwork_specs: '',
    submission_notes: '',
    submitted_by_name: '',
    submitted_by_email: '',
    priority: 'normal',
  })

  useEffect(() => {
    supabase
      .from('brands')
      .select('id, name, slug')
      .eq('status', 'active')
      .order('name')
      .then(({ data }) => {
        if (data) setBrands(data)
      })
  }, [])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        brandInputRef.current &&
        !brandInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter brands — require 3+ chars for confidentiality (never expose full list)
  const filteredBrands = brandSearch.length >= 3
    ? brands.filter(b =>
        b.name.toLowerCase().includes(brandSearch.toLowerCase())
      ).slice(0, 3)
    : []

  const handleBrandSelect = (brand: Brand) => {
    setSelectedBrand(brand)
    setBrandSearch(brand.name)
    setForm(f => ({ ...f, brand_id: brand.id }))
    setShowSuggestions(false)
  }

  const handleBrandInputChange = (value: string) => {
    setBrandSearch(value)
    setShowSuggestions(true)
    // Clear selection if user edits the text
    if (selectedBrand && value !== selectedBrand.name) {
      setSelectedBrand(null)
      setForm(f => ({ ...f, brand_id: '' }))
    }
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
    else if (e.type === 'dragleave') setDragActive(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files?.length) {
      setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)])
    }
  }, [])

  const toggleSpec = (spec: string) => {
    setSelectedSpecs(prev => 
      prev.includes(spec) ? prev.filter(s => s !== spec) : [...prev, spec]
    )
  }

  const getMinDate = () => {
    const d = new Date()
    let days = 0
    while (days < 3) {
      d.setDate(d.getDate() + 1)
      if (d.getDay() !== 0 && d.getDay() !== 6) days++
    }
    return d.toISOString().split('T')[0]
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Upload files first
      const uploadedFiles: { name: string; url: string; size: number }[] = []
      for (const file of files) {
        const ext = file.name.split('.').pop()
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('design-briefs')
          .upload(path, file)
        
        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)
        
        const { data: urlData } = supabase.storage
          .from('design-briefs')
          .getPublicUrl(path)
        
        uploadedFiles.push({
          name: file.name,
          url: urlData.publicUrl,
          size: file.size,
        })
      }

      // Insert design brief
      const { error: insertError } = await supabase.from('design_briefs').insert({
        brand_id: form.brand_id,
        title: form.title,
        deadline: form.deadline,
        dishes_to_feature: form.dishes_to_feature,
        copy_messaging: form.copy_messaging || null,
        artwork_specs: selectedSpecs.join(', '),
        submission_notes: form.submission_notes || null,
        submitted_by_name: form.submitted_by_name,
        submitted_by_email: form.submitted_by_email || null,
        reference_files: uploadedFiles,
        priority: form.priority,
        status: 'brief',
        description: [
          form.dishes_to_feature ? `Dishes: ${form.dishes_to_feature}` : '',
          form.copy_messaging ? `Copy: ${form.copy_messaging}` : '',
          selectedSpecs.length ? `Specs: ${selectedSpecs.join(', ')}` : '',
          form.submission_notes ? `Notes: ${form.submission_notes}` : '',
        ].filter(Boolean).join('\n\n'),
      })

      if (insertError) throw insertError

      setSubmitted(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Request Submitted! 🎨</h2>
          <p className="text-gray-600 mb-6">
            Your design request has been received and added to the queue. 
            The design team will review and get started soon.
          </p>
          <button
            onClick={() => { setSubmitted(false); setForm({ brand_id: '', title: '', deadline: '', dishes_to_feature: '', copy_messaging: '', artwork_specs: '', submission_notes: '', submitted_by_name: '', submitted_by_email: '', priority: 'normal' }); setFiles([]); setSelectedSpecs([]); setBrandSearch(''); setSelectedBrand(null) }}
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 transition font-medium"
          >
            Submit Another Request
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-lg">T</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">TWS OS</h1>
            <p className="text-xs text-gray-500">Artwork Request Form</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Title Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">🎨 Artwork Request Form</h2>
          <p className="text-gray-600 text-sm">
            Submit your design request here. The design team will receive it and start working on it. 
            Please fill in all required fields (*) — <span className="text-red-500 font-medium">incomplete submissions will cause delays</span>.
          </p>
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            ⏰ Artwork requests take at least <strong>3 working days</strong> (not including weekends &amp; PH). Plan ahead!
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Your Name */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              YOUR NAME <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">So we know who submitted this request</p>
            <input
              type="text"
              required
              value={form.submitted_by_name}
              onChange={e => setForm(f => ({ ...f, submitted_by_name: e.target.value }))}
              placeholder="e.g. John"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          {/* Email */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              YOUR EMAIL
            </label>
            <p className="text-xs text-gray-500 mb-2">Optional — for follow-up questions</p>
            <input
              type="email"
              value={form.submitted_by_email}
              onChange={e => setForm(f => ({ ...f, submitted_by_email: e.target.value }))}
              placeholder="e.g. john@twsbranding.com"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          {/* Brand — Autocomplete Input */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              BRAND <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">Type at least 3 characters to search</p>
            <div className="relative">
              <input
                ref={brandInputRef}
                type="text"
                required
                value={brandSearch}
                onChange={e => handleBrandInputChange(e.target.value)}
                onFocus={() => { if (brandSearch.length >= 3) setShowSuggestions(true) }}
                placeholder="Type at least 3 letters..."
                autoComplete="off"
                className={`w-full border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none ${
                  selectedBrand
                    ? 'border-green-400 bg-green-50'
                    : 'border-gray-300'
                }`}
              />
              {selectedBrand && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <span className="text-green-600 text-sm">✓</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBrand(null)
                      setBrandSearch('')
                      setForm(f => ({ ...f, brand_id: '' }))
                      brandInputRef.current?.focus()
                    }}
                    className="text-gray-400 hover:text-gray-600 text-sm"
                  >
                    ✕
                  </button>
                </div>
              )}
              
              {/* Suggestions dropdown */}
              {showSuggestions && filteredBrands.length > 0 && !selectedBrand && (
                <div
                  ref={suggestionsRef}
                  className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto"
                >
                  {filteredBrands.map(brand => (
                    <button
                      key={brand.id}
                      type="button"
                      onClick={() => handleBrandSelect(brand)}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-indigo-50 hover:text-indigo-700 transition border-b border-gray-50 last:border-0"
                    >
                      {brand.name}
                    </button>
                  ))}
                </div>
              )}
              
              {/* No match message */}
              {showSuggestions && brandSearch.length >= 3 && filteredBrands.length === 0 && !selectedBrand && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3">
                  <p className="text-sm text-gray-500">No brand found matching &ldquo;{brandSearch}&rdquo;</p>
                  <p className="text-xs text-gray-400 mt-1">Check the spelling and try again</p>
                </div>
              )}
            </div>
            {/* Hidden required field for form validation */}
            <input
              type="hidden"
              value={form.brand_id}
              required
            />
          </div>

          {/* Title of Artwork */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              TITLE OF ARTWORK <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">e.g. National Day Special Promo, June Menu Update</p>
            <textarea
              required
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Describe the artwork you need"
              rows={2}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
            />
          </div>

          {/* Priority */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              PRIORITY <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-3">How urgently do you need this?</p>
            <div className="grid grid-cols-2 gap-2">
              {PRIORITY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, priority: opt.value }))}
                  className={`p-3 rounded-xl border-2 text-left transition ${
                    form.priority === opt.value
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-sm">{opt.label}</div>
                  <div className="text-xs text-gray-500">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Due Date */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              DUE DATE <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">
              At least 3 working days from now (not including weekends &amp; PH)
            </p>
            <input
              type="date"
              required
              min={getMinDate()}
              value={form.deadline}
              onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          {/* Dishes to Feature */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              DISHES / ITEMS TO FEATURE <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">List the items, dishes, or products to highlight</p>
            <textarea
              required
              value={form.dishes_to_feature}
              onChange={e => setForm(f => ({ ...f, dishes_to_feature: e.target.value }))}
              placeholder="e.g. 1. Signature Laksa&#10;2. Char Kway Teow&#10;3. Chili Crab"
              rows={4}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
            />
          </div>

          {/* Artwork Specs */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              ARTWORK SPECS <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-3">Select all formats needed (you can pick multiple)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ARTWORK_SPECS_OPTIONS.map(spec => (
                <button
                  key={spec}
                  type="button"
                  onClick={() => toggleSpec(spec)}
                  className={`px-3 py-2 rounded-lg border text-left text-sm transition ${
                    selectedSpecs.includes(spec)
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {selectedSpecs.includes(spec) ? '✓ ' : ''}{spec}
                </button>
              ))}
            </div>
          </div>

          {/* Copy & Messaging */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              COPY &amp; MESSAGING
            </label>
            <p className="text-xs text-gray-500 mb-2">Any text, taglines, or captions to include in the artwork</p>
            <textarea
              value={form.copy_messaging}
              onChange={e => setForm(f => ({ ...f, copy_messaging: e.target.value }))}
              placeholder="e.g. &quot;Limited Time Only!&quot; + pricing info + restaurant address"
              rows={3}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
            />
          </div>

          {/* Reference Artwork Upload */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              REFERENCE ARTWORK / STYLE GUIDE <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-3">Upload reference images, style guides, or mood boards</p>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition cursor-pointer ${
                dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'
              }`}
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <svg className="w-10 h-10 text-gray-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-gray-600">
                Drop files here or <span className="text-indigo-600 font-medium">click to upload</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">PNG, JPG, PDF, AI up to 10MB each</p>
              <input
                id="file-upload"
                type="file"
                multiple
                accept="image/*,.pdf,.ai,.psd,.fig"
                className="hidden"
                onChange={e => {
                  if (e.target.files?.length) setFiles(prev => [...prev, ...Array.from(e.target.files!)])
                }}
              />
            </div>
            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2 text-sm">
                    <span className="text-gray-400">📎</span>
                    <span className="flex-1 truncate text-gray-700">{file.name}</span>
                    <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)}KB</span>
                    <button
                      type="button"
                      onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                      className="text-red-400 hover:text-red-600"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submission Notes */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              ADDITIONAL NOTES
            </label>
            <p className="text-xs text-gray-500 mb-2">Any other details the designer should know</p>
            <textarea
              value={form.submission_notes}
              onChange={e => setForm(f => ({ ...f, submission_notes: e.target.value }))}
              placeholder="e.g. Match the style of last month's promo post. Boss wants red theme."
              rows={3}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
            />
          </div>

          {/* Warning */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <p className="text-red-700 text-sm font-medium">
              ⚠️ Incomplete information will result in delay of artwork
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !form.brand_id || !form.title || !form.deadline || !form.dishes_to_feature || !form.submitted_by_name || selectedSpecs.length === 0}
            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold text-base hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Submitting...
              </span>
            ) : '🎨 Submit Design Request'}
          </button>

          <p className="text-center text-xs text-gray-400 pb-8">
            Powered by TWS OS
          </p>
        </form>
      </div>
    </div>
  )
}
