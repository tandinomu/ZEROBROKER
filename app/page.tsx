'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ListingCard from '@/components/ListingCard'
import type { Listing } from '@/lib/types'
import { DZONGKHAGS, PROPERTY_TYPES } from '@/lib/types'
import { Search, MapPin, Shield, TrendingUp, ArrowRight, MessageSquare, HandshakeIcon, CheckCircle } from 'lucide-react'

export default function HomePage() {
  const [listings, setListings] = useState<Listing[]>([])
  const [featured, setFeatured] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [dzongkhag, setDzongkhag] = useState('')
  const [type, setType] = useState('')
  const [stats, setStats] = useState({ listings: 0, brokers: 0 })
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const [{ data: feat }, { data: recent }, { count: lc }, { count: bc }] = await Promise.all([
        supabase.from('listings').select('*, profiles(full_name,role)').eq('is_featured', true).eq('status', 'active').limit(4),
        supabase.from('listings').select('*, profiles(full_name,role)').eq('status', 'active').order('created_at', { ascending: false }).limit(8),
        supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'broker'),
      ])
      setFeatured(feat || [])
      setListings(recent || [])
      setStats({ listings: lc || 0, brokers: bc || 0 })
      setLoading(false)
    }
    load()
  }, [])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (dzongkhag) p.set('dzongkhag', dzongkhag)
    if (type) p.set('type', type)
    router.push(`/listings?${p.toString()}`)
  }

  return (
    <div>
      {/* Hero */}
      <section className="hero-section" style={{ background: 'linear-gradient(135deg, var(--forest) 0%, var(--forest-mid) 60%, var(--forest-light) 100%)', padding: '80px 0 60px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.04, backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="container-main" style={{ position: 'relative' }}>
          <div style={{ maxWidth: 660, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.12)', borderRadius: 20, padding: '6px 14px', marginBottom: 24 }}>
              <Shield size={13} color="var(--gold-light)" />
              <span style={{ fontSize: 12, color: 'var(--gold-light)', fontWeight: 500 }}>Bhutan's first verified real estate platform</span>
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px,5vw,54px)', fontWeight: 700, color: 'white', lineHeight: 1.2, marginBottom: 18 }}>
              Find Your Property<br />Across Bhutan
            </h1>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.75)', marginBottom: 32, lineHeight: 1.7 }}>
              Browse verified listings from licensed brokers and direct sellers across all 20 Dzongkhags.
            </p>
            <form onSubmit={handleSearch} style={{ background: 'white', borderRadius: 14, padding: 10, display: 'flex', flexWrap: 'wrap', gap: 8, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
              <div style={{ flex: '1 1 160px', position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search properties..."
                  style={{ width: '100%', padding: '9px 10px 9px 32px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'var(--font-body)' }} />
              </div>
              <select value={dzongkhag} onChange={e => setDzongkhag(e.target.value)}
                style={{ flex: '1 1 120px', padding: '9px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, outline: 'none', background: 'white', fontFamily: 'var(--font-body)' }}>
                <option value="">All Dzongkhags</option>
                {DZONGKHAGS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={type} onChange={e => setType(e.target.value)}
                style={{ flex: '1 1 110px', padding: '9px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, outline: 'none', background: 'white', fontFamily: 'var(--font-body)' }}>
                <option value="">All Types</option>
                {PROPERTY_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <button type="submit" className="btn-primary" style={{ borderRadius: 8, padding: '9px 18px' }}>Search</button>
            </form>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section style={{ background: 'var(--white)', borderBottom: '1px solid var(--border)' }}>
        <div className="container-main">
          <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)' }}>
            {[
              { label: 'Active Listings', value: stats.listings, icon: <TrendingUp size={17} /> },
              { label: 'Verified Brokers', value: stats.brokers, icon: <Shield size={17} /> },
              { label: 'Dzongkhags', value: 20, icon: <MapPin size={17} /> },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '18px 0', borderRight: i < 2 ? '1px solid var(--border)' : '' }}>
                <div style={{ color: 'var(--forest)', display: 'flex', justifyContent: 'center', marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--forest)' }}>{s.value}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured */}
      {featured.length > 0 && (
        <section style={{ padding: '52px 0' }}>
          <div className="container-main">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
              <div>
                <h2 className="section-title">Featured Properties</h2>
                <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>Premium verified listings</p>
              </div>
              <Link href="/listings?featured=true" className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                View all <ArrowRight size={14} />
              </Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 18 }}>
              {featured.map(l => <ListingCard key={l.id} listing={l} />)}
            </div>
          </div>
        </section>
      )}

      {/* Recent */}
      <section style={{ padding: '0 0 52px' }}>
        <div className="container-main">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
            <div>
              <h2 className="section-title">Recent Listings</h2>
              <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>Newly added properties</p>
            </div>
            <Link href="/listings" className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 18 }}>
              {[...Array(4)].map((_, i) => <div key={i} className="card" style={{ height: 260, background: 'var(--cream-dark)' }} />)}
            </div>
          ) : listings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
              <Search size={36} style={{ margin: '0 auto 12px', color: 'var(--sage)' }} />
              <p>No listings yet. Be the first to list a property!</p>
              <Link href="/auth/register" className="btn-primary" style={{ marginTop: 16, display: 'inline-flex' }}>Get Started</Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 18 }}>
              {listings.map(l => <ListingCard key={l.id} listing={l} />)}
            </div>
          )}
        </div>
      </section>

      {/* How it works */}
      <section style={{ background: 'var(--forest)', padding: '56px 0' }}>
        <div className="container-main">
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'white', textAlign: 'center', marginBottom: 36 }}>How Zero Broker Works</h2>
          <div className="how-it-works" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 16 }}>
            {[
              { step: '1', icon: <Search size={20} />, title: 'Browse', desc: 'Search listings across all Dzongkhags with filters' },
              { step: '2', icon: <MessageSquare size={20} />, title: 'Enquire', desc: 'Send a direct message to sellers securely' },
              { step: '3', icon: <HandshakeIcon size={20} />, title: 'Negotiate', desc: 'Connect and negotiate directly off-platform' },
              { step: '4', icon: <CheckCircle size={20} />, title: 'Confirm', desc: 'Both parties confirm the deal on Zero Broker' },
            ].map(s => (
              <div key={s.step} style={{ textAlign: 'center', padding: '16px 10px' }}>
                <div style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.1)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: 'var(--gold-light)' }}>{s.icon}</div>
                <div style={{ fontSize: 9, color: 'var(--gold-light)', fontWeight: 700, letterSpacing: 1, marginBottom: 5 }}>STEP {s.step}</div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'white', marginBottom: 5 }}>{s.title}</h3>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: 'var(--charcoal)', padding: '32px 0 18px' }}>
        <div className="container-main">
          <div className="footer-cols" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20, marginBottom: 20 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'white', fontWeight: 700, marginBottom: 6 }}>Zero Broker</div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, maxWidth: 220 }}>Bhutan's first centralized real estate platform.</p>
            </div>
            <div style={{ display: 'flex', gap: 36 }}>
              {[
                { title: 'Platform', links: [['Browse', '/listings'], ['Brokers', '/brokers'], ['Map', '/map']] },
                { title: 'Account', links: [['Register', '/auth/register'], ['Login', '/auth/login'], ['Dashboard', '/dashboard']] },
              ].map(col => (
                <div key={col.title}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: 1, marginBottom: 10 }}>{col.title.toUpperCase()}</div>
                  {col.links.map(([label, href]) => (
                    <Link key={href} href={href} style={{ display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: 13, textDecoration: 'none', marginBottom: 6 }}>{label}</Link>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14 }}>
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>© 2026 Zero Broker · IDE303 Software Engineering Startup · CST Bhutan</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
