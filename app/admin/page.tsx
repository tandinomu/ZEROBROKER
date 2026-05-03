'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Listing, Profile } from '@/lib/types'
import { formatPrice } from '@/lib/types'
import toast from 'react-hot-toast'
import { CheckCircle, XCircle, Shield, Home, Users } from 'lucide-react'

export default function AdminPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [pendingListings, setPendingListings] = useState<Listing[]>([])
  const [brokers, setBrokers] = useState<any[]>([])
  const [users, setUsers] = useState<Profile[]>([])
  const [tab, setTab] = useState<'listings'|'brokers'|'users'>('listings')
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!prof || prof.role !== 'admin') { toast.error('Admin access required'); router.push('/'); return }
      setProfile(prof)
      const [{ data: pl }, { data: br }, { data: us }] = await Promise.all([
        supabase.from('listings').select('*, profiles(full_name,phone,role)').eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('broker_profiles').select('*, profiles(full_name,phone,email:id)').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(50),
      ])
      setPendingListings(pl || [])
      setBrokers(br || [])
      setUsers(us || [])
      setLoading(false)
    }
    load()
  }, [])

  async function approveListing(id: string) {
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('listings').update({
      status: 'active', approved_at: new Date().toISOString(), approved_by: user?.id
    }).eq('id', id)
    if (error) { toast.error(error.message); return }
    setPendingListings(prev => prev.filter(l => l.id !== id))
    toast.success('Listing approved and now live!')
  }

  async function rejectListing(id: string) {
    const { error } = await supabase.from('listings').update({ status: 'paused' }).eq('id', id)
    if (error) { toast.error(error.message); return }
    setPendingListings(prev => prev.filter(l => l.id !== id))
    toast.success('Listing rejected')
  }

  async function verifyBroker(userId: string, verified: boolean) {
    await supabase.from('broker_profiles').update({ is_verified: verified }).eq('user_id', userId)
    await supabase.from('profiles').update({ is_verified: verified }).eq('id', userId)
    setBrokers(prev => prev.map(b => b.user_id === userId ? { ...b, is_verified: verified } : b))
    toast.success(verified ? 'Broker verified!' : 'Verification removed')
  }

  if (loading) return <div className="container-main page-pad" style={{ color: 'var(--muted)' }}>Loading admin panel...</div>

  const tabs = [
    { id: 'listings', label: `Pending Listings (${pendingListings.length})`, icon: <Home size={14} /> },
    { id: 'brokers', label: `Brokers (${brokers.length})`, icon: <Shield size={14} /> },
    { id: 'users', label: `All Users (${users.length})`, icon: <Users size={14} /> },
  ]

  return (
    <div className="container-main page-pad">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--forest)' }}>Admin Panel</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>Manage listings, verify brokers, and oversee the platform</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Pending listings', value: pendingListings.length, color: '#FAC775' },
          { label: 'Total brokers', value: brokers.length, color: '#B5D4F4' },
          { label: 'Total users', value: users.length, color: '#C0DD97' },
          { label: 'Verified brokers', value: brokers.filter(b => b.is_verified).length, color: '#D3D1C7' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: 18, textAlign: 'center', borderTop: `3px solid ${s.color}` }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--forest)' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', border: 'none', borderBottom: tab === t.id ? '2px solid var(--forest)' : '2px solid transparent', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 600 : 400, color: tab === t.id ? 'var(--forest)' : 'var(--muted)', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* PENDING LISTINGS */}
      {tab === 'listings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {pendingListings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
              <CheckCircle size={36} style={{ margin: '0 auto 12px', color: 'var(--sage)' }} />
              <p>No pending listings. All caught up!</p>
            </div>
          ) : pendingListings.map(l => {
            const owner = l.profiles as any
            return (
              <div key={l.id} className="card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 4 }}>{l.title}</h3>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>{l.dzongkhag}{l.gewog ? ` · ${l.gewog}` : ''} · {formatPrice(l.price)}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      By: {owner?.full_name} ({owner?.role}) · {new Date(l.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => approveListing(l.id)} className="btn-primary" style={{ fontSize: 12, padding: '7px 14px', background: '#1D9E75', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <CheckCircle size={13} />Approve
                    </button>
                    <button onClick={() => rejectListing(l.id)} style={{ fontSize: 12, padding: '7px 14px', borderRadius: 8, border: '1.5px solid #e24b4a', color: '#e24b4a', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-body)' }}>
                      <XCircle size={13} />Reject
                    </button>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: 'var(--charcoal-mid)', lineHeight: 1.6, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  {l.description.length > 200 ? l.description.slice(0, 200) + '...' : l.description}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {/* BROKERS */}
      {tab === 'brokers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {brokers.map(b => {
            const prof = b.profiles as any
            return (
              <div key={b.id} className="card" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14, fontWeight: 600 }}>
                    {prof?.full_name?.[0]}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--charcoal)' }}>{prof?.full_name}</span>
                      {b.is_verified && <span style={{ fontSize: 10, background: 'rgba(26,58,42,0.1)', color: 'var(--forest)', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>Verified</span>}
                    </div>
                    {b.license_number && <div style={{ fontSize: 12, color: 'var(--muted)' }}>License: {b.license_number}</div>}
                    {b.specialization && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{b.specialization}</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {!b.is_verified ? (
                    <button onClick={() => verifyBroker(b.user_id, true)} className="btn-primary" style={{ fontSize: 12, padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Shield size={13} />Verify
                    </button>
                  ) : (
                    <button onClick={() => verifyBroker(b.user_id, false)} style={{ fontSize: 12, padding: '7px 14px', borderRadius: 8, border: '1.5px solid var(--border)', color: 'var(--muted)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                      Remove verification
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* USERS */}
      {tab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {users.map(u => (
            <div key={u.id} className="card" style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 13, fontWeight: 600 }}>
                  {u.full_name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--charcoal)' }}>{u.full_name}</div>
                  {u.phone && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{u.phone}</div>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--cream-dark)', color: 'var(--charcoal-mid)', textTransform: 'capitalize', fontWeight: 600 }}>{u.role}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{new Date(u.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
