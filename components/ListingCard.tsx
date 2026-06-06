import Link from 'next/link'
import type { Listing } from '@/lib/types'
import { formatPrice, STATUS_CONFIG, PROPERTY_TYPES } from '@/lib/types'
import { MapPin, Bed, Bath, Maximize, Star, ShieldCheck } from 'lucide-react'

export default function ListingCard({ listing }: { listing: Listing }) {
  const status = STATUS_CONFIG[listing.status]
  const propType = PROPERTY_TYPES.find(p => p.value === listing.property_type)
  const image = listing.images?.[0] || `https://picsum.photos/seed/${listing.id}/400/250`

  return (
    <Link href={`/listings/${listing.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div className="card card-hover" style={{ overflow: 'hidden', cursor: 'pointer' }}>
        <div style={{ position: 'relative', height: 190, overflow: 'hidden', background: 'var(--cream-dark)' }}>
          <img src={image} alt={listing.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => { e.currentTarget.src = `https://picsum.photos/seed/${listing.id}/400/250` }} />
          <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {listing.is_featured && (
              <span style={{ background: 'var(--gold)', color: 'white', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 3 }}>
                <Star size={9} fill="white" />Featured
              </span>
            )}
            {listing.is_verified && (
              <span style={{ background: '#C0DD97', color: '#27500A', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 3 }}>
                <ShieldCheck size={9} />Verified
              </span>
            )}
          </div>
          <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
            <span style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(4px)', borderRadius: 8, padding: '3px 8px', fontSize: 11, color: 'var(--charcoal-mid)', fontWeight: 500 }}>
              {propType?.label}
            </span>
            <span style={{ background: status.bg, color: status.color, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20 }}>
              {status.label}
            </span>
          </div>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(26,58,42,0.85))', padding: '24px 12px 10px' }}>
            <div style={{ color: 'white', fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700 }}>
              {formatPrice(listing.price)}
            </div>
          </div>
        </div>
        <div style={{ padding: '12px 14px' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {listing.title}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--muted)', fontSize: 12, marginBottom: 10 }}>
            <MapPin size={11} />
            <span>{listing.location_name}{listing.gewog ? `, ${listing.gewog}` : ''}, {listing.dzongkhag}</span>
          </div>
          {(listing.bedrooms || listing.bathrooms || listing.area_sqft) && (
            <div style={{ display: 'flex', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              {listing.bedrooms && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--charcoal-mid)' }}>
                  <Bed size={12} />{listing.bedrooms} bed
                </span>
              )}
              {listing.bathrooms && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--charcoal-mid)' }}>
                  <Bath size={12} />{listing.bathrooms} bath
                </span>
              )}
              {listing.area_sqft && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--charcoal-mid)' }}>
                  <Maximize size={12} />{listing.area_sqft.toLocaleString()} sqft
                </span>
              )}
            </div>
          )}
          {!listing.bedrooms && !listing.bathrooms && listing.area_sqft && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--charcoal-mid)' }}>
                <Maximize size={12} />{listing.area_sqft.toLocaleString()} sqft
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
