'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ListingCard from '@/components/ListingCard'
import type { Listing } from '@/lib/types'
import { DZONGKHAGS, PROPERTY_TYPES } from '@/lib/types'
import { Search, SlidersHorizontal, X } from 'lucide-react'

function ListingsContent() {
  const params = useSearchParams()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const supabase = createClient()
  const [q, setQ] = useState(params.get('q') || '')
  const [dzongkhag, setDzongkhag] = useState(params.get('dzongkhag') || '')
  const [type, setType] = useState(params.get('type') || '')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [minBeds, setMinBeds] = useState('')
  const [featured, setFeatured] = useState(params.get('featured') === 'true')
  const [sort, setSort] = useState('newest')

  const loadListings = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('listings').select('*, profiles(full_name,role)', { count: 'exact' })
      .eq('status', 'active')
    if (q) query = query.ilike('title', `%${q}%`)
    if (dzongkhag) query = query.eq('dzongkhag', dzongkhag)
    if (type) query = query.eq('property_type', type)
    if (minPrice) query = query.gte('price', parseFloat(minPrice))
    if (maxPrice) query = query.lte('price', parseFloat(maxPrice))
    if (minBeds) query = query.gte('bedrooms', parseInt(minBeds))
    if (featured) query = query.eq('is_featured', true)
    if (sort === 'newest') query = query.order('created_at', { ascending: false })
    else if (sort === 'price_asc') query = query.order('price', { ascending: true })
    else if (sort === 'price_desc') query = query.order('price', { ascending: false })
    const { data, count } = await query.limit(24)
    setListings(data || [])
    setTotal(count || 0)
    setLoading(false)
  }, [q, dzongkhag, type, minPrice, maxPrice, minBeds, featured, sort])

  useEffect(() => { loadListings() }, [loadListings])

  function clearFilters() {
    setQ(''); setDzongkhag(''); setType(''); setMinPrice(''); setMaxPrice(''); setMinBeds(''); setFeatured(false); setSort('newest')
  }
  const hasFilters = q || dzongkhag || type || minPrice || maxPrice || minBeds || featured

  return (
    <div className="container-main page-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 className="section-title">Properties</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>{loading ? 'Loading...' : `${total} listings found`}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search..."
              className="input-field" style={{ paddingLeft: 32, width: 180 }} />
          </div>
          <select value={sort} onChange={e => setSort(e.target.value)} className="input-field" style={{ width: 'auto' }}>
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
          <button onClick={() => setShowFilters(!showFilters)} className="btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <SlidersHorizontal size={14} />Filters
            {hasFilters && <span style={{ background: 'var(--forest)', color: 'white', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>!</span>}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="card" style={{ padding: 18, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--charcoal)' }}>Filters</span>
            {hasFilters && <button onClick={clearFilters} className="btn-ghost" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><X size={12} />Clear all</button>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
            <div><label className="label">Dzongkhag</label>
              <select value={dzongkhag} onChange={e => setDzongkhag(e.target.value)} className="input-field">
                <option value="">All</option>
                {DZONGKHAGS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div><label className="label">Type</label>
              <select value={type} onChange={e => setType(e.target.value)} className="input-field">
                <option value="">All</option>
                {PROPERTY_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div><label className="label">Min Price (Nu.)</label>
              <input type="number" value={minPrice} onChange={e => setMinPrice(e.target.value)} className="input-field" placeholder="0" /></div>
            <div><label className="label">Max Price (Nu.)</label>
              <input type="number" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} className="input-field" placeholder="Any" /></div>
            <div><label className="label">Min Bedrooms</label>
              <select value={minBeds} onChange={e => setMinBeds(e.target.value)} className="input-field">
                <option value="">Any</option>
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}+</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 18 }}>
              <input type="checkbox" id="feat" checked={featured} onChange={e => setFeatured(e.target.checked)} style={{ width: 15, height: 15, accentColor: 'var(--forest)' }} />
              <label htmlFor="feat" style={{ fontSize: 13, color: 'var(--charcoal)', cursor: 'pointer' }}>Featured only</label>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {(['All', ...PROPERTY_TYPES.map(p => p.label)]).map((label, idx) => {
          const val = idx === 0 ? '' : PROPERTY_TYPES[idx-1].value
          const active = idx === 0 ? !type : type === val
          return (
            <button key={val || 'all'} onClick={() => setType(active && idx !== 0 ? '' : val)}
              style={{ padding: '6px 14px', borderRadius: 20, border: '1.5px solid', borderColor: active ? 'var(--forest)' : 'var(--border)', background: active ? 'var(--forest)' : 'transparent', color: active ? 'white' : 'var(--muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.2s' }}>
              {String(label)}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 18 }}>
          {[...Array(6)].map((_, i) => <div key={i} className="card" style={{ height: 260, background: 'var(--cream-dark)' }} />)}
        </div>
      ) : listings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
          <Search size={36} style={{ margin: '0 auto 12px', color: 'var(--sage)' }} />
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--charcoal-mid)', marginBottom: 8 }}>No properties found</h3>
          <p style={{ fontSize: 14 }}>Try adjusting your filters</p>
          {hasFilters && <button onClick={clearFilters} className="btn-primary" style={{ marginTop: 14 }}>Clear filters</button>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 18 }}>
          {listings.map(l => <ListingCard key={l.id} listing={l} />)}
        </div>
      )}
    </div>
  )
}

export default function ListingsPage() {
  return <Suspense fallback={<div className="container-main page-pad" style={{ color: 'var(--muted)' }}>Loading...</div>}><ListingsContent /></Suspense>
}
