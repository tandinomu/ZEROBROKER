'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Listing, Profile, ListingDocument, ListingReport } from '@/lib/types'
import { formatPrice, PROPERTY_TYPES, DOC_TYPES, DOC_STATUS_CONFIG } from '@/lib/types'
import toast from 'react-hot-toast'
import { CheckCircle, XCircle, Shield, Home, Users, Eye, MapPin, Calendar, Clock, Flag, FileText, ShieldCheck, X } from 'lucide-react'

type PendingListing = Listing & { _owner?: { id: string; full_name: string; phone?: string; role: string } | null }

function getDuplicateIds(listings: PendingListing[]): Set<string> {
  const flagged = new Set<string>()
  for (let i = 0; i < listings.length; i++) {
    for (let j = i + 1; j < listings.length; j++) {
      const a = listings[i], b = listings[j]
      if (a.dzongkhag !== b.dzongkhag || a.property_type !== b.property_type) continue
      const priceDiff = Math.abs(a.price - b.price) / Math.max(a.price, b.price, 1)
      const titleA = a.title.toLowerCase().split(/\W+/).filter(w => w.length > 3)
      const titleB = new Set(b.title.toLowerCase().split(/\W+/).filter(w => w.length > 3))
      const titleOverlap = titleA.filter(w => titleB.has(w)).length / Math.max(titleA.length, titleB.size, 1)
      if (priceDiff < 0.20 || titleOverlap >= 0.40) {
        flagged.add(a.id)
        flagged.add(b.id)
      }
    }
  }
  return flagged
}

export default function AdminPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [pendingListings, setPendingListings] = useState<PendingListing[]>([])
  const [users, setUsers] = useState<Profile[]>([])
  const [reports, setReports] = useState<(ListingReport & { listing_title?: string; reporter_name?: string })[]>([])
  const [listingDocs, setListingDocs] = useState<Record<string, ListingDocument[]>>({})
  const [tab, setTab] = useState<'listings' | 'reports' | 'users'>('listings')
  const [loading, setLoading] = useState(true)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [submittingReject, setSubmittingReject] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!prof || prof.role !== 'admin') { toast.error('Admin access required'); router.push('/'); return }
      setProfile(prof)

      // Fetch pending listings without profiles join to avoid FK ambiguity
      const { data: listings } = await supabase
        .from('listings').select('*').eq('status', 'pending').order('created_at', { ascending: false })

      // Batch-fetch owner profiles for all pending listings
      if (listings && listings.length > 0) {
        const ownerIds = [...new Set(listings.map((l: Listing) => l.owner_id))]
        const { data: owners } = await supabase.from('profiles')
          .select('id, full_name, phone, role').in('id', ownerIds)
        const ownerMap: Record<string, any> = {}
        owners?.forEach((o: any) => { ownerMap[o.id] = o })
        setPendingListings(listings.map((l: Listing) => ({ ...l, _owner: ownerMap[l.owner_id] || null })))
      } else {
        setPendingListings([])
      }

      const { data: us } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(50)
      setUsers(us || [])

      // Fetch reports
      const { data: reps } = await supabase.from('listing_reports').select('*, listings(title), reporter:reporter_id(full_name)').order('created_at', { ascending: false }).limit(50)
      if (reps) {
        setReports(reps.map((r: any) => ({ ...r, listing_title: r.listings?.title, reporter_name: r.reporter?.full_name })))
      }

      // Fetch documents for pending listings
      if (listings && listings.length > 0) {
        const { data: allDocs } = await supabase.from('listing_documents').select('*').in('listing_id', listings.map((l: Listing) => l.id))
        if (allDocs) {
          const docsMap: Record<string, ListingDocument[]> = {}
          allDocs.forEach((d: ListingDocument) => { if (!docsMap[d.listing_id]) docsMap[d.listing_id] = []; docsMap[d.listing_id].push(d) })
          setListingDocs(docsMap)
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  async function approveListing(id: string) {
    const res = await fetch(`/api/listings/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    })
    if (!res.ok) { const e = await res.json(); toast.error(e.error || 'Failed to approve'); return }
    setPendingListings(prev => prev.filter(l => l.id !== id))
    toast.success('Listing approved and now live!')
  }

  async function submitReject() {
    if (!rejectingId || !rejectionReason.trim()) { toast.error('Please provide a rejection reason'); return }
    setSubmittingReject(true)
    const res = await fetch(`/api/listings/${rejectingId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected', rejection_reason: rejectionReason.trim() }),
    })
    if (!res.ok) { const e = await res.json(); toast.error(e.error || 'Failed to reject'); setSubmittingReject(false); return }
    setPendingListings(prev => prev.filter(l => l.id !== rejectingId))
    setRejectingId(null)
    setRejectionReason('')
    setSubmittingReject(false)
    toast.success('Listing rejected — seller has been notified')
  }

  async function viewDoc(urlOrPath: string) {
    const path = urlOrPath.startsWith('http')
      ? urlOrPath.slice(urlOrPath.indexOf('/listing-documents/') + '/listing-documents/'.length)
      : urlOrPath
    const { data, error } = await supabase.storage.from('listing-documents').createSignedUrl(path, 60)
    if (error || !data) { toast.error('Could not open file'); return }
    window.open(data.signedUrl, '_blank')
  }

  async function verifyDoc(docId: string, status: 'verified' | 'rejected', reason?: string) {
    const { data: { user: u } } = await supabase.auth.getUser()
    await supabase.from('listing_documents').update({ status, rejection_reason: reason || null, verified_by: u?.id, verified_at: new Date().toISOString() }).eq('id', docId)
    setListingDocs(prev => {
      const updated = { ...prev }
      for (const lid in updated) {
        updated[lid] = updated[lid].map(d => d.id === docId ? { ...d, status, rejection_reason: reason } : d)
      }
      return updated
    })
    toast.success(status === 'verified' ? 'Document verified!' : 'Document rejected')
  }

  async function verifyListing(listingId: string) {
    await supabase.from('listings').update({ is_verified: true, verification_status: 'verified' }).eq('id', listingId)
    setPendingListings(prev => prev.map(l => l.id === listingId ? { ...l, is_verified: true, verification_status: 'verified' } as any : l))
    toast.success('Listing marked as Verified!')
  }

  async function resolveReport(reportId: string, status: 'resolved' | 'dismissed') {
    const { data: { user: u } } = await supabase.auth.getUser()
    await supabase.from('listing_reports').update({ status, reviewed_by: u?.id }).eq('id', reportId)
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, status } : r))
    toast.success(`Report ${status}`)
  }

  if (loading) return (
    <div style={{ padding: '100px 0', textAlign: 'center' }}>
      <div className="animate-spin" style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--forest)', margin: '0 auto 16px' }} />
      <p style={{ color: 'var(--muted)', fontSize: 14 }}>Loading admin panel...</p>
    </div>
  )

  const tabs = [
    { id: 'listings', label: 'Pending Listings', count: pendingListings.length, icon: <Home size={14} />, urgent: pendingListings.length > 0 },
    { id: 'reports',  label: 'Fraud Reports',    count: reports.filter(r => r.status === 'pending').length, icon: <Flag size={14} />, urgent: reports.some(r => r.status === 'pending') },
    { id: 'users',    label: 'All Users',         count: users.length, icon: <Users size={14} />, urgent: false },
  ]

  const pendingReports = reports.filter(r => r.status === 'pending').length
  const stats = [
    { label: 'Awaiting Approval', value: pendingListings.length, color: '#FAC775', textColor: '#633806', icon: <Clock size={20} color="#633806" /> },
    { label: 'Open Reports',      value: pendingReports,         color: '#FCEBEB',  textColor: '#7c1e1e', icon: <Flag size={20} color="#7c1e1e" /> },
    { label: 'Total Users',       value: users.length,           color: '#D3D1C7',  textColor: '#3d3d3a', icon: <Users size={20} color="#3d3d3a" /> },
  ]

  return (
    <div className="container-main page-pad">

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, var(--forest), var(--forest-mid))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={18} color="white" />
          </div>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--forest)', lineHeight: 1 }}>Admin Panel</h1>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 3 }}>Manage listings and oversee the platform</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="admin-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 30 }}>
        {stats.map(s => (
          <div key={s.label} className="card" style={{ padding: '18px 20px', borderTop: `3px solid ${s.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, color: 'var(--forest)', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{s.label}</div>
              </div>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.85 }}>
                {s.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', border: 'none', borderBottom: tab === t.id ? '2px solid var(--forest)' : '2px solid transparent', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 600 : 400, color: tab === t.id ? 'var(--forest)' : 'var(--muted)', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap', transition: 'color 0.15s' }}>
            {t.icon}
            {t.label}
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 20, height: 20, borderRadius: 10, background: t.urgent ? '#FAC775' : 'var(--cream-dark)', color: t.urgent ? '#633806' : 'var(--charcoal-mid)', fontSize: 11, fontWeight: 700, padding: '0 6px' }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── PENDING LISTINGS ── */}
      {tab === 'listings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {pendingListings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 0' }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#C0DD97', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <CheckCircle size={32} color="#27500A" />
              </div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--charcoal)', marginBottom: 6 }}>All caught up!</h3>
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>No listings are waiting for approval right now.</p>
            </div>
          ) : (
            (() => {
            const duplicateIds = getDuplicateIds(pendingListings)
            return pendingListings.map(l => {
              const thumbnail = l.images?.[0] || `https://picsum.photos/seed/${l.id}/200/140`
              const propType = PROPERTY_TYPES.find(p => p.value === l.property_type)
              const daysAgo = Math.floor((Date.now() - new Date(l.created_at).getTime()) / 86400000)
              const isDuplicate = duplicateIds.has(l.id)
              return (
                <div key={l.id} className="card" style={{ overflow: 'hidden', transition: 'box-shadow 0.2s' }}>
                  <div style={{ display: 'flex', gap: 0 }}>
                    {/* Thumbnail */}
                    <div style={{ width: 180, flexShrink: 0, position: 'relative' }}>
                      <img
                        src={thumbnail}
                        alt={l.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', minHeight: 140, display: 'block' }}
                        onError={e => { e.currentTarget.src = `https://picsum.photos/seed/${l.id}x/200/140` }}
                      />
                      <div style={{ position: 'absolute', top: 8, left: 8 }}>
                        <span style={{ background: '#FAC775', color: '#633806', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>
                          Pending
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--cream-dark)', color: 'var(--charcoal-mid)', fontWeight: 600 }}>{propType?.label}</span>
                              {daysAgo === 0 && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#C0DD97', color: '#27500A', fontWeight: 600 }}>New today</span>}
                              {daysAgo > 3 && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#FCEBEB', color: '#e24b4a', fontWeight: 600 }}>{daysAgo}d waiting</span>}
                              {isDuplicate && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#f3e8ff', color: '#6b21a8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>⚠ Possible duplicate</span>}
                            </div>
                            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--charcoal)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--muted)', fontSize: 12 }}>
                              <MapPin size={11} style={{ flexShrink: 0 }} />
                              {l.dzongkhag}{l.gewog ? ` · ${l.gewog}` : ''} · <strong style={{ color: 'var(--forest)' }}>{formatPrice(l.price)}</strong>
                            </div>
                          </div>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--forest)', flexShrink: 0 }}>
                            {formatPrice(l.price)}
                          </div>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--charcoal-mid)', lineHeight: 1.65, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {l.description}
                        </p>
                        {/* Owner info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--cream)', borderRadius: 8, fontSize: 12 }}>
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                            {l._owner?.full_name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <span style={{ color: 'var(--charcoal-mid)' }}>
                            <strong style={{ color: 'var(--charcoal)' }}>{l._owner?.full_name || 'Unknown'}</strong>
                            {' · '}<span style={{ textTransform: 'capitalize' }}>{l._owner?.role}</span>
                            {l._owner?.phone ? ` · ${l._owner.phone}` : ''}
                          </span>
                          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--muted)' }}>
                            <Calendar size={11} />{new Date(l.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* Documents checklist */}
                      {listingDocs[l.id] && listingDocs[l.id].length > 0 && (
                        <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--cream)', borderRadius: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--charcoal-mid)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <FileText size={11} />VERIFICATION DOCUMENTS ({listingDocs[l.id].filter(d => d.status === 'verified').length}/{listingDocs[l.id].length} verified)
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {listingDocs[l.id].map(d => {
                              const cfg = DOC_STATUS_CONFIG[d.status]
                              const dtype = DOC_TYPES.find(t => t.value === d.doc_type)
                              return (
                                <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                                    <span style={{ fontSize: 12, color: 'var(--charcoal)' }}>{dtype?.label}</span>
                                    {d.file_name && <span style={{ fontSize: 11, color: 'var(--muted)' }}>· {d.file_name}</span>}
                                  </div>
                                  <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                                    <button type="button" onClick={() => viewDoc(d.doc_url)} style={{ fontSize: 11, color: 'var(--forest)', padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>View</button>
                                    {d.status !== 'verified' && (
                                      <button onClick={() => verifyDoc(d.id, 'verified')} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: 'none', background: '#C0DD97', color: '#27500A', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                                        ✓ Verify
                                      </button>
                                    )}
                                    {d.status !== 'rejected' && (
                                      <button onClick={() => { const r = prompt('Rejection reason (optional):'); verifyDoc(d.id, 'rejected', r || undefined) }} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: 'none', background: '#FCEBEB', color: '#e24b4a', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                                        ✗ Reject
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                        <button onClick={() => approveListing(l.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1D9E75', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'opacity 0.15s' }}
                          onMouseOver={e => (e.currentTarget.style.opacity = '0.85')}
                          onMouseOut={e => (e.currentTarget.style.opacity = '1')}>
                          <CheckCircle size={14} />Approve
                        </button>
                        <button onClick={() => { setRejectingId(l.id); setRejectionReason('') }}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1.5px solid #e24b4a', color: '#e24b4a', background: 'transparent', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s' }}
                          onMouseOver={e => { e.currentTarget.style.background = '#FCEBEB' }}
                          onMouseOut={e => { e.currentTarget.style.background = 'transparent' }}>
                          <XCircle size={14} />Reject
                        </button>
                        {listingDocs[l.id]?.length > 0 && listingDocs[l.id].every(d => d.status === 'verified') && !(l as any).is_verified && (
                          <button onClick={() => verifyListing(l.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--forest)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                            <ShieldCheck size={14} />Mark Verified
                          </button>
                        )}
                        <Link href={`/listings/${l.id}`} target="_blank"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1.5px solid var(--border)', color: 'var(--charcoal-mid)', background: 'transparent', fontSize: 13, fontWeight: 500, textDecoration: 'none', transition: 'all 0.15s' }}
                          onMouseOver={e => { e.currentTarget.style.background = 'var(--cream-dark)'; e.currentTarget.style.borderColor = 'var(--forest)' }}
                          onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border)' }}>
                          <Eye size={13} />Preview
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          })()
        )}
        </div>
      )}

      {/* ── FRAUD REPORTS ── */}
      {tab === 'reports' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FCEBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Flag size={18} color="#e24b4a" />
            </div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--charcoal)', lineHeight: 1 }}>Fraud Reports</h2>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>Review user-submitted reports on suspicious or fraudulent listings</p>
            </div>
          </div>

          {reports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 0' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#C0DD97', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <CheckCircle size={28} color="#27500A" />
              </div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--charcoal)', marginBottom: 6 }}>No reports</h3>
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>No fraud reports have been submitted yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {reports.map(r => {
                const statusColors: Record<string, { color: string; bg: string }> = {
                  pending:   { color: '#633806', bg: '#FAC775' },
                  reviewed:  { color: '#0C447C', bg: '#B5D4F4' },
                  resolved:  { color: '#27500A', bg: '#C0DD97' },
                  dismissed: { color: '#3d3d3a', bg: '#D3D1C7' },
                }
                const sc = statusColors[r.status] || statusColors.pending
                return (
                  <div key={r.id} className="card" style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: sc.bg, color: sc.color, textTransform: 'capitalize' }}>{r.status}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', textTransform: 'capitalize' }}>{r.reason.replace(/_/g, ' ')}</span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                          Listing: <strong style={{ color: 'var(--forest)' }}>{r.listing_title || r.listing_id}</strong>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                          Reported by: {r.reporter_name || 'Unknown'} · {new Date(r.created_at).toLocaleDateString()}
                        </div>
                        {r.description && (
                          <div style={{ fontSize: 13, color: 'var(--charcoal-mid)', marginTop: 8, padding: '8px 12px', background: 'var(--cream-dark)', borderRadius: 8, fontStyle: 'italic' }}>
                            "{r.description}"
                          </div>
                        )}
                      </div>
                      {r.status === 'pending' && (
                        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                          <button onClick={() => resolveReport(r.id, 'resolved')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, border: 'none', background: '#1D9E75', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                            <CheckCircle size={12} />Resolve
                          </button>
                          <button onClick={() => resolveReport(r.id, 'dismissed')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, border: '1.5px solid var(--border)', color: 'var(--muted)', background: 'transparent', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                            Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── USERS ── */}
      {tab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {users.map(u => (
            <div key={u.id} className="card" style={{ padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--cream-dark)', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--charcoal-mid)', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                  {u.full_name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--charcoal)' }}>{u.full_name}</div>
                  {u.phone && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{u.phone}</div>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 10, background: 'var(--cream-dark)', color: 'var(--charcoal-mid)', textTransform: 'capitalize', fontWeight: 600 }}>{u.role}</span>
                {u.is_verified && <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 10, background: '#C0DD97', color: '#27500A', fontWeight: 600 }}>✓ Verified</span>}
                <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Calendar size={11} />{new Date(u.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── REJECTION REASON MODAL ── */}
      {rejectingId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 440, padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--charcoal)' }}>Reject Listing</h2>
              <button onClick={() => { setRejectingId(null); setRejectionReason('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 18 }}>
              Provide a clear reason so the seller knows what to fix before resubmitting.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label className="label">Rejection Reason *</label>
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                rows={4}
                className="input-field"
                placeholder="e.g. Missing ownership certificate. Please upload a valid thram or ownership deed."
                style={{ resize: 'vertical', fontSize: 13 }}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={submitReject}
                disabled={submittingReject || !rejectionReason.trim()}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#e24b4a', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)', opacity: (submittingReject || !rejectionReason.trim()) ? 0.6 : 1 }}>
                {submittingReject ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
              <button onClick={() => { setRejectingId(null); setRejectionReason('') }} className="btn-ghost" style={{ fontSize: 13 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
