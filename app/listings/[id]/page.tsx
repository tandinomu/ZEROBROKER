'use client'
import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Listing, Enquiry, Profile } from '@/lib/types'
import { formatPrice, STATUS_CONFIG, PROPERTY_TYPES } from '@/lib/types'
import toast from 'react-hot-toast'
import { MapPin, Bed, Bath, Maximize, Heart, Share2, Phone, CheckCircle, AlertCircle, ChevronLeft, ChevronRight, Star, ArrowLeft } from 'lucide-react'

export default function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [listing, setListing] = useState<Listing | null>(null)
  const [owner, setOwner] = useState<Profile | null>(null)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [myEnquiry, setMyEnquiry] = useState<Enquiry | null>(null)
  const [enquiryCount, setEnquiryCount] = useState(0)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [saved, setSaved] = useState(false)
  const [imgIdx, setImgIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      setUser(u)
      const { data: lst } = await supabase.from('listings').select('*, profiles(*)').eq('id', id).single()
      setListing(lst)
      setOwner(lst?.profiles as any || null)
      if (u && lst) {
        const [{ data: prof }, { data: enq }, { data: sv }, { count }] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', u.id).single(),
          supabase.from('enquiries').select('*').eq('listing_id', id).eq('buyer_id', u.id).single(),
          supabase.from('saved_listings').select('id').eq('user_id', u.id).eq('listing_id', id).single(),
          supabase.from('enquiries').select('*', { count: 'exact', head: true }).eq('listing_id', id),
        ])
        setProfile(prof)
        setMyEnquiry(enq)
        setSaved(!!sv)
        setEnquiryCount(count || 0)
      }
      setLoading(false)
    }
    load()
    const channel = supabase.channel(`listing-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'listings', filter: `id=eq.${id}` },
        payload => setListing(prev => prev ? { ...prev, ...payload.new } : prev))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id])

  async function handleEnquiry(e: React.FormEvent) {
    e.preventDefault()
    if (!user) { router.push('/auth/login'); return }
    if (!listing) return
    setSending(true)
    const { data, error } = await supabase.from('enquiries').insert({
      listing_id: id, buyer_id: user.id, seller_id: listing.owner_id, message,
    }).select().single()
    if (error) { toast.error('Failed to send enquiry: ' + error.message) }
    else {
      setMyEnquiry(data)
      setMessage('')
      toast.success('Enquiry sent!')
      await supabase.from('notifications').insert({
        user_id: listing.owner_id, title: 'New enquiry received',
        message: `${profile?.full_name} is interested in "${listing.title}"`,
        type: 'enquiry', link: `/dashboard?tab=received`,
      })
    }
    setSending(false)
  }

  async function handleConfirmDeal() {
    if (!myEnquiry || !user || !listing) return
    const isBuyer = user.id === myEnquiry.buyer_id
    const field = isBuyer ? 'buyer_confirmed_deal' : 'seller_confirmed_deal'
    const { error } = await supabase.from('enquiries').update({ [field]: true }).eq('id', myEnquiry.id)
    if (error) { toast.error(error.message); return }
    setMyEnquiry(prev => prev ? { ...prev, [field]: true } : prev)
    toast.success('Deal confirmation submitted!')
  }

  async function handleMarkSold() {
    if (!listing) return
    await supabase.from('listings').update({ status: 'sold' }).eq('id', id)
    setListing(prev => prev ? { ...prev, status: 'sold' } : prev)
    toast.success('Listing marked as sold')
  }

  async function toggleSave() {
    if (!user) { router.push('/auth/login'); return }
    if (saved) {
      await supabase.from('saved_listings').delete().eq('user_id', user.id).eq('listing_id', id)
      setSaved(false); toast.success('Removed from saved')
    } else {
      await supabase.from('saved_listings').insert({ user_id: user.id, listing_id: id })
      setSaved(true); toast.success('Saved!')
    }
  }

  if (loading) return <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--muted)' }}>Loading property...</div>
  if (!listing) return <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--muted)' }}>Property not found</div>

  const status = STATUS_CONFIG[listing.status]
  const propType = PROPERTY_TYPES.find(p => p.value === listing.property_type)
  const images = listing.images?.length ? listing.images : [`https://picsum.photos/seed/${id}/800/500`]
  const isOwner = user?.id === listing.owner_id
  const canEnquire = user && !isOwner && !myEnquiry && profile?.role === 'buyer' && listing.status === 'active'
  const isBuyer = myEnquiry && user?.id === myEnquiry.buyer_id
  const buyerConfirmed = myEnquiry?.buyer_confirmed_deal
  const sellerConfirmed = myEnquiry?.seller_confirmed_deal

  return (
    <div className="container-main page-pad">
      <Link href="/listings" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--muted)', textDecoration: 'none', fontSize: 14, marginBottom: 20 }}>
        <ArrowLeft size={14} />Back to listings
      </Link>

      <div className="layout-sidebar" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 28, alignItems: 'start' }}>
        {/* LEFT */}
        <div>
          {/* Image gallery */}
          <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', marginBottom: 22 }}>
            <img src={images[imgIdx]} alt={listing.title}
              className="listing-image" style={{ width: '100%', height: 380, objectFit: 'cover' }}
              onError={e => { e.currentTarget.src = `https://picsum.photos/seed/${id}${imgIdx}/800/500` }} />
            {images.length > 1 && (
              <>
                <button onClick={() => setImgIdx(i => (i - 1 + images.length) % images.length)}
                  style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <ChevronLeft size={16} />
                </button>
                <button onClick={() => setImgIdx(i => (i + 1) % images.length)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <ChevronRight size={16} />
                </button>
              </>
            )}
          </div>

          {/* Title */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span className="status-badge" style={{ background: status.bg, color: status.color }}>{status.label}</span>
                <span className="status-badge" style={{ background: 'var(--cream-dark)', color: 'var(--charcoal-mid)' }}>{propType?.label}</span>
                {listing.is_featured && <span className="status-badge" style={{ background: 'var(--gold)', color: 'white' }}>Featured</span>}
              </div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--charcoal)' }}>{listing.title}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, color: 'var(--muted)', fontSize: 14 }}>
                <MapPin size={13} />
                {listing.location_name}{listing.gewog ? `, ${listing.gewog}` : ''}, {listing.dzongkhag}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={toggleSave} style={{ padding: 9, borderRadius: 9, border: '1.5px solid var(--border)', background: saved ? '#FCEBEB' : 'var(--white)', cursor: 'pointer', color: saved ? '#e24b4a' : 'var(--muted)', display: 'flex' }}>
                <Heart size={17} fill={saved ? '#e24b4a' : 'none'} />
              </button>
              <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Link copied!') }}
                style={{ padding: 9, borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--white)', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}>
                <Share2 size={17} />
              </button>
              {isOwner && <Link href={`/listings/${id}/edit`} className="btn-outline" style={{ fontSize: 13 }}>Edit</Link>}
            </div>
          </div>

          <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--forest)', marginBottom: 18 }}>
            {formatPrice(listing.price)}
          </div>

          {/* Stats */}
          {(listing.bedrooms || listing.bathrooms || listing.area_sqft) && (
            <div className="card" style={{ padding: '14px 18px', display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
              {listing.bedrooms && <div style={{ textAlign: 'center' }}><Bed size={18} style={{ color: 'var(--forest)', margin: '0 auto 4px' }} /><div style={{ fontSize: 16, fontWeight: 700 }}>{listing.bedrooms}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>Beds</div></div>}
              {listing.bathrooms && <div style={{ textAlign: 'center' }}><Bath size={18} style={{ color: 'var(--forest)', margin: '0 auto 4px' }} /><div style={{ fontSize: 16, fontWeight: 700 }}>{listing.bathrooms}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>Baths</div></div>}
              {listing.area_sqft && <div style={{ textAlign: 'center' }}><Maximize size={18} style={{ color: 'var(--forest)', margin: '0 auto 4px' }} /><div style={{ fontSize: 16, fontWeight: 700 }}>{listing.area_sqft.toLocaleString()}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>Sq. Ft</div></div>}
              <div style={{ textAlign: 'center' }}><div style={{ fontSize: 16, fontWeight: 700 }}>{enquiryCount}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>Enquiries</div></div>
            </div>
          )}

          {/* Description */}
          <div className="card" style={{ padding: 18, marginBottom: 18 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--charcoal)', marginBottom: 10 }}>About this property</h2>
            <p style={{ color: 'var(--charcoal-mid)', lineHeight: 1.8, fontSize: 14 }}>{listing.description}</p>
          </div>

          {/* Amenities */}
          {listing.amenities?.length > 0 && (
            <div className="card" style={{ padding: 18, marginBottom: 18 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--charcoal)', marginBottom: 10 }}>Amenities</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {listing.amenities.map(a => (
                  <span key={a} style={{ padding: '5px 12px', borderRadius: 20, background: 'var(--cream-dark)', fontSize: 13, color: 'var(--charcoal-mid)' }}>{a}</span>
                ))}
              </div>
            </div>
          )}

          {/* Map */}
          {listing.latitude && listing.longitude && (
            <div className="card" style={{ padding: 18 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--charcoal)', marginBottom: 10 }}>Location</h2>
              <iframe
                src={`https://www.google.com/maps?q=${listing.latitude},${listing.longitude}&z=15&output=embed`}
                style={{ width: '100%', height: 260, borderRadius: 10, border: 'none' }}
                allowFullScreen loading="lazy" />
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="sidebar-sticky" style={{ position: 'sticky', top: 80, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Owner */}
          {owner && (
            <div className="card" style={{ padding: 18 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--charcoal)', marginBottom: 12 }}>Listed by</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 16, fontWeight: 600 }}>
                  {owner.full_name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--charcoal)', fontSize: 14 }}>{owner.full_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'capitalize' }}>{owner.role}</div>
                </div>
              </div>
              {owner.phone && (
                <a href={`tel:${owner.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--forest)', fontSize: 13, textDecoration: 'none' }}>
                  <Phone size={13} />{owner.phone}
                </a>
              )}
              {/* Seller can mark as sold */}
              {isOwner && listing.status !== 'sold' && (
                <button onClick={handleMarkSold} className="btn-outline" style={{ width: '100%', justifyContent: 'center', marginTop: 12, fontSize: 13 }}>
                  Mark as Sold
                </button>
              )}
            </div>
          )}

          {/* Enquiry form */}
          {canEnquire && (
            <div className="card" style={{ padding: 18 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--charcoal)', marginBottom: 12 }}>Send Enquiry</h3>
              <form onSubmit={handleEnquiry} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <textarea value={message} onChange={e => setMessage(e.target.value)} required rows={4}
                  className="input-field" placeholder="Hi, I am interested in this property. Can we arrange a visit?"
                  style={{ resize: 'vertical' }} />
                <button type="submit" className="btn-primary" disabled={sending} style={{ width: '100%', justifyContent: 'center' }}>
                  {sending ? 'Sending...' : 'Send Enquiry'}
                </button>
              </form>
            </div>
          )}

          {/* My enquiry status */}
          {myEnquiry && (
            <div className="card" style={{ padding: 18 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--charcoal)', marginBottom: 12 }}>Your Enquiry</h3>
              <div style={{ background: 'var(--cream-dark)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>
                Status: <strong style={{ color: 'var(--charcoal)', textTransform: 'capitalize' }}>{myEnquiry.status}</strong>
              </div>
              {['negotiating'].includes(myEnquiry.status) && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 8 }}>Deal Confirmation</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
                      {buyerConfirmed ? <CheckCircle size={14} color="#27500A" /> : <AlertCircle size={14} color="var(--muted)" />}
                      <span>Buyer {buyerConfirmed ? 'confirmed' : 'not confirmed'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
                      {sellerConfirmed ? <CheckCircle size={14} color="#27500A" /> : <AlertCircle size={14} color="var(--muted)" />}
                      <span>Seller {sellerConfirmed ? 'confirmed' : 'not confirmed'}</span>
                    </div>
                  </div>
                  {isBuyer && !buyerConfirmed && (
                    <button onClick={handleConfirmDeal} className="btn-primary" style={{ width: '100%', justifyContent: 'center', background: '#1D9E75', fontSize: 13 }}>
                      Confirm Deal as Buyer
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Not logged in */}
          {!user && (
            <div className="card" style={{ padding: 18, textAlign: 'center' }}>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>Login to enquire about this property</p>
              <Link href="/auth/login" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Login to Enquire</Link>
            </div>
          )}

          {/* Sold */}
          {listing.status === 'sold' && (
            <div style={{ padding: 18, borderRadius: 12, background: 'var(--cream-dark)', textAlign: 'center', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 600, color: 'var(--charcoal)', fontSize: 14, marginBottom: 8 }}>This property has been sold</div>
              <Link href="/listings" style={{ fontSize: 13, color: 'var(--forest)', textDecoration: 'none' }}>Browse other properties</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
