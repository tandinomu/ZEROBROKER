'use client'
import { useState, useEffect, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import ListingCard from '@/components/ListingCard'
import { Star, Shield, Phone, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function BrokerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [broker, setBroker] = useState<any>(null)
  const [listings, setListings] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const [{ data: b }, { data: l }, { data: r }] = await Promise.all([
        supabase.from('broker_profiles').select('*, profiles(*)').eq('user_id', id).single(),
        supabase.from('listings').select('*, profiles(full_name,role)').eq('owner_id', id).eq('status', 'active').limit(6),
        supabase.from('reviews').select('*, reviewer:reviewer_id(full_name)').eq('broker_id', id).order('created_at', { ascending: false }),
      ])
      setBroker(b); setListings(l || []); setReviews(r || [])
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div className="container-main page-pad" style={{ color: 'var(--muted)' }}>Loading...</div>
  if (!broker) return <div className="container-main page-pad" style={{ color: 'var(--muted)' }}>Broker not found</div>
  const prof = broker.profiles

  return (
    <div className="container-main page-pad">
      <Link href="/brokers" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--muted)', textDecoration: 'none', fontSize: 14, marginBottom: 20 }}>
        <ArrowLeft size={14} />Back to brokers
      </Link>
      <div className="layout-sidebar" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 26, alignItems: 'start' }}>
        <div>
          <div className="card" style={{ padding: 26, marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, marginBottom: 18 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 24, fontWeight: 700, flexShrink: 0 }}>
                {prof?.full_name?.[0]}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--charcoal)' }}>{prof?.full_name}</h1>
                  {broker.is_verified && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(26,58,42,0.08)', color: 'var(--forest)', padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>
                      <Shield size={11} fill="var(--forest)" />Verified
                    </span>
                  )}
                </div>
                {broker.specialization && <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 3 }}>{broker.specialization}</p>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
                  {[...Array(5)].map((_, i) => <Star key={i} size={14} fill={i < Math.round(broker.avg_rating) ? '#c9a84c' : 'none'} color="#c9a84c" />)}
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{broker.avg_rating?.toFixed(1)} ({broker.total_reviews} reviews)</span>
                </div>
              </div>
            </div>
            {broker.bio && <p style={{ color: 'var(--charcoal-mid)', lineHeight: 1.8, fontSize: 14 }}>{broker.bio}</p>}
            <div style={{ display: 'flex', gap: 20, marginTop: 16, flexWrap: 'wrap' }}>
              {broker.years_experience > 0 && <div style={{ textAlign: 'center' }}><div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--forest)' }}>{broker.years_experience}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>Years Exp.</div></div>}
              <div style={{ textAlign: 'center' }}><div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--forest)' }}>{listings.length}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>Listings</div></div>
              <div style={{ textAlign: 'center' }}><div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--forest)' }}>{broker.total_reviews}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>Reviews</div></div>
            </div>
          </div>

          {listings.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--charcoal)', marginBottom: 14 }}>Active Listings</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 14 }}>
                {listings.map(l => <ListingCard key={l.id} listing={l} />)}
              </div>
            </div>
          )}

          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--charcoal)', marginBottom: 14 }}>Reviews</h2>
            {reviews.length === 0 ? (
              <div className="card" style={{ padding: 22, textAlign: 'center', color: 'var(--muted)' }}>No reviews yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {reviews.map(r => (
                  <div key={r.id} className="card" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--charcoal)' }}>{r.reviewer?.full_name}</div>
                      <div style={{ display: 'flex', gap: 2 }}>{[...Array(5)].map((_, i) => <Star key={i} size={12} fill={i < r.rating ? '#c9a84c' : 'none'} color="#c9a84c" />)}</div>
                    </div>
                    {r.comment && <p style={{ fontSize: 13, color: 'var(--charcoal-mid)', lineHeight: 1.6 }}>{r.comment}</p>}
                    <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>{new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="sidebar-sticky" style={{ position: 'sticky', top: 80 }}>
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--charcoal)', marginBottom: 14 }}>Contact Broker</h3>
            {prof?.phone && (
              <a href={`tel:${prof.phone}`} className="btn-primary" style={{ textDecoration: 'none', width: '100%', justifyContent: 'center', display: 'flex', marginBottom: 10 }}>
                <Phone size={14} />{prof.phone}
              </a>
            )}
            {!prof?.phone && <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>Send an enquiry on any of their listings to get in touch.</p>}
            {broker.license_number && (
              <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--cream-dark)', borderRadius: 8, fontSize: 12, color: 'var(--muted)' }}>
                License: {broker.license_number}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
