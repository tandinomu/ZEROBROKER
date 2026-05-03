'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ListingCard from '@/components/ListingCard'
import type { Profile, Listing, Enquiry, Notification } from '@/lib/types'
import { formatPrice, STATUS_CONFIG } from '@/lib/types'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { Bell, Home, MessageCircle, Heart, User, CheckCircle, AlertCircle, Clock, Trash2, Edit, Plus, LayoutDashboard } from 'lucide-react'

function DashboardContent() {
  const params = useSearchParams()
  const router = useRouter()
  const [tab, setTab] = useState(params.get('tab') || 'overview')
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [myListings, setMyListings] = useState<Listing[]>([])
  const [myEnquiries, setMyEnquiries] = useState<Enquiry[]>([])
  const [receivedEnquiries, setReceivedEnquiries] = useState<Enquiry[]>([])
  const [saved, setSaved] = useState<any[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { router.push('/auth/login'); return }
      setUser(u)
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', u.id).single()
      setProfile(prof)
      const [{ data: listings }, { data: enquiries }, { data: received }, { data: savedData }, { data: notifs }] = await Promise.all([
        supabase.from('listings').select('*, profiles(full_name,role)').eq('owner_id', u.id).order('created_at', { ascending: false }),
        supabase.from('enquiries').select('*, listings(title,price,images,status,dzongkhag,gewog,location_name,property_type,is_featured,owner_id,id), seller:seller_id(full_name,phone)').eq('buyer_id', u.id).order('created_at', { ascending: false }),
        supabase.from('enquiries').select('*, listings(title,price,images,id,status,dzongkhag,location_name,property_type,is_featured,owner_id), buyer:buyer_id(full_name,phone,id)').eq('seller_id', u.id).order('created_at', { ascending: false }),
        supabase.from('saved_listings').select('*, listings(*, profiles(full_name,role))').eq('user_id', u.id),
        supabase.from('notifications').select('*').eq('user_id', u.id).order('created_at', { ascending: false }).limit(20),
      ])
      setMyListings(listings || [])
      setMyEnquiries(enquiries || [])
      setReceivedEnquiries(received || [])
      setSaved(savedData || [])
      setNotifications(notifs || [])
      setLoading(false)
    }
    load()
  }, [])

  async function deleteListing(id: string) {
    if (!confirm('Delete this listing? This cannot be undone.')) return
    await supabase.from('listings').delete().eq('id', id)
    setMyListings(prev => prev.filter(l => l.id !== id))
    toast.success('Listing deleted')
  }

  async function updateEnquiryStatus(id: string, status: string) {
    await supabase.from('enquiries').update({ status }).eq('id', id)
    setReceivedEnquiries(prev => prev.map(e => e.id === id ? { ...e, status: status as any } : e))
    toast.success(`Enquiry ${status}`)
  }

  async function confirmDeal(enquiryId: string, isSeller: boolean) {
    const field = isSeller ? 'seller_confirmed_deal' : 'buyer_confirmed_deal'
    const { error } = await supabase.from('enquiries').update({ [field]: true }).eq('id', enquiryId)
    if (error) { toast.error(error.message); return }
    const update = (arr: Enquiry[]) => arr.map(e => e.id === enquiryId ? { ...e, [field]: true } : e)
    setMyEnquiries(update); setReceivedEnquiries(update)
    toast.success('Deal confirmed!')
  }

  async function markNotifRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  const unread = notifications.filter(n => !n.is_read).length
  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const canList = profile?.role === 'seller' || profile?.role === 'broker' || profile?.role === 'admin'

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={14} /> },
    ...(canList ? [{ id: 'listings', label: 'My Listings', icon: <Home size={14} /> }] : []),
    { id: 'enquiries', label: 'My Enquiries', icon: <MessageCircle size={14} /> },
    ...(canList ? [{ id: 'received', label: 'Received Enquiries', icon: <MessageCircle size={14} /> }] : []),
    { id: 'saved', label: 'Saved', icon: <Heart size={14} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={14} />, badge: unread },
    { id: 'profile', label: 'Profile', icon: <User size={14} /> },
  ]

  if (loading) return <div className="container-main page-pad" style={{ textAlign: 'center', color: 'var(--muted)' }}>Loading dashboard...</div>

  return (
    <div className="container-main page-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--forest)' }}>Dashboard</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>Welcome back, {firstName}</p>
        </div>
        {canList && (
          <Link href="/listings/new" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={15} />New Listing
          </Link>
        )}
      </div>

      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', marginBottom: 24, overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '10px 12px', border: 'none', borderBottom: tab === t.id ? '2px solid var(--forest)' : '2px solid transparent', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 600 : 400, color: tab === t.id ? 'var(--forest)' : 'var(--muted)', whiteSpace: 'nowrap', fontFamily: 'var(--font-body)', position: 'relative' }}>
            {t.icon}{t.label}
            {(t as any).badge ? <span style={{ background: '#e24b4a', color: 'white', borderRadius: '50%', width: 15, height: 15, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{(t as any).badge}</span> : null}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14, marginBottom: 24 }}>
            {[
              { label: 'My Listings', value: myListings.length, icon: <Home size={20} /> },
              { label: 'My Enquiries', value: myEnquiries.length, icon: <MessageCircle size={20} /> },
              { label: 'Saved Properties', value: saved.length, icon: <Heart size={20} /> },
              { label: 'Notifications', value: unread, icon: <Bell size={20} /> },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: 20, textAlign: 'center' }}>
                <div style={{ color: 'var(--forest)', display: 'flex', justifyContent: 'center', marginBottom: 8 }}>{s.icon}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: 'var(--forest)' }}>{s.value}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>
          {receivedEnquiries.length > 0 && (
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--charcoal)', marginBottom: 12 }}>Recent Enquiries on Your Listings</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {receivedEnquiries.slice(0, 3).map(e => (
                  <div key={e.id} className="card" style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal)' }}>{(e as any).buyer?.full_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>on {(e.listings as any)?.title}</div>
                    </div>
                    <span className="status-badge" style={{ background: 'var(--cream-dark)', color: 'var(--charcoal-mid)' }}>{e.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MY LISTINGS */}
      {tab === 'listings' && (
        <div>
          {myListings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
              <Home size={36} style={{ margin: '0 auto 12px', color: 'var(--sage)' }} />
              <p>No listings yet</p>
              <Link href="/listings/new" className="btn-primary" style={{ marginTop: 14, display: 'inline-flex' }}>Create first listing</Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 18 }}>
              {myListings.map(l => (
                <div key={l.id} style={{ position: 'relative' }}>
                  <ListingCard listing={l} />
                  <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 5, zIndex: 10 }}>
                    <Link href={`/listings/${l.id}/edit`} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 7px', textDecoration: 'none', color: 'var(--charcoal)', display: 'flex', alignItems: 'center' }}>
                      <Edit size={13} />
                    </Link>
                    <button onClick={() => deleteListing(l.id)} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 7px', cursor: 'pointer', color: '#e24b4a', display: 'flex', alignItems: 'center' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MY ENQUIRIES */}
      {tab === 'enquiries' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {myEnquiries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
              <MessageCircle size={36} style={{ margin: '0 auto 12px', color: 'var(--sage)' }} />
              <p>No enquiries yet</p>
              <Link href="/listings" className="btn-primary" style={{ marginTop: 14, display: 'inline-flex' }}>Browse properties</Link>
            </div>
          ) : myEnquiries.map(e => {
            const lst = e.listings as any
            const statusKey = (lst?.status || 'active') as keyof typeof STATUS_CONFIG
            const status = STATUS_CONFIG[statusKey] || STATUS_CONFIG.active
            return (
              <div key={e.id} className="card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  <div>
                    <Link href={`/listings/${lst?.id}`} style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--charcoal)', textDecoration: 'none' }}>{lst?.title}</Link>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{lst?.dzongkhag} · {formatPrice(lst?.price)}</div>
                  </div>
                  <span className="status-badge" style={{ background: status.bg, color: status.color }}>{status.label}</span>
                </div>
                <div style={{ background: 'var(--cream-dark)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--charcoal-mid)', marginBottom: 8, fontStyle: 'italic' }}>
                  "{e.message}"
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Enquiry status: <strong style={{ color: 'var(--charcoal)' }}>{e.status}</strong></div>
                {e.status === 'negotiating' && !e.buyer_confirmed_deal && (
                  <button onClick={() => confirmDeal(e.id, false)} className="btn-primary" style={{ fontSize: 12, padding: '7px 14px', marginTop: 10, background: '#1D9E75' }}>
                    Confirm Deal as Buyer
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* RECEIVED ENQUIRIES */}
      {tab === 'received' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {receivedEnquiries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
              <MessageCircle size={36} style={{ margin: '0 auto 12px', color: 'var(--sage)' }} />
              <p>No enquiries received yet</p>
            </div>
          ) : receivedEnquiries.map(e => {
            const buyer = (e as any).buyer
            const lst = e.listings as any
            return (
              <div key={e.id} className="card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 13, fontWeight: 600 }}>
                      {buyer?.full_name?.[0]}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal)' }}>{buyer?.full_name}</div>
                      {buyer?.phone && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{buyer.phone}</div>}
                    </div>
                  </div>
                  <span className="status-badge" style={{ background: 'var(--cream-dark)', color: 'var(--charcoal-mid)' }}>{e.status}</span>
                </div>
                <Link href={`/listings/${lst?.id}`} style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none', display: 'block', marginBottom: 8 }}>on: {lst?.title}</Link>
                <div style={{ background: 'var(--cream-dark)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--charcoal-mid)', marginBottom: 10 }}>
                  "{e.message}"
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {e.status === 'pending' && (
                    <>
                      <button onClick={() => updateEnquiryStatus(e.id, 'accepted')} className="btn-primary" style={{ fontSize: 12, padding: '7px 14px' }}>Accept</button>
                      <button onClick={() => updateEnquiryStatus(e.id, 'declined')} style={{ fontSize: 12, padding: '7px 14px', borderRadius: 8, border: '1.5px solid #e24b4a', color: '#e24b4a', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Decline</button>
                    </>
                  )}
                  {e.status === 'accepted' && (
                    <button onClick={() => updateEnquiryStatus(e.id, 'negotiating')} className="btn-outline" style={{ fontSize: 12, padding: '7px 14px' }}>Start Negotiating</button>
                  )}
                  {e.status === 'negotiating' && !e.seller_confirmed_deal && (
                    <button onClick={() => confirmDeal(e.id, true)} className="btn-primary" style={{ fontSize: 12, padding: '7px 14px', background: '#1D9E75' }}>
                      Confirm Deal as Seller
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* SAVED */}
      {tab === 'saved' && (
        <div>
          {saved.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
              <Heart size={36} style={{ margin: '0 auto 12px', color: 'var(--sage)' }} />
              <p>No saved listings yet</p>
              <Link href="/listings" className="btn-primary" style={{ marginTop: 14, display: 'inline-flex' }}>Browse properties</Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 18 }}>
              {saved.map(s => s.listings && <ListingCard key={s.id} listing={s.listings} />)}
            </div>
          )}
        </div>
      )}

      {/* NOTIFICATIONS */}
      {tab === 'notifications' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
              <Bell size={36} style={{ margin: '0 auto 12px', color: 'var(--sage)' }} />
              <p>No notifications yet</p>
            </div>
          ) : notifications.map(n => (
            <div key={n.id} className="card" onClick={() => { markNotifRead(n.id); if (n.link) router.push(n.link) }}
              style={{ padding: 14, display: 'flex', gap: 10, cursor: 'pointer', borderLeft: n.is_read ? '3px solid transparent' : '3px solid var(--forest)', opacity: n.is_read ? 0.7 : 1 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: n.is_read ? 'var(--border)' : 'var(--forest)', marginTop: 5, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: n.is_read ? 400 : 600, color: 'var(--charcoal)' }}>{n.title}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{n.message}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={10} />{new Date(n.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PROFILE */}
      {tab === 'profile' && profile && <ProfileEditor profile={profile} onSave={setProfile} />}
    </div>
  )
}

function ProfileEditor({ profile, onSave }: { profile: Profile, onSave: (p: Profile) => void }) {
  const [form, setForm] = useState({ full_name: profile.full_name, phone: profile.phone || '' })
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data, error } = await supabase.from('profiles').update(form).eq('id', profile.id).select().single()
    if (error) toast.error(error.message)
    else { onSave(data); toast.success('Profile updated!') }
    setSaving(false)
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <div className="card" style={{ padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 22, fontWeight: 700 }}>
            {profile.full_name?.[0]?.toUpperCase()}
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--charcoal)' }}>{profile.full_name}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', textTransform: 'capitalize' }}>{profile.role}</div>
          </div>
        </div>
        <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label className="label">Full Name</label><input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className="input-field" required /></div>
          <div><label className="label">Phone Number</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="input-field" placeholder="+975 17xxxxxx" /></div>
          <button type="submit" className="btn-primary" disabled={saving} style={{ justifyContent: 'center' }}>
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return <Suspense fallback={<div className="container-main page-pad" style={{ color: 'var(--muted)' }}>Loading...</div>}><DashboardContent /></Suspense>
}
