'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Search, Star, Shield } from 'lucide-react'

export default function BrokersPage() {
  const [brokers, setBrokers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const supabase = createClient()

  useEffect(() => {
    supabase.from('broker_profiles').select('*, profiles(full_name,phone,avatar_url)')
      .order('avg_rating', { ascending: false })
      .then(({ data }) => { setBrokers(data || []); setLoading(false) })
  }, [])

  const filtered = brokers.filter(b => !q || b.profiles?.full_name?.toLowerCase().includes(q.toLowerCase()) || b.specialization?.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="container-main page-pad">
      <div style={{ marginBottom: 28 }}>
        <h1 className="section-title">Find a Broker</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 6, marginBottom: 18 }}>Work with licensed and verified real estate brokers across Bhutan</p>
        <div style={{ position: 'relative', maxWidth: 380 }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or specialization..."
            className="input-field" style={{ paddingLeft: 32 }} />
        </div>
      </div>
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(270px,1fr))', gap: 18 }}>
          {[...Array(4)].map((_, i) => <div key={i} className="card" style={{ height: 190, background: 'var(--cream-dark)' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
          <p>No brokers found</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(270px,1fr))', gap: 18 }}>
          {filtered.map(b => (
            <Link key={b.id} href={`/brokers/${b.user_id}`} style={{ textDecoration: 'none' }}>
              <div className="card card-hover" style={{ padding: 22 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 18, fontWeight: 700, flexShrink: 0 }}>
                    {b.profiles?.full_name?.[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--charcoal)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.profiles?.full_name}
                      </span>
                      {b.is_verified && <Shield size={13} color="var(--forest)" fill="var(--forest)" />}
                    </div>
                    {b.specialization && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{b.specialization}</div>}
                  </div>
                </div>
                {b.bio && <p style={{ fontSize: 12, color: 'var(--charcoal-mid)', lineHeight: 1.5, marginBottom: 12, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{b.bio}</p>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    {[...Array(5)].map((_, i) => <Star key={i} size={12} fill={i < Math.round(b.avg_rating) ? '#c9a84c' : 'none'} color="#c9a84c" />)}
                    <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 4 }}>{b.total_reviews} reviews</span>
                  </div>
                  {b.years_experience > 0 && <span style={{ fontSize: 11, color: 'var(--muted)', padding: '2px 8px', background: 'var(--cream-dark)', borderRadius: 10 }}>{b.years_experience}y exp</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
