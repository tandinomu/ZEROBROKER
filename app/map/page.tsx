'use client'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatPrice, PROPERTY_TYPES } from '@/lib/types'
import { MapPin, ExternalLink } from 'lucide-react'

// Load Leaflet only on the client — it requires the browser DOM
const PropertyMapLeaflet = dynamic(
  () => import('@/components/PropertyMapLeaflet'),
  { ssr: false, loading: () => (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream-dark)' }}>
      <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
        <MapPin size={28} style={{ margin: '0 auto 10px', color: 'var(--sage)' }} />
        <p style={{ fontSize: 13 }}>Loading map…</p>
      </div>
    </div>
  )}
)

export default function MapPage() {
  const [listings, setListings] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('listings')
      .select('*')
      .in('status', ['approved', 'active', 'enquiring', 'negotiating'])
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .limit(100)
      .then(({ data }) => { setListings(data || []); setLoading(false) })
  }, [])

  return (
    <div className="map-layout" style={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
      {/* Sidebar */}
      <div
        className="map-sidebar"
        style={{ width: 340, flexShrink: 0, background: 'var(--white)', borderRight: '1px solid var(--border)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ padding: '18px 16px', borderBottom: '1px solid var(--border)' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, color: 'var(--forest)', marginBottom: 3 }}>Map View</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            {loading ? 'Loading…' : `${listings.length} properties with location`}
          </p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
          {!loading && listings.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
              <MapPin size={28} style={{ margin: '0 auto 10px', color: 'var(--sage)' }} />
              <p style={{ fontSize: 13 }}>No properties with location data yet</p>
              <Link href="/listings" style={{ fontSize: 13, color: 'var(--forest)', textDecoration: 'none', display: 'block', marginTop: 8 }}>
                Browse all listings
              </Link>
            </div>
          ) : (
            listings.map(l => {
              const propType = PROPERTY_TYPES.find(p => p.value === l.property_type)
              const isSelected = selected?.id === l.id
              return (
                <div
                  key={l.id}
                  onClick={() => setSelected(isSelected ? null : l)}
                  style={{ padding: '10px', borderRadius: 8, marginBottom: 6, cursor: 'pointer', border: isSelected ? '1.5px solid var(--forest)' : '1.5px solid var(--border)', background: isSelected ? 'rgba(26,58,42,0.04)' : 'var(--white)', transition: 'all 0.2s' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 2 }}>{l.title}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--muted)' }}>
                        <MapPin size={10} />{l.location_name}, {l.dzongkhag}
                      </div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--forest)', flexShrink: 0, marginLeft: 8 }}>
                      {formatPrice(l.price)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'var(--cream-dark)', color: 'var(--muted)' }}>
                      {propType?.label}
                    </span>
                    {l.bedrooms && (
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'var(--cream-dark)', color: 'var(--muted)' }}>
                        {l.bedrooms} bed
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', gap: 6 }}>
                      <Link
                        href={`/listings/${l.id}`}
                        className="btn-primary"
                        style={{ textDecoration: 'none', fontSize: 11, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 3 }}
                      >
                        View <ExternalLink size={10} />
                      </Link>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Map */}
      <div className="map-iframe" style={{ flex: 1, position: 'relative', minHeight: 400 }}>
        <PropertyMapLeaflet
          listings={listings}
          selected={selected}
          onSelect={setSelected}
        />
        {listings.length > 0 && !selected && (
          <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 1000, background: 'white', borderRadius: 8, padding: '8px 12px', boxShadow: 'var(--shadow-md)', fontSize: 12, color: 'var(--muted)' }}>
            Click a pin or sidebar item to zoom in
          </div>
        )}
      </div>
    </div>
  )
}
