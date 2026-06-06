'use client'
import React, { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Listing, Enquiry, Profile, ListingDocument } from '@/lib/types'
import { formatPrice, STATUS_CONFIG, PROPERTY_TYPES, DOC_TYPES, DOC_STATUS_CONFIG } from '@/lib/types'
import VerificationBadge from '@/components/VerificationBadge'
import ListingProgressBar from '@/components/ListingProgressBar'
import toast from 'react-hot-toast'
import { MapPin, Bed, Bath, Maximize, Heart, Share2, Phone, CheckCircle, AlertCircle, XCircle, ChevronLeft, ChevronRight, ArrowLeft, Calendar, Tag, Flag, ShieldCheck, Upload, FileText, X, Send, Archive } from 'lucide-react'

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
  const [docs, setDocs] = useState<ListingDocument[]>([])
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [docType, setDocType] = useState<string>('ownership_certificate')
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('fraud')
  const [reportDesc, setReportDesc] = useState('')
  const [submittingReport, setSubmittingReport] = useState(false)
  const [alreadyReported, setAlreadyReported] = useState(false)
  const [calcLoanAmt, setCalcLoanAmt] = useState('')
  const [calcRate, setCalcRate] = useState('')
  const [calcMonths, setCalcMonths] = useState('')
  const [calcResult, setCalcResult] = useState<{ emi: number; totalInterest: number; totalAmount: number } | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      setUser(u)
      const { data: lst, error: lstError } = await supabase.from('listings').select('*').eq('id', id).single()
      if (lstError) console.error('Listing fetch error:', lstError)
      setListing(lst)
      if (lst?.owner_id) {
        const { data: ownerData } = await supabase.from('profiles').select('*').eq('id', lst.owner_id).single()
        setOwner(ownerData)
      }
      const { data: docData } = await supabase.from('listing_documents').select('*').eq('listing_id', id).order('created_at', { ascending: true })
      setDocs(docData || [])

      if (u && lst) {
        const [{ data: prof }, { data: enq }, { data: sv }, { count }, { data: rep }] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', u.id).single(),
          supabase.from('enquiries').select('*').eq('listing_id', id).eq('buyer_id', u.id).single(),
          supabase.from('saved_listings').select('id').eq('user_id', u.id).eq('listing_id', id).single(),
          supabase.from('enquiries').select('*', { count: 'exact', head: true }).eq('listing_id', id),
          supabase.from('listing_reports').select('id').eq('listing_id', id).eq('reporter_id', u.id).single(),
        ])
        setProfile(prof)
        setMyEnquiry(enq)
        setSaved(!!sv)
        setEnquiryCount(count || 0)
        setAlreadyReported(!!rep)
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

  async function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user || !listing) return
    setUploadingDoc(true)
    const ext = file.name.split('.').pop()
    const path = `${listing.id}/${docType}_${Date.now()}.${ext}`
    const { data, error } = await supabase.storage.from('listing-documents').upload(path, file)
    if (error) { toast.error('Upload failed: ' + error.message); setUploadingDoc(false); return }
    const { data: doc, error: docErr } = await supabase.from('listing_documents').insert({
      listing_id: id, owner_id: user.id, doc_type: docType, doc_url: data.path, file_name: file.name, status: 'pending',
    }).select().single()
    if (docErr) { toast.error(docErr.message) }
    else {
      setDocs(prev => [...prev, doc])
      toast.success('Document uploaded — pending admin review')
    }
    setUploadingDoc(false)
    e.target.value = ''
  }

  async function viewDoc(urlOrPath: string) {
    const path = urlOrPath.startsWith('http')
      ? urlOrPath.slice(urlOrPath.indexOf('/listing-documents/') + '/listing-documents/'.length)
      : urlOrPath
    const { data, error } = await supabase.storage.from('listing-documents').createSignedUrl(path, 60)
    if (error || !data) { toast.error('Could not open file'); return }
    window.open(data.signedUrl, '_blank')
  }

  function downloadSalesDeed() {
    if (!listing) return
    const date = new Date().toLocaleDateString('en-BT', { year: 'numeric', month: 'long', day: 'numeric' })
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<title>Sale Deed Template – ${listing.title}</title>
<style>
  body{font-family:Georgia,serif;max-width:780px;margin:40px auto;padding:0 40px;color:#1a1a1a;line-height:1.8}
  h1{text-align:center;font-size:22px;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px}
  h2{font-size:15px;margin-top:28px;margin-bottom:6px;text-decoration:underline}
  .subtitle{text-align:center;font-size:13px;color:#555;margin-bottom:32px}
  .field{border-bottom:1px solid #aaa;display:inline-block;min-width:200px;margin:0 4px}
  .parties{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin:28px 0}
  .party-box{border:1px solid #ccc;border-radius:6px;padding:16px}
  .party-box h3{margin:0 0 10px;font-size:14px;text-transform:uppercase;letter-spacing:1px}
  .sig-block{margin-top:60px;display:grid;grid-template-columns:1fr 1fr;gap:60px}
  .sig-line{border-top:1px solid #333;margin-top:50px;padding-top:6px;font-size:12px;color:#555}
  table{width:100%;border-collapse:collapse;margin:16px 0}
  td{padding:8px 12px;border:1px solid #ddd;font-size:13px}
  td:first-child{font-weight:600;width:38%;background:#fafafa}
  .notice{background:#fffbea;border:1px solid #e8d96a;border-radius:6px;padding:14px 18px;font-size:12px;color:#7a5f00;margin-top:32px}
  @media print{.notice{display:none}}
</style></head><body>
<h1>Property Sale Deed</h1>
<div class="subtitle">Template Agreement · Kingdom of Bhutan</div>

<p>This Sale Deed is entered into on <strong>${date}</strong>, between the Seller and Buyer identified below, in respect of the property described herein.</p>

<div class="parties">
  <div class="party-box">
    <h3>Seller (Party A)</h3>
    <p>Full Name: <span class="field">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></p>
    <p>CID No.: <span class="field">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></p>
    <p>Phone: <span class="field">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></p>
    <p>Address: <span class="field">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></p>
  </div>
  <div class="party-box">
    <h3>Buyer (Party B)</h3>
    <p>Full Name: <span class="field">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></p>
    <p>CID No.: <span class="field">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></p>
    <p>Phone: <span class="field">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></p>
    <p>Address: <span class="field">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></p>
  </div>
</div>

<h2>1. Property Details</h2>
<table>
  <tr><td>Property Title</td><td>${listing.title}</td></tr>
  <tr><td>Property Type</td><td>${listing.property_type.charAt(0).toUpperCase() + listing.property_type.slice(1)}</td></tr>
  <tr><td>Location</td><td>${listing.location_name}${listing.gewog ? ', ' + listing.gewog : ''}, ${listing.dzongkhag} Dzongkhag</td></tr>
  ${listing.area_sqft ? `<tr><td>Area</td><td>${listing.area_sqft.toLocaleString()} sq. ft.</td></tr>` : ''}
  ${listing.bedrooms ? `<tr><td>Bedrooms</td><td>${listing.bedrooms}</td></tr>` : ''}
  <tr><td>Thram / Plot No.</td><td>&nbsp;</td></tr>
</table>

<h2>2. Agreed Sale Price</h2>
<p>The Buyer agrees to purchase the above property for a total consideration of <strong>Nu. ${listing.price.toLocaleString()}/- (${numberToWords(listing.price)} Ngultrum Only)</strong>, payable as follows:</p>
<table>
  <tr><td>Token / Advance (on signing)</td><td>Nu. <span class="field">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></td></tr>
  <tr><td>Remaining Balance (on registration)</td><td>Nu. <span class="field">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></td></tr>
  <tr><td>Mode of Payment</td><td><span class="field">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></td></tr>
</table>

<h2>3. Terms &amp; Conditions</h2>
<ol style="font-size:13px;padding-left:20px">
  <li>The Seller confirms that the property is free from all encumbrances, liens, mortgages, and legal disputes.</li>
  <li>The Seller shall hand over vacant possession of the property upon receipt of the full agreed sale price.</li>
  <li>The Buyer shall bear all costs related to property transfer, stamp duty, and registration fees as per applicable laws of Bhutan.</li>
  <li>In the event of default by either party, the defaulting party shall be liable for damages as mutually agreed or as decided by competent authority.</li>
  <li>This agreement shall be governed by the laws of the Kingdom of Bhutan, and any disputes shall be subject to the jurisdiction of Bhutan courts.</li>
  <li>This deed shall be presented for registration at the relevant Dzongkhag Land Record Office within <span class="field">&nbsp;&nbsp;&nbsp;&nbsp;</span> days of signing.</li>
</ol>

<h2>4. Witnesses</h2>
<div class="parties">
  <div class="party-box">
    <h3>Witness 1</h3>
    <p>Name: <span class="field">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></p>
    <p>CID No.: <span class="field">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></p>
    <p>Signature: <span class="field">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></p>
  </div>
  <div class="party-box">
    <h3>Witness 2</h3>
    <p>Name: <span class="field">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></p>
    <p>CID No.: <span class="field">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></p>
    <p>Signature: <span class="field">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></p>
  </div>
</div>

<div class="sig-block">
  <div>
    <div class="sig-line">Seller Signature &amp; Date</div>
    <div style="font-size:12px;color:#555;margin-top:4px">(Party A)</div>
  </div>
  <div>
    <div class="sig-line">Buyer Signature &amp; Date</div>
    <div style="font-size:12px;color:#555;margin-top:4px">(Party B)</div>
  </div>
</div>

<div class="notice">
  <strong>⚠ Important:</strong> This is a template for reference only. It does not constitute legal advice.
  Parties are advised to have this deed reviewed by a licensed legal practitioner and registered at the
  appropriate Dzongkhag Land Record Office as required under the Land Act of Bhutan.
</div>
</body></html>`

    const win = window.open('', '_blank')
    if (!win) { toast.error('Allow pop-ups to download the template'); return }
    win.document.write(html)
    win.document.close()
    win.focus()
  }

  function numberToWords(n: number): string {
    if (n >= 10000000) return `${(n / 10000000).toFixed(2)} Crore`
    if (n >= 100000) return `${(n / 100000).toFixed(2)} Lakh`
    if (n >= 1000) return `${(n / 1000).toFixed(2)} Thousand`
    return n.toString()
  }

  async function handleReport(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !listing) return
    setSubmittingReport(true)
    const { error } = await supabase.from('listing_reports').insert({
      listing_id: id, reporter_id: user.id, reason: reportReason, description: reportDesc || null, status: 'pending',
    })
    if (error) toast.error(error.message)
    else { setAlreadyReported(true); setReportOpen(false); toast.success('Report submitted. Thank you.') }
    setSubmittingReport(false)
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

  async function transitionStatus(newStatus: string, options: { rejection_reason?: string } = {}) {
    const res = await fetch(`/api/listings/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, ...options }),
    })
    if (!res.ok) { const e = await res.json(); toast.error(e.error || 'Failed to update status'); return false }
    const { data } = await res.json()
    setListing(prev => prev ? { ...prev, ...data } : prev)
    return true
  }

  async function submitForReview() {
    if (!listing || !profile) return
    if (listing.status !== 'draft' && listing.status !== 'rejected') return
    if (!profile.cid_status || profile.cid_status === 'unverified') {
      toast.error('You must upload your CID before submitting for review. Go to Dashboard → Profile → Upload CID.')
      return
    }
    const ok = await transitionStatus('pending')
    if (ok) toast.success('Listing submitted for review! Admin will approve it soon.')
  }

  async function handleMarkSold() {
    if (!listing) return
    const ok = await transitionStatus('sold')
    if (ok) toast.success('Listing marked as sold')
  }

  async function handleArchive() {
    if (!listing) return
    if (!confirm('Archive this listing? It will be hidden from the marketplace. You can restore it later.')) return
    const ok = await transitionStatus('archived')
    if (ok) toast.success('Listing archived')
  }

  async function handleRestore() {
    if (!listing) return
    const ok = await transitionStatus('draft')
    if (ok) toast.success('Listing restored to draft — you can edit and resubmit it.')
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

  if (loading) return (
    <div style={{ padding: '100px 0', textAlign: 'center' }}>
      <div className="animate-spin" style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--forest)', margin: '0 auto 16px' }} />
      <p style={{ color: 'var(--muted)', fontSize: 14 }}>Loading property...</p>
    </div>
  )

  if (!listing) return (
    <div style={{ padding: '100px 0', textAlign: 'center' }}>
      <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--cream-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
        <Tag size={32} color="var(--muted)" />
      </div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--charcoal)', marginBottom: 8 }}>Property not found</h2>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>This listing may have been removed or doesn't exist.</p>
      <Link href="/listings" className="btn-primary">Browse Properties</Link>
    </div>
  )

  const status = STATUS_CONFIG[listing.status]
  const propType = PROPERTY_TYPES.find(p => p.value === listing.property_type)
  const images = listing.images?.length ? listing.images : [`https://picsum.photos/seed/${id}/800/500`]
  const isOwner = user?.id === listing.owner_id
  const canEnquire = user && !isOwner && !myEnquiry && (profile?.role === 'buyer' || profile?.role === 'both') && ['approved', 'active', 'enquiring', 'negotiating'].includes(listing.status)
  const isBuyer = myEnquiry && user?.id === myEnquiry.buyer_id
  const buyerConfirmed = myEnquiry?.buyer_confirmed_deal
  const sellerConfirmed = myEnquiry?.seller_confirmed_deal

  const stats = [
    listing.bedrooms ? { icon: <Bed size={18} color="var(--forest)" />, value: listing.bedrooms, label: 'Bedrooms' } : null,
    listing.bathrooms ? { icon: <Bath size={18} color="var(--forest)" />, value: listing.bathrooms, label: 'Bathrooms' } : null,
    listing.area_sqft ? { icon: <Maximize size={18} color="var(--forest)" />, value: listing.area_sqft.toLocaleString(), label: 'Sq. Ft' } : null,
    { icon: <Calendar size={18} color="var(--forest)" />, value: enquiryCount, label: 'Enquiries' },
  ].filter(Boolean) as { icon: React.ReactNode; value: any; label: string }[]

  return (
    <div className="container-main page-pad">
      <Link href="/listings" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--muted)', textDecoration: 'none', fontSize: 13, marginBottom: 24, transition: 'color 0.2s' }}
        onMouseOver={e => (e.currentTarget.style.color = 'var(--forest)')}
        onMouseOut={e => (e.currentTarget.style.color = 'var(--muted)')}>
        <ArrowLeft size={14} /> Back to listings
      </Link>

      <div className="layout-sidebar" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 28, alignItems: 'start' }}>

        {/* ── LEFT COLUMN ── */}
        <div>

          {/* Owner: lifecycle progress bar */}
          {isOwner && ['draft', 'pending', 'rejected', 'archived'].includes(listing.status) && (
            <div style={{ marginBottom: 8 }}>
              <ListingProgressBar listing={listing} profile={profile} />

              {/* Draft banner */}
              {listing.status === 'draft' && (
                <div className="card" style={{ padding: '14px 18px', marginBottom: 18, background: 'linear-gradient(135deg, #f9f5e8, #f3edda)', border: '1px solid #e8d9a0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#5a3e0a', marginBottom: 3 }}>This listing is a draft</div>
                      <div style={{ fontSize: 12, color: '#8a6820' }}>
                        {!profile?.cid_status || profile.cid_status === 'unverified'
                          ? 'Upload your CID in Dashboard → Profile before submitting.'
                          : profile.cid_status === 'pending'
                          ? 'Your CID is under review. You can still submit — admin will check both.'
                          : 'All steps complete. Submit when ready.'}
                      </div>
                    </div>
                    <button onClick={submitForReview}
                      disabled={!profile?.cid_status || profile.cid_status === 'unverified'}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, border: 'none', background: (!profile?.cid_status || profile.cid_status === 'unverified') ? 'var(--border)' : 'var(--forest)', color: (!profile?.cid_status || profile.cid_status === 'unverified') ? 'var(--muted)' : 'white', fontSize: 13, fontWeight: 600, cursor: (!profile?.cid_status || profile.cid_status === 'unverified') ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)' }}>
                      <Send size={13} />Submit for Review
                    </button>
                  </div>
                </div>
              )}

              {/* Rejected banner */}
              {listing.status === 'rejected' && (
                <div className="card" style={{ padding: '14px 18px', marginBottom: 18, background: '#fff5f5', border: '1px solid #fecdd3' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#7c1e1e', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <XCircle size={14} />Listing Rejected
                      </div>
                      {listing.rejection_reason && (
                        <div style={{ fontSize: 13, color: '#7c1e1e', background: '#fee2e2', borderRadius: 6, padding: '8px 12px', marginBottom: 8, lineHeight: 1.5 }}>
                          <strong>Reason:</strong> {listing.rejection_reason}
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: '#9a3333' }}>Edit your listing to address the feedback, then resubmit for review.</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                      <Link href={`/listings/${id}/edit`} className="btn-outline" style={{ fontSize: 13, padding: '8px 14px' }}>
                        Edit Listing
                      </Link>
                      <button onClick={submitForReview}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--forest)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                        <Send size={13} />Resubmit
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Archived banner */}
              {listing.status === 'archived' && (
                <div className="card" style={{ padding: '14px 18px', marginBottom: 18, background: '#f5f5f3', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#444441', marginBottom: 3 }}>This listing is archived</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>It is hidden from the marketplace. Restore it to draft to edit and resubmit.</div>
                    </div>
                    <button onClick={handleRestore}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--forest)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                      Restore to Draft
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Image Gallery */}
          <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', marginBottom: 24, boxShadow: 'var(--shadow-md)' }}>
            <img
              src={images[imgIdx]}
              alt={listing.title}
              className="listing-image"
              style={{ width: '100%', height: 420, objectFit: 'cover', display: 'block' }}
              onError={e => { e.currentTarget.src = `https://picsum.photos/seed/${id}${imgIdx}/800/500` }}
            />
            {/* Bottom gradient overlay */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)', pointerEvents: 'none' }} />
            {/* Image counter */}
            {images.length > 1 && (
              <div style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', color: 'white', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600 }}>
                {imgIdx + 1} / {images.length}
              </div>
            )}
            {/* Nav arrows */}
            {images.length > 1 && (
              <>
                <button onClick={() => setImgIdx(i => (i - 1 + images.length) % images.length)}
                  style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.92)', border: 'none', borderRadius: '50%', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', transition: 'transform 0.15s' }}
                  onMouseOver={e => (e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)')}
                  onMouseOut={e => (e.currentTarget.style.transform = 'translateY(-50%) scale(1)')}>
                  <ChevronLeft size={16} />
                </button>
                <button onClick={() => setImgIdx(i => (i + 1) % images.length)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.92)', border: 'none', borderRadius: '50%', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', transition: 'transform 0.15s' }}
                  onMouseOver={e => (e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)')}
                  onMouseOut={e => (e.currentTarget.style.transform = 'translateY(-50%) scale(1)')}>
                  <ChevronRight size={16} />
                </button>
              </>
            )}
            {/* Dot indicators */}
            {images.length > 1 && (
              <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
                {images.map((_, i) => (
                  <button key={i} onClick={() => setImgIdx(i)}
                    style={{ width: i === imgIdx ? 22 : 6, height: 6, borderRadius: 3, background: 'white', opacity: i === imgIdx ? 1 : 0.5, border: 'none', cursor: 'pointer', transition: 'all 0.25s', padding: 0 }} />
                ))}
              </div>
            )}
          </div>

          {/* Title block */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                  <span className="status-badge" style={{ background: status.bg, color: status.color, fontSize: 11 }}>{status.label}</span>
                  <span className="status-badge" style={{ background: 'var(--cream-dark)', color: 'var(--charcoal-mid)', fontSize: 11 }}>{propType?.label}</span>
                  {listing.is_featured && (
                    <span className="status-badge" style={{ background: 'linear-gradient(135deg, #c9a84c, #e8d5a0)', color: '#5a3e0a', fontSize: 11 }}>★ Featured</span>
                  )}
                </div>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--charcoal)', lineHeight: 1.25, marginBottom: 8 }}>
                  {listing.title}
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--muted)', fontSize: 13 }}>
                  <MapPin size={13} style={{ flexShrink: 0 }} />
                  <span>{listing.location_name}{listing.gewog ? `, ${listing.gewog}` : ''}, {listing.dzongkhag}</span>
                </div>
              </div>
              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={toggleSave}
                  title={saved ? 'Remove from saved' : 'Save property'}
                  style={{ width: 40, height: 40, borderRadius: 10, border: '1.5px solid', borderColor: saved ? '#f0b0b0' : 'var(--border)', background: saved ? '#fff0f0' : 'var(--white)', cursor: 'pointer', color: saved ? '#e24b4a' : 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                  <Heart size={16} fill={saved ? '#e24b4a' : 'none'} />
                </button>
                <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Link copied!') }}
                  title="Share listing"
                  style={{ width: 40, height: 40, borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--white)', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                  <Share2 size={16} />
                </button>
                {isOwner && (
                  <Link href={`/listings/${id}/edit`} className="btn-outline" style={{ fontSize: 13, padding: '8px 14px', height: 40 }}>Edit</Link>
                )}
              </div>
            </div>
          </div>

          {/* Price */}
          <div style={{ marginBottom: 22, padding: '16px 20px', background: 'linear-gradient(135deg, var(--forest) 0%, var(--forest-mid) 100%)', borderRadius: 12, display: 'inline-block', minWidth: 220 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Asking Price</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: 'white' }}>{formatPrice(listing.price)}</div>
          </div>

          {/* Stats */}
          {stats.length > 0 && (
            <div className="card" style={{ marginBottom: 22, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length}, 1fr)` }}>
                {stats.map((s, i) => (
                  <div key={s.label} style={{ padding: '18px 14px', textAlign: 'center', borderRight: i < stats.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>{s.icon}</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--charcoal)' }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div className="card" style={{ padding: 22, marginBottom: 18 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--charcoal)', marginBottom: 12 }}>About this property</h2>
            <p style={{ color: 'var(--charcoal-mid)', lineHeight: 1.85, fontSize: 14 }}>{listing.description}</p>
          </div>

          {/* Amenities */}
          {listing.amenities?.length > 0 && (
            <div className="card" style={{ padding: 22, marginBottom: 18 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--charcoal)', marginBottom: 14 }}>Amenities</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {listing.amenities.map(a => (
                  <span key={a} style={{ padding: '6px 14px', borderRadius: 20, background: 'var(--sage-light)', fontSize: 13, color: 'var(--forest)', fontWeight: 500 }}>
                    ✓ {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── EMI Calculator ── */}
          {['approved', 'active', 'enquiring', 'negotiating'].includes(listing.status) && (
            <div className="card" style={{ marginBottom: 18, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ background: 'linear-gradient(135deg, #1a2744 0%, #0f1a30 100%)', padding: '22px 24px' }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'white', textAlign: 'center', marginBottom: 20 }}>EMI Calculator</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                  {[
                    { label: 'Loan Amount', placeholder: `e.g. ${Math.round(listing.price * 0.8).toLocaleString()}`, value: calcLoanAmt, set: setCalcLoanAmt, hint: 'BNB max: 70% of value' },
                    { label: 'Interest Rate (%)', placeholder: 'e.g. 9', value: calcRate, set: setCalcRate, hint: 'BNB: 9% · BDBL: 8.5%' },
                    { label: 'Term (Months)', placeholder: 'e.g. 240', value: calcMonths, set: setCalcMonths, hint: 'Max 360 months (30 yr)' },
                  ].map(f => (
                    <div key={f.label}>
                      <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 500, display: 'block', marginBottom: 6 }}>{f.label}</label>
                      <input
                        type="number"
                        placeholder={f.placeholder}
                        value={f.value}
                        onChange={e => { f.set(e.target.value); setCalcResult(null) }}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box' }}
                      />
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{f.hint}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                  <button
                    onClick={() => {
                      const P = parseFloat(calcLoanAmt)
                      const r = parseFloat(calcRate) / 100 / 12
                      const n = parseInt(calcMonths)
                      if (!P || !n || isNaN(r) || P <= 0 || n <= 0) { return }
                      const emi = r === 0 ? P / n : P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1)
                      const totalAmount = emi * n
                      setCalcResult({ emi, totalInterest: totalAmount - P, totalAmount })
                    }}
                    style={{ padding: '10px 28px', borderRadius: 8, border: 'none', background: '#8b2020', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                  >Calculate</button>
                  <button
                    onClick={() => { setCalcLoanAmt(''); setCalcRate(''); setCalcMonths(''); setCalcResult(null) }}
                    style={{ padding: '10px 28px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.12)', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                  >Reset</button>
                </div>
              </div>
              {/* Results */}
              <div style={{ padding: '4px 0' }}>
                {[
                  { label: 'Loan EMI', value: calcResult?.emi },
                  { label: 'Total Interest Payable', value: calcResult?.totalInterest },
                  { label: 'Total Amount', value: calcResult?.totalAmount },
                ].map((row, i) => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#1e3a6e' }}>{row.label}</span>
                    <span style={{ fontSize: 15, color: row.value ? 'var(--charcoal)' : 'var(--muted)' }}>
                      <span style={{ fontSize: 13, color: 'var(--muted)', marginRight: 4 }}>Nu</span>
                      {row.value ? row.value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ padding: '10px 24px', background: 'var(--cream)', borderTop: '1px solid var(--border)' }}>
                <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>* Indicative only. BNB home loan: 9% p.a. · BDBL: 8.5% p.a. · BOBL: 9.5% p.a. Contact your bank for exact terms.</p>
              </div>
            </div>
          )}

          {/* ── Documents Panel ── */}
          <div className="card" style={{ padding: 22, marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={16} color="var(--forest)" />
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--charcoal)' }}>Verification Documents</h2>
              </div>
              {listing.is_verified && <VerificationBadge variant="verified" size="md" />}
              {!listing.is_verified && docs.length > 0 && <VerificationBadge variant="pending" size="md" />}
            </div>

            {docs.length === 0 && !isOwner && (
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>No documents uploaded yet.</p>
            )}

            {docs.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: isOwner ? 18 : 0 }}>
                {docs.map(d => {
                  const cfg = DOC_STATUS_CONFIG[d.status]
                  const dtype = DOC_TYPES.find(t => t.value === d.doc_type)
                  return (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                        <FileText size={14} color="var(--forest)" style={{ flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dtype?.label}</div>
                          {d.file_name && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.file_name}</div>}
                          {d.rejection_reason && <div style={{ fontSize: 11, color: '#e24b4a', marginTop: 1 }}>Reason: {d.rejection_reason}</div>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                        <button type="button" onClick={() => viewDoc(d.doc_url)} style={{ fontSize: 11, color: 'var(--forest)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>View</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {isOwner && (
              <div style={{ borderTop: docs.length > 0 ? '1px solid var(--border)' : 'none', paddingTop: docs.length > 0 ? 14 : 0 }}>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>Upload documents to verify your listing and build buyer trust.</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <select value={docType} onChange={e => setDocType(e.target.value)} className="input-field" style={{ flex: '1 1 180px' }}>
                    {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                  <label className="btn-outline" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={handleDocUpload} disabled={uploadingDoc} />
                    <Upload size={13} />{uploadingDoc ? 'Uploading...' : 'Upload'}
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Map */}
          {listing.latitude && listing.longitude && (
            <div className="card" style={{ padding: 22, overflow: 'hidden' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--charcoal)', marginBottom: 14 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><MapPin size={16} color="var(--forest)" />Location</span>
              </h2>
              <iframe
                src={`https://www.google.com/maps?q=${listing.latitude},${listing.longitude}&z=15&output=embed`}
                style={{ width: '100%', height: 280, borderRadius: 10, border: 'none', display: 'block' }}
                allowFullScreen loading="lazy"
              />
            </div>
          )}
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <div className="sidebar-sticky" style={{ position: 'sticky', top: 80, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Owner card */}
          {owner && (
            <div className="card" style={{ overflow: 'hidden' }}>
              {/* Gradient header */}
              <div style={{ background: 'linear-gradient(135deg, var(--forest) 0%, #2d6b47 100%)', padding: '20px 18px' }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Listed by</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 18, fontWeight: 700, flexShrink: 0 }}>
                    {owner.full_name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: 'white', fontSize: 15, lineHeight: 1.25 }}>{owner.full_name}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', textTransform: 'capitalize', marginTop: 2 }}>{owner.role}</div>
                  </div>
                </div>
              </div>
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {owner.phone && (
                  <a href={`tel:${owner.phone}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'var(--forest)', fontSize: 14, textDecoration: 'none', padding: '10px 14px', background: 'var(--cream)', borderRadius: 9, fontWeight: 500, transition: 'background 0.2s' }}
                    onMouseOver={e => (e.currentTarget.style.background = 'var(--cream-dark)')}
                    onMouseOut={e => (e.currentTarget.style.background = 'var(--cream)')}>
                    <Phone size={14} />{owner.phone}
                  </a>
                )}
                {isOwner && ['approved', 'active', 'enquiring', 'negotiating'].includes(listing.status) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button onClick={handleMarkSold} className="btn-outline" style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}>
                      Mark as Sold
                    </button>
                    <button onClick={handleArchive}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 14px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'transparent', fontSize: 13, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s' }}
                      onMouseOver={e => { e.currentTarget.style.borderColor = '#e24b4a'; e.currentTarget.style.color = '#e24b4a' }}
                      onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
                      <Archive size={13} />Archive Listing
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Enquiry form */}
          {canEnquire && (
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--charcoal)', marginBottom: 4 }}>Send Enquiry</h3>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>Message the seller directly about this property.</p>
              <form onSubmit={handleEnquiry} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  required rows={4}
                  className="input-field"
                  placeholder="Hi, I'm interested in this property. Can we arrange a visit?"
                  style={{ resize: 'vertical', fontSize: 13 }}
                />
                <button type="submit" className="btn-primary" disabled={sending} style={{ width: '100%', justifyContent: 'center', background: '#1D9E75', opacity: sending ? 0.7 : 1 }}>
                  {sending ? 'Sending...' : 'Send Enquiry'}
                </button>
              </form>
            </div>
          )}

          {/* Existing enquiry status */}
          {myEnquiry && (
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--charcoal)', marginBottom: 12 }}>Your Enquiry</h3>
              <div style={{ background: 'var(--cream)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>
                Status: <strong style={{ color: 'var(--charcoal)', textTransform: 'capitalize' }}>{myEnquiry.status}</strong>
              </div>
              {['negotiating'].includes(myEnquiry.status) && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 10 }}>Deal Confirmation</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, padding: '6px 10px', background: buyerConfirmed ? 'rgba(29,158,117,0.08)' : 'var(--cream)', borderRadius: 7 }}>
                      {buyerConfirmed ? <CheckCircle size={14} color="#1D9E75" /> : <AlertCircle size={14} color="var(--muted)" />}
                      <span style={{ color: buyerConfirmed ? '#1D9E75' : 'var(--muted)' }}>Buyer {buyerConfirmed ? 'confirmed' : 'not confirmed'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, padding: '6px 10px', background: sellerConfirmed ? 'rgba(29,158,117,0.08)' : 'var(--cream)', borderRadius: 7 }}>
                      {sellerConfirmed ? <CheckCircle size={14} color="#1D9E75" /> : <AlertCircle size={14} color="var(--muted)" />}
                      <span style={{ color: sellerConfirmed ? '#1D9E75' : 'var(--muted)' }}>Seller {sellerConfirmed ? 'confirmed' : 'not confirmed'}</span>
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

          {/* Not logged in prompt */}
          {!user && (
            <div className="card" style={{ padding: 20, textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--cream-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Phone size={20} color="var(--muted)" />
              </div>
              <p style={{ color: 'var(--charcoal-mid)', fontSize: 13, marginBottom: 14, fontWeight: 500 }}>Login to enquire about this property</p>
              <Link href="/auth/login" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Login to Enquire</Link>
            </div>
          )}

          {/* Report listing */}
          {user && !isOwner && listing.status !== 'sold' && (
            <div>
              {alreadyReported ? (
                <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '6px 0' }}>You have reported this listing.</p>
              ) : (
                <button onClick={() => setReportOpen(true)}
                  style={{ width: '100%', padding: '9px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all 0.2s' }}
                  onMouseOver={e => { e.currentTarget.style.color = '#e24b4a'; e.currentTarget.style.borderColor = '#f0b0b0' }}
                  onMouseOut={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
                  <Flag size={12} />Report this listing
                </button>
              )}
            </div>
          )}

          {/* Sale Deed Template Download */}
          {['approved', 'active', 'enquiring', 'negotiating', 'sold'].includes(listing.status) && (
            <div className="card" style={{ padding: 18, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--charcoal)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <FileText size={14} color="var(--forest)" /> Sale Deed Template
              </div>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.6 }}>
                Download a pre-filled template agreement to help both parties start the transfer process.
              </p>
              <button onClick={downloadSalesDeed} className="btn-outline" style={{ width: '100%', justifyContent: 'center', fontSize: 13, gap: 6 }}>
                Download Template
              </button>
              <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8, textAlign: 'center' }}>Opens in new tab → Print or Save as PDF</p>
            </div>
          )}

          {/* Sold notice */}
          {listing.status === 'sold' && (
            <div style={{ padding: 20, borderRadius: 12, background: 'var(--cream-dark)', textAlign: 'center', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
              <div style={{ fontWeight: 700, color: 'var(--charcoal)', fontSize: 14, marginBottom: 6 }}>This property has been sold</div>
              <Link href="/listings" style={{ fontSize: 13, color: 'var(--forest)', textDecoration: 'none', fontWeight: 500 }}>Browse other properties →</Link>
            </div>
          )}
        </div>
      </div>
      {/* Report modal */}
      {reportOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 420, padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--charcoal)' }}>Report Listing</h2>
              <button onClick={() => setReportOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleReport} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="label">Reason</label>
                <select value={reportReason} onChange={e => setReportReason(e.target.value)} className="input-field">
                  <option value="fraud">Fraudulent listing</option>
                  <option value="duplicate">Duplicate listing</option>
                  <option value="misleading">Misleading information</option>
                  <option value="wrong_price">Incorrect/unrealistic price</option>
                  <option value="spam">Spam or irrelevant</option>
                  <option value="other">Other reason</option>
                </select>
              </div>
              <div>
                <label className="label">Additional details (optional)</label>
                <textarea value={reportDesc} onChange={e => setReportDesc(e.target.value)} rows={3}
                  className="input-field" placeholder="Describe the issue..." style={{ resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={submittingReport}
                  style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#e24b4a', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)', opacity: submittingReport ? 0.7 : 1 }}>
                  {submittingReport ? 'Submitting...' : 'Submit Report'}
                </button>
                <button type="button" onClick={() => setReportOpen(false)} className="btn-ghost" style={{ fontSize: 13 }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
