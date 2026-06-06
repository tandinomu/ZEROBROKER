'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ListingCard from '@/components/ListingCard'
import type { Profile, Listing, Enquiry, Notification, ListingDocument, Message } from '@/lib/types'
import { formatPrice, STATUS_CONFIG, DOC_TYPES, DOC_STATUS_CONFIG } from '@/lib/types'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { Bell, Home, MessageCircle, Heart, User, CheckCircle, Clock, Trash2, Edit, Plus, LayoutDashboard, Eye, MapPin, Calendar, AlertCircle, ShieldCheck, XCircle, Phone, FileText, Upload, Send, ChevronDown, ChevronUp } from 'lucide-react'

function DashboardContent() {
  const params = useSearchParams()
  const router = useRouter()
  const [tab, setTab] = useState(params.get('tab') || 'overview')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [myListings, setMyListings] = useState<Listing[]>([])
  const [myEnquiries, setMyEnquiries] = useState<Enquiry[]>([])
  const [receivedEnquiries, setReceivedEnquiries] = useState<Enquiry[]>([])
  const [saved, setSaved] = useState<any[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [pendingApprovals, setPendingApprovals] = useState<(Listing & { _owner?: any })[]>([])
  const [approvedListings, setApprovedListings] = useState<Listing[]>([])
  const [approvedTotal, setApprovedTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [myDocs, setMyDocs] = useState<(ListingDocument & { listing_title?: string })[]>([])
  const [docUploadListingId, setDocUploadListingId] = useState('')
  const [docType, setDocType] = useState('ownership_certificate')
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<Message[]>([])
  const [chatInput, setChatInput] = useState('')
  const [sendingChat, setSendingChat] = useState(false)
  const chatChannelRef = useRef<any>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<any>(null)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { router.push('/auth/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', u.id).single()
      setProfile(prof)

      const [{ data: listings }, { data: enquiries }, { data: received }, { data: savedData }, { data: notifs }] = await Promise.all([
        // No profiles join — fixes FK ambiguity, we own these listings so profile join is redundant
        supabase.from('listings').select('*').eq('owner_id', u.id).order('created_at', { ascending: false }),
        supabase.from('enquiries')
          .select('*, listings(id,title,price,images,status,dzongkhag,gewog,location_name,property_type,is_featured,owner_id), seller:seller_id(full_name,phone)')
          .eq('buyer_id', u.id).order('created_at', { ascending: false }),
        supabase.from('enquiries')
          .select('*, listings(id,title,price,images,status,dzongkhag,location_name,property_type,is_featured,owner_id), buyer:buyer_id(full_name,phone,id)')
          .eq('seller_id', u.id).order('created_at', { ascending: false }),
        supabase.from('saved_listings').select('*, listings(*)').eq('user_id', u.id),
        supabase.from('notifications').select('*').eq('user_id', u.id).order('created_at', { ascending: false }).limit(20),
      ])

      setMyListings(listings || [])
      setMyEnquiries(enquiries || [])
      setReceivedEnquiries(received || [])
      setSaved(savedData || [])
      setNotifications(notifs || [])

      // Seller: fetch their documents
      if (prof?.role === 'seller' || prof?.role === 'both' || prof?.role === 'admin') {
        const { data: docsData } = await supabase
          .from('listing_documents')
          .select('*')
          .eq('owner_id', u.id)
          .order('created_at', { ascending: false })
        if (docsData && docsData.length > 0) {
          const listingIds = [...new Set(docsData.map((d: ListingDocument) => d.listing_id))]
          const { data: ltitles } = await supabase.from('listings').select('id,title').in('id', listingIds)
          const titleMap: Record<string, string> = {}
          ltitles?.forEach((l: any) => { titleMap[l.id] = l.title })
          setMyDocs(docsData.map((d: ListingDocument) => ({ ...d, listing_title: titleMap[d.listing_id] || 'Unknown listing' })))
        }
      }

      // Buyer: fetch approved listings to browse
      if (prof?.role === 'buyer') {
        const { data: approved, count: aCount } = await supabase
          .from('listings').select('*', { count: 'exact' })
          .in('status', ['approved', 'active', 'enquiring', 'negotiating'])
          .order('created_at', { ascending: false }).limit(6)
        setApprovedListings(approved || [])
        setApprovedTotal(aCount || 0)
      }

      // Admin: fetch ALL pending listings from all users
      if (prof?.role === 'admin') {
        const { data: allPending } = await supabase
          .from('listings').select('*').eq('status', 'pending')
          .order('created_at', { ascending: false })
        if (allPending && allPending.length > 0) {
          const ownerIds = [...new Set(allPending.map((l: Listing) => l.owner_id))]
          const { data: owners } = await supabase
            .from('profiles').select('id,full_name,phone,role').in('id', ownerIds)
          const ownerMap: Record<string, any> = {}
          owners?.forEach((o: any) => { ownerMap[o.id] = o })
          setPendingApprovals(allPending.map((l: Listing) => ({ ...l, _owner: ownerMap[l.owner_id] || null })))
        }
      }

      setLoading(false)

      // Real-time: watch for admin approval/rejection of seller's listings
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      channelRef.current = supabase.channel(`dashboard-${u.id}`)
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'listings',
          filter: `owner_id=eq.${u.id}`,
        }, payload => {
          setMyListings(prev => prev.map(l => l.id === payload.new.id ? { ...l, ...payload.new } as Listing : l))
          if (payload.new.status === 'approved') toast.success(`"${payload.new.title}" was approved by admin!`)
          if (payload.new.status === 'rejected') toast.error(`"${payload.new.title}" was rejected by admin.`)
        })
        .subscribe()
    }
    load()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [])

  async function openChat(enquiryId: string) {
    if (activeChatId === enquiryId) { setActiveChatId(null); return }
    setActiveChatId(enquiryId)
    const { data: msgs } = await supabase.from('messages').select('*, sender:sender_id(full_name)').eq('enquiry_id', enquiryId).order('created_at', { ascending: true })
    setChatMessages(msgs || [])
    if (chatChannelRef.current) supabase.removeChannel(chatChannelRef.current)
    chatChannelRef.current = supabase.channel(`chat-${enquiryId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `enquiry_id=eq.${enquiryId}` },
        async payload => {
          const { data: sender } = await supabase.from('profiles').select('full_name').eq('id', payload.new.sender_id).single()
          setChatMessages(prev => [...prev, { ...payload.new, sender } as Message])
          setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        })
      .subscribe()
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  async function sendChatMessage(enquiryId: string, otherUserId: string) {
    if (!chatInput.trim() || sendingChat) return
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) return
    setSendingChat(true)
    const { error } = await supabase.from('messages').insert({ enquiry_id: enquiryId, sender_id: u.id, content: chatInput.trim(), is_read: false })
    if (error) toast.error(error.message)
    else {
      setChatInput('')
      await supabase.from('notifications').insert({ user_id: otherUserId, title: 'New message', message: chatInput.trim().slice(0, 60), type: 'message', link: '/dashboard?tab=enquiries' })
    }
    setSendingChat(false)
  }

  async function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !docUploadListingId) { toast.error('Select a listing first'); return }
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) return
    setUploadingDoc(true)
    const ext = file.name.split('.').pop()
    const path = `${docUploadListingId}/${docType}_${Date.now()}.${ext}`
    const { data, error } = await supabase.storage.from('listing-documents').upload(path, file)
    if (error) { toast.error('Upload failed: ' + error.message); setUploadingDoc(false); return }
    const listing = myListings.find(l => l.id === docUploadListingId)
    const { data: doc, error: docErr } = await supabase.from('listing_documents').insert({
      listing_id: docUploadListingId, owner_id: u.id, doc_type: docType, doc_url: data.path, file_name: file.name, status: 'pending',
    }).select().single()
    if (docErr) toast.error(docErr.message)
    else { setMyDocs(prev => [{ ...doc, listing_title: listing?.title || '' }, ...prev]); toast.success('Document uploaded — pending review') }
    setUploadingDoc(false)
    e.target.value = ''
  }

  async function deleteListing(id: string) {
    if (!confirm('Delete this listing? This cannot be undone.')) return
    await supabase.from('listings').delete().eq('id', id)
    setMyListings(prev => prev.filter(l => l.id !== id))
    toast.success('Listing deleted')
  }

  async function approveListing(id: string) {
    const { data: { user: u } } = await supabase.auth.getUser()
    const { error } = await supabase.from('listings').update({
      status: 'approved', approved_at: new Date().toISOString(), approved_by: u?.id,
    }).eq('id', id)
    if (error) { toast.error(error.message); return }
    setPendingApprovals(prev => prev.filter(l => l.id !== id))
    toast.success('Listing approved and now live!')
  }

  async function rejectListing(id: string) {
    const { error } = await supabase.from('listings').update({ status: 'rejected' }).eq('id', id)
    if (error) { toast.error(error.message); return }
    setPendingApprovals(prev => prev.filter(l => l.id !== id))
    toast.success('Listing rejected')
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
  const canList = profile?.role === 'seller' || profile?.role === 'both' || profile?.role === 'admin'
  const isAdmin = profile?.role === 'admin'

  const tabs = [
    { id: 'overview',   label: 'Overview',           icon: <LayoutDashboard size={14} /> },
    ...(isAdmin ? [{ id: 'approvals', label: 'Pending Approvals', icon: <ShieldCheck size={14} />, badge: pendingApprovals.length, urgent: true }] : []),
    ...(canList ? [{ id: 'listings',  label: 'My Listings',       icon: <Home size={14} /> }] : []),
    ...(canList ? [{ id: 'documents', label: 'Documents',          icon: <FileText size={14} /> }] : []),
    { id: 'enquiries',  label: 'My Enquiries',        icon: <MessageCircle size={14} /> },
    ...(canList ? [{ id: 'received',  label: 'Received Enquiries', icon: <MessageCircle size={14} /> }] : []),
    { id: 'saved',       label: 'Saved',              icon: <Heart size={14} /> },
    { id: 'notifications', label: 'Notifications',    icon: <Bell size={14} />, badge: unread },
    { id: 'profile',     label: 'Profile',            icon: <User size={14} /> },
  ]

  if (loading) return (
    <div style={{ padding: '100px 0', textAlign: 'center' }}>
      <div className="animate-spin" style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--forest)', margin: '0 auto 16px' }} />
      <p style={{ color: 'var(--muted)', fontSize: 14 }}>Loading dashboard...</p>
    </div>
  )

  const draftCount = myListings.filter(l => l.status === 'draft').length
  const pendingCount = myListings.filter(l => l.status === 'pending').length
  const approvedCount = myListings.filter(l => ['approved', 'active', 'enquiring', 'negotiating'].includes(l.status)).length
  const archivedCount = myListings.filter(l => l.status === 'archived').length

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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', marginBottom: 24, overflowX: 'auto' }} className="dashboard-tabs">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '10px 12px', border: 'none', borderBottom: tab === t.id ? '2px solid var(--forest)' : '2px solid transparent', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 600 : 400, color: tab === t.id ? 'var(--forest)' : 'var(--muted)', whiteSpace: 'nowrap', fontFamily: 'var(--font-body)' }}>
            {t.icon}{t.label}
            {(t as any).badge > 0 ? (
              <span style={{ background: (t as any).urgent ? '#FAC775' : '#e24b4a', color: (t as any).urgent ? '#633806' : 'white', borderRadius: 10, minWidth: 18, height: 18, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, padding: '0 5px' }}>
                {(t as any).badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14, marginBottom: 24 }}>
            {[
              canList
                ? { label: 'My Listings', value: myListings.length, icon: <Home size={20} />, onClick: () => setTab('listings') }
                : { label: 'Available Properties', value: approvedTotal, icon: <Home size={20} />, onClick: () => router.push('/listings') },
              { label: 'My Enquiries', value: myEnquiries.length, icon: <MessageCircle size={20} />, onClick: () => setTab('enquiries') },
              { label: 'Saved Properties', value: saved.length, icon: <Heart size={20} />, onClick: () => setTab('saved') },
              { label: 'Notifications', value: unread, icon: <Bell size={20} />, onClick: () => setTab('notifications') },
            ].map(s => (
              <button key={s.label} onClick={s.onClick} className="card"
                style={{ padding: 20, textAlign: 'center', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--white)', fontFamily: 'var(--font-body)', transition: 'all 0.2s' }}
                onMouseOver={e => (e.currentTarget.style.boxShadow = 'var(--shadow-md)')}
                onMouseOut={e => (e.currentTarget.style.boxShadow = 'var(--shadow-sm)')}>
                <div style={{ color: 'var(--forest)', display: 'flex', justifyContent: 'center', marginBottom: 8 }}>{s.icon}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, color: 'var(--forest)' }}>{s.value}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{s.label}</div>
              </button>
            ))}
          </div>

          {/* Seller: approval summary */}
          {canList && myListings.length > 0 && (
            <div className="card" style={{ padding: 18, marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--charcoal)', marginBottom: 14 }}>Listing Status</h2>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {[
                  { label: 'Drafts',           count: draftCount,    bg: '#F1EFE8', color: '#444441' },
                  { label: 'Pending Review',    count: pendingCount,  bg: '#FAC775', color: '#633806' },
                  { label: 'Published',         count: approvedCount, bg: '#C0DD97', color: '#27500A' },
                  { label: 'Rejected',          count: myListings.filter(l => l.status === 'rejected').length, bg: '#FCEBEB', color: '#7c1e1e' },
                  { label: 'Sold',              count: myListings.filter(l => l.status === 'sold').length, bg: '#D3D1C7', color: '#3d3d3a' },
                  { label: 'Archived',          count: archivedCount, bg: '#E8E6E0', color: '#444441' },
                ].filter(s => s.count > 0).map(s => (
                  <div key={s.label} style={{ flex: 1, minWidth: 90, padding: '12px 14px', borderRadius: 10, background: s.bg, textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: s.color }}>{s.count}</div>
                    <div style={{ fontSize: 11, color: s.color, marginTop: 2, fontWeight: 500 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Buyer: show approved listings grid */}
          {!canList && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--charcoal)' }}>Available Properties</h2>
                  <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>{approvedTotal} approved listings ready to view</p>
                </div>
                <Link href="/listings" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--forest)', fontWeight: 600, textDecoration: 'none' }}>
                  Browse all →
                </Link>
              </div>
              {approvedListings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', background: 'var(--cream-dark)', borderRadius: 12 }}>
                  <Home size={32} style={{ color: 'var(--sage)', marginBottom: 10 }} />
                  <p style={{ color: 'var(--muted)', fontSize: 14 }}>No approved properties yet.</p>
                  <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>Check back soon — new listings are reviewed daily.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                  {approvedListings.map(l => <ListingCard key={l.id} listing={l} />)}
                </div>
              )}
            </div>
          )}

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
                    <span className="status-badge" style={{ background: 'var(--cream-dark)', color: 'var(--charcoal-mid)', textTransform: 'capitalize' }}>{e.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PENDING APPROVALS (Admin only) ── */}
      {tab === 'approvals' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, var(--forest), var(--forest-mid))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ShieldCheck size={18} color="white" />
            </div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--charcoal)', lineHeight: 1 }}>Pending Approvals</h2>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>Review and approve or reject property listings submitted by sellers</p>
            </div>
          </div>

          {pendingApprovals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 0' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#C0DD97', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <CheckCircle size={28} color="#27500A" />
              </div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--charcoal)', marginBottom: 6 }}>All caught up!</h3>
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>No listings are waiting for approval right now.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {pendingApprovals.map(l => {
                const thumbnail = l.images?.[0] || `https://picsum.photos/seed/${l.id}/200/140`
                const daysAgo = Math.floor((Date.now() - new Date(l.created_at).getTime()) / 86400000)
                return (
                  <div key={l.id} className="card" style={{ overflow: 'hidden' }}>
                    <div style={{ display: 'flex' }}>
                      {/* Thumbnail */}
                      <div style={{ width: 160, flexShrink: 0, position: 'relative', background: 'var(--cream-dark)' }}>
                        <img src={thumbnail} alt={l.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', minHeight: 130, display: 'block' }}
                          onError={e => { e.currentTarget.src = `https://picsum.photos/seed/${l.id}x/200/140` }} />
                        {daysAgo > 3 && (
                          <div style={{ position: 'absolute', top: 8, left: 8, background: '#FCEBEB', color: '#e24b4a', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>
                            {daysAgo}d waiting
                          </div>
                        )}
                        {daysAgo === 0 && (
                          <div style={{ position: 'absolute', top: 8, left: 8, background: '#C0DD97', color: '#27500A', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>
                            New today
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
                        <div>
                          {/* Title row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                            <div style={{ minWidth: 0 }}>
                              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--charcoal)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {l.title}
                              </h3>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--muted)', fontSize: 12 }}>
                                <MapPin size={11} style={{ flexShrink: 0 }} />
                                {l.location_name}{l.gewog ? `, ${l.gewog}` : ''}, {l.dzongkhag}
                              </div>
                            </div>
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--forest)', flexShrink: 0 }}>
                              {formatPrice(l.price)}
                            </div>
                          </div>

                          {/* Description preview */}
                          <p style={{ fontSize: 12, color: 'var(--charcoal-mid)', lineHeight: 1.65, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {l.description}
                          </p>

                          {/* Submitted by */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--cream)', borderRadius: 8, fontSize: 12 }}>
                            <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                              {l._owner?.full_name?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ color: 'var(--charcoal)', fontWeight: 600 }}>{l._owner?.full_name || 'Unknown user'}</span>
                              <span style={{ color: 'var(--muted)' }}> · </span>
                              <span style={{ color: 'var(--muted)', textTransform: 'capitalize' }}>{l._owner?.role}</span>
                              {l._owner?.phone && (
                                <><span style={{ color: 'var(--muted)' }}> · </span>
                                  <a href={`tel:${l._owner.phone}`} style={{ color: 'var(--forest)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                    <Phone size={11} />{l._owner.phone}
                                  </a>
                                </>
                              )}
                            </div>
                            <span style={{ color: 'var(--muted)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                              <Calendar size={10} />{new Date(l.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                          <button onClick={() => approveListing(l.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, border: 'none', background: '#1D9E75', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'opacity 0.15s' }}
                            onMouseOver={e => (e.currentTarget.style.opacity = '0.85')}
                            onMouseOut={e => (e.currentTarget.style.opacity = '1')}>
                            <CheckCircle size={14} />Approve
                          </button>
                          <button onClick={() => rejectListing(l.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, border: '1.5px solid #e24b4a', color: '#e24b4a', background: 'transparent', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s' }}
                            onMouseOver={e => (e.currentTarget.style.background = '#FCEBEB')}
                            onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
                            <XCircle size={14} />Reject
                          </button>
                          <Link href={`/listings/${l.id}`} target="_blank"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 8, border: '1.5px solid var(--border)', color: 'var(--charcoal-mid)', fontSize: 13, fontWeight: 500, textDecoration: 'none', transition: 'all 0.15s' }}
                            onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--forest)'; e.currentTarget.style.color = 'var(--forest)' }}
                            onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--charcoal-mid)' }}>
                            <Eye size={13} />Preview
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MY LISTINGS (Seller view) ── */}
      {tab === 'listings' && (
        <div>
          {/* Approval status summary bar */}
          {myListings.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              {[
                { status: 'draft',    label: 'Drafts',         bg: '#F1EFE8', color: '#444441', count: myListings.filter(l => l.status === 'draft').length },
                { status: 'pending',  label: 'Under Review',   bg: '#FAC775', color: '#633806', count: myListings.filter(l => l.status === 'pending').length },
                { status: 'approved', label: 'Published',      bg: '#C0DD97', color: '#27500A', count: myListings.filter(l => ['approved','active','enquiring','negotiating'].includes(l.status)).length },
                { status: 'rejected', label: 'Rejected',       bg: '#FCEBEB', color: '#7c1e1e', count: myListings.filter(l => l.status === 'rejected').length },
                { status: 'archived', label: 'Archived',       bg: '#E8E6E0', color: '#444441', count: myListings.filter(l => l.status === 'archived').length },
              ].map(s => s.count > 0 && (
                <div key={s.status} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: s.bg, fontSize: 12, fontWeight: 600, color: s.color }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                  {s.count} {s.label}
                </div>
              ))}
            </div>
          )}

          {myListings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 0' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--cream-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Home size={28} color="var(--sage)" />
              </div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--charcoal)', marginBottom: 6 }}>No listings yet</h3>
              <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20 }}>Create your first property listing to get started.</p>
              <Link href="/listings/new" className="btn-primary" style={{ display: 'inline-flex' }}>
                <Plus size={14} />Create first listing
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {myListings.map(l => {
                const statusCfg = STATUS_CONFIG[l.status] || STATUS_CONFIG.approved
                const thumbnail = l.images?.[0] || `https://picsum.photos/seed/${l.id}/120/80`
                return (
                  <div key={l.id} className="card" style={{ display: 'flex', gap: 0, overflow: 'hidden', transition: 'box-shadow 0.2s' }}>
                    {/* Status accent bar */}
                    <div style={{ width: 4, flexShrink: 0, background: statusCfg.bg, borderLeft: `4px solid ${statusCfg.color}` }} />
                    {/* Thumbnail */}
                    <div style={{ width: 100, flexShrink: 0, overflow: 'hidden', background: 'var(--cream-dark)' }}>
                      <img src={thumbnail} alt={l.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', minHeight: 80, display: 'block' }}
                        onError={e => { e.currentTarget.src = `https://picsum.photos/seed/${l.id}x/120/80` }} />
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', minWidth: 0 }}>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {l.title}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <MapPin size={11} />{l.location_name}, {l.dzongkhag}
                          <span style={{ color: 'var(--border)' }}>·</span>
                          <strong style={{ color: 'var(--forest)' }}>{formatPrice(l.price)}</strong>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={10} />Submitted {new Date(l.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      {/* Status badge */}
                      <div style={{ flexShrink: 0, maxWidth: 200, minWidth: 120 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: statusCfg.bg, color: statusCfg.color, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {l.status === 'pending' && <Clock size={12} />}
                          {['approved', 'active', 'enquiring', 'negotiating'].includes(l.status) && <CheckCircle size={12} />}
                          {l.status === 'rejected' && <AlertCircle size={12} />}
                          {statusCfg.label}
                        </span>
                        {l.status === 'pending' && (
                          <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', marginTop: 4 }}>Awaiting admin review</div>
                        )}
                        {l.status === 'rejected' && l.rejection_reason && (
                          <div style={{ fontSize: 11, color: '#7c1e1e', marginTop: 5, padding: '5px 8px', background: '#FCEBEB', borderRadius: 6, lineHeight: 1.4 }}>
                            {l.rejection_reason}
                          </div>
                        )}
                      </div>
                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                        <Link href={`/listings/${l.id}`}
                          style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', textDecoration: 'none', transition: 'all 0.15s' }}
                          title="View listing"
                          onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--forest)'; e.currentTarget.style.color = 'var(--forest)' }}
                          onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
                          <Eye size={13} />
                        </Link>
                        {(l.status === 'draft' || l.status === 'rejected') && (
                          <Link href={`/listings/${l.id}/edit`}
                            style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', textDecoration: 'none', transition: 'all 0.15s' }}
                            title="Edit listing"
                            onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--forest)'; e.currentTarget.style.color = 'var(--forest)' }}
                            onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
                            <Edit size={13} />
                          </Link>
                        )}
                        <button onClick={() => deleteListing(l.id)}
                          style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', cursor: 'pointer', transition: 'all 0.15s' }}
                          title="Delete listing"
                          onMouseOver={e => { e.currentTarget.style.borderColor = '#e24b4a'; e.currentTarget.style.color = '#e24b4a' }}
                          onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── DOCUMENTS (Seller view) ── */}
      {tab === 'documents' && (
        <div>
          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--charcoal)', marginBottom: 6 }}>Upload a Document</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>Upload ownership certificates, tax clearances, CIDs and other documents to get your listing verified.</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 180px' }}>
                <label className="label">Listing</label>
                <select value={docUploadListingId} onChange={e => setDocUploadListingId(e.target.value)} className="input-field">
                  <option value="">Select a listing...</option>
                  {myListings.filter(l => l.status !== 'rejected').map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
                </select>
              </div>
              <div style={{ flex: '1 1 180px' }}>
                <label className="label">Document Type</label>
                <select value={docType} onChange={e => setDocType(e.target.value)} className="input-field">
                  {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <label className="btn-primary" style={{ cursor: 'pointer', flexShrink: 0 }}>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={handleDocUpload} disabled={uploadingDoc || !docUploadListingId} />
                <Upload size={14} />{uploadingDoc ? 'Uploading...' : 'Upload'}
              </label>
            </div>
          </div>

          {myDocs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)' }}>
              <FileText size={36} style={{ margin: '0 auto 12px', color: 'var(--sage)' }} />
              <p>No documents uploaded yet</p>
              <p style={{ fontSize: 12, marginTop: 6 }}>Upload documents above to get your listings verified</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {myDocs.map(d => {
                const cfg = DOC_STATUS_CONFIG[d.status]
                const dtype = DOC_TYPES.find(t => t.value === d.doc_type)
                return (
                  <div key={d.id} className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileText size={16} color={cfg.color} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal)' }}>{dtype?.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {d.listing_title} {d.file_name ? `· ${d.file_name}` : ''}
                        </div>
                        {d.rejection_reason && <div style={{ fontSize: 11, color: '#e24b4a', marginTop: 2 }}>Rejected: {d.rejection_reason}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                      <button type="button" onClick={() => viewDoc(d.doc_url)} className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }}>View</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MY ENQUIRIES (Buyer view) ── */}
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
            const statusCfg = STATUS_CONFIG[(lst?.status || 'approved') as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.approved
            const isActive = activeChatId === e.id
            return (
              <div key={e.id} className="card" style={{ overflow: 'hidden' }}>
                <div style={{ padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                    <div>
                      <Link href={`/listings/${lst?.id}`} style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--charcoal)', textDecoration: 'none' }}>{lst?.title}</Link>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{lst?.dzongkhag} · {formatPrice(lst?.price)}</div>
                    </div>
                    <span className="status-badge" style={{ background: statusCfg.bg, color: statusCfg.color }}>{statusCfg.label}</span>
                  </div>
                  <div style={{ background: 'var(--cream-dark)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--charcoal-mid)', marginBottom: 10, fontStyle: 'italic' }}>
                    "{e.message}"
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Status: <strong style={{ color: 'var(--charcoal)', textTransform: 'capitalize' }}>{e.status}</strong></div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {e.status === 'negotiating' && !e.buyer_confirmed_deal && (
                        <button onClick={() => confirmDeal(e.id, false)} className="btn-primary" style={{ fontSize: 12, padding: '6px 12px', background: '#1D9E75' }}>Confirm Deal</button>
                      )}
                      {(e.status === 'accepted' || e.status === 'negotiating') && (
                        <button onClick={() => openChat(e.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '6px 12px', borderRadius: 8, border: '1.5px solid var(--forest)', color: 'var(--forest)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                          <MessageCircle size={12} />Chat {isActive ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {isActive && (
                  <div style={{ borderTop: '1px solid var(--border)', background: 'var(--cream)' }}>
                    <div style={{ padding: '14px 18px', maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {chatMessages.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>No messages yet. Say hello!</p>}
                      {chatMessages.map(m => {
                        const isMe = m.sender_id === profile?.id
                        return (
                          <div key={m.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                            <div style={{ maxWidth: '75%', padding: '8px 12px', borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px', background: isMe ? 'var(--forest)' : 'var(--white)', color: isMe ? 'white' : 'var(--charcoal)', fontSize: 13, boxShadow: 'var(--shadow-sm)' }}>
                              {!isMe && <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 3, color: 'var(--forest)', opacity: isMe ? 0 : 1 }}>{(m as any).sender?.full_name}</div>}
                              {m.content}
                              <div style={{ fontSize: 10, opacity: 0.6, marginTop: 3, textAlign: 'right' }}>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                          </div>
                        )
                      })}
                      <div ref={chatBottomRef} />
                    </div>
                    <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                      <input value={chatInput} onChange={ev => setChatInput(ev.target.value)}
                        onKeyDown={ev => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); sendChatMessage(e.id, e.seller_id) } }}
                        className="input-field" placeholder="Type a message..." style={{ flex: 1, padding: '8px 12px', fontSize: 13 }} />
                      <button onClick={() => sendChatMessage(e.id, e.seller_id)} disabled={sendingChat || !chatInput.trim()}
                        style={{ width: 38, height: 38, borderRadius: 8, border: 'none', background: 'var(--forest)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (!chatInput.trim() || sendingChat) ? 0.5 : 1 }}>
                        <Send size={15} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── RECEIVED ENQUIRIES (Seller view) ── */}
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
            const isActive = activeChatId === e.id
            return (
              <div key={e.id} className="card" style={{ overflow: 'hidden' }}>
                <div style={{ padding: 18 }}>
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
                    <span className="status-badge" style={{ background: 'var(--cream-dark)', color: 'var(--charcoal-mid)', textTransform: 'capitalize' }}>{e.status}</span>
                  </div>
                  <Link href={`/listings/${lst?.id}`} style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none', display: 'block', marginBottom: 8 }}>
                    on: <strong style={{ color: 'var(--forest)' }}>{lst?.title}</strong>
                  </Link>
                  <div style={{ background: 'var(--cream-dark)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--charcoal-mid)', marginBottom: 10, fontStyle: 'italic' }}>
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
                      <>
                        <button onClick={() => updateEnquiryStatus(e.id, 'negotiating')} className="btn-outline" style={{ fontSize: 12, padding: '7px 14px' }}>Start Negotiating</button>
                        <button onClick={() => openChat(e.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '7px 12px', borderRadius: 8, border: '1.5px solid var(--forest)', color: 'var(--forest)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                          <MessageCircle size={12} />Chat {isActive ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      </>
                    )}
                    {e.status === 'negotiating' && (
                      <>
                        {!e.seller_confirmed_deal && (
                          <button onClick={() => confirmDeal(e.id, true)} className="btn-primary" style={{ fontSize: 12, padding: '7px 14px', background: '#1D9E75' }}>Confirm Deal</button>
                        )}
                        <button onClick={() => openChat(e.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '7px 12px', borderRadius: 8, border: '1.5px solid var(--forest)', color: 'var(--forest)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                          <MessageCircle size={12} />Chat {isActive ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {isActive && (
                  <div style={{ borderTop: '1px solid var(--border)', background: 'var(--cream)' }}>
                    <div style={{ padding: '14px 18px', maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {chatMessages.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>No messages yet.</p>}
                      {chatMessages.map(m => {
                        const isMe = m.sender_id === profile?.id
                        return (
                          <div key={m.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                            <div style={{ maxWidth: '75%', padding: '8px 12px', borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px', background: isMe ? 'var(--forest)' : 'var(--white)', color: isMe ? 'white' : 'var(--charcoal)', fontSize: 13, boxShadow: 'var(--shadow-sm)' }}>
                              {!isMe && <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 3, color: isMe ? 'rgba(255,255,255,0.7)' : 'var(--forest)' }}>{(m as any).sender?.full_name}</div>}
                              {m.content}
                              <div style={{ fontSize: 10, opacity: 0.6, marginTop: 3, textAlign: 'right' }}>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                          </div>
                        )
                      })}
                      <div ref={chatBottomRef} />
                    </div>
                    <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                      <input value={chatInput} onChange={ev => setChatInput(ev.target.value)}
                        onKeyDown={ev => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); sendChatMessage(e.id, e.buyer_id) } }}
                        className="input-field" placeholder="Type a message..." style={{ flex: 1, padding: '8px 12px', fontSize: 13 }} />
                      <button onClick={() => sendChatMessage(e.id, e.buyer_id)} disabled={sendingChat || !chatInput.trim()}
                        style={{ width: 38, height: 38, borderRadius: 8, border: 'none', background: 'var(--forest)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (!chatInput.trim() || sendingChat) ? 0.5 : 1 }}>
                        <Send size={15} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── SAVED ── */}
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

      {/* ── NOTIFICATIONS ── */}
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

      {/* ── PROFILE ── */}
      {tab === 'profile' && profile && <ProfileEditor profile={profile} onSave={setProfile} />}
    </div>
  )
}

function ProfileEditor({ profile, onSave }: { profile: Profile, onSave: (p: Profile) => void }) {
  const [form, setForm] = useState({ full_name: profile.full_name, phone: profile.phone || '' })
  const [saving, setSaving] = useState(false)
  const [uploadingCid, setUploadingCid] = useState<'front' | 'back' | null>(null)
  const [cidFrontUrl, setCidFrontUrl] = useState(profile.cid_url || '')
  const [cidBackUrl, setCidBackUrl] = useState((profile as any).cid_back_url || '')
  const [cidStatus, setCidStatus] = useState(profile.cid_status || 'unverified')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const supabase = createClient()

  async function save(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const { data, error } = await supabase.from('profiles').update(form).eq('id', profile.id).select().single()
    if (error) toast.error(error.message)
    else { onSave(data); toast.success('Profile updated!') }
    setSaving(false)
  }

  async function uploadCid(e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingCid(side)
    const ext = file.name.split('.').pop()
    const path = `${profile.id}/cid_${side}_${Date.now()}.${ext}`
    const { data, error } = await supabase.storage.from('cid-documents').upload(path, file, { upsert: true })
    if (error) { toast.error('Upload failed: ' + error.message); setUploadingCid(null); return }
    // Store the file path (not a public URL) — bucket is private, use signed URLs to view
    const storedPath = data.path
    const field = side === 'front' ? 'cid_url' : 'cid_back_url'
    const otherSideDone = side === 'front' ? !!cidBackUrl : !!cidFrontUrl
    const updates: any = { [field]: storedPath }
    if (otherSideDone) updates.cid_status = 'pending'
    const { data: updated, error: upErr } = await supabase.from('profiles').update(updates).eq('id', profile.id).select().single()
    if (upErr) toast.error(upErr.message)
    else {
      if (side === 'front') setCidFrontUrl(storedPath)
      else setCidBackUrl(storedPath)
      if (updates.cid_status) setCidStatus('pending')
      onSave(updated)
      toast.success(`CID ${side} uploaded!${otherSideDone ? ' Both sides submitted — pending admin verification.' : ' Upload the other side too.'}`)
    }
    setUploadingCid(null)
    e.target.value = ''
  }

  function extractStoragePath(urlOrPath: string, bucket: string): string {
    if (urlOrPath.startsWith('http')) {
      const marker = `/${bucket}/`
      const idx = urlOrPath.indexOf(marker)
      return idx !== -1 ? urlOrPath.slice(idx + marker.length) : urlOrPath
    }
    return urlOrPath
  }

  async function viewDoc(urlOrPath: string) {
    const path = extractStoragePath(urlOrPath, 'listing-documents')
    const { data, error } = await supabase.storage.from('listing-documents').createSignedUrl(path, 60)
    if (error || !data) { toast.error('Could not open file'); return }
    setPreviewUrl(data.signedUrl)
  }

  async function viewCid(urlOrPath: string) {
    const path = extractStoragePath(urlOrPath, 'cid-documents')
    const { data, error } = await supabase.storage.from('cid-documents').createSignedUrl(path, 60)
    if (error || !data) { toast.error('Could not open file'); return }
    setPreviewUrl(data.signedUrl)
  }

  const cidStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
    unverified: { label: 'Not uploaded',     color: '#444441', bg: '#F1EFE8' },
    pending:    { label: 'Under review',      color: '#633806', bg: '#FAC775' },
    verified:   { label: 'Verified',          color: '#27500A', bg: '#C0DD97' },
    rejected:   { label: 'Rejected — re-upload', color: '#7c1e1e', bg: '#FCEBEB' },
  }
  const cidCfg = cidStatusConfig[cidStatus] || cidStatusConfig.unverified

  return (
    <><div style={{ maxWidth: 520 }}>
      <div className="card" style={{ padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, var(--forest), var(--forest-mid))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 22, fontWeight: 700 }}>
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

      {/* CID Verification */}
      <div className="card" style={{ padding: 26, marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--charcoal)' }}>Identity Verification (CID)</h3>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: cidCfg.bg, color: cidCfg.color }}>{cidCfg.label}</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 18 }}>
          Upload both sides of your Citizen Identity Document (CID). Required before submitting listings for review.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {(['front', 'back'] as const).map(side => {
            const url = side === 'front' ? cidFrontUrl : cidBackUrl
            return (
              <div key={side}>
                <label className="label" style={{ textTransform: 'capitalize' }}>CID {side}</label>
                <label style={{ display: 'block', border: `2px dashed ${url ? 'var(--forest)' : 'var(--border)'}`, borderRadius: 10, padding: '14px 10px', textAlign: 'center', cursor: 'pointer', background: url ? 'rgba(26,58,42,0.04)' : 'var(--cream)', transition: 'all 0.2s' }}>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={e => uploadCid(e, side)} disabled={uploadingCid !== null} />
                  {url ? (
                    <div>
                      <div style={{ fontSize: 20, marginBottom: 4 }}>✓</div>
                      <div style={{ fontSize: 11, color: 'var(--forest)', fontWeight: 600 }}>Uploaded</div>
                      <button type="button" onClick={e => { e.stopPropagation(); viewCid(url) }} style={{ fontSize: 11, color: 'var(--muted)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>View</button>
                    </div>
                  ) : (
                    <div>
                      <Upload size={18} style={{ color: 'var(--muted)', margin: '0 auto 6px', display: 'block' }} />
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {uploadingCid === side ? 'Uploading...' : `Upload ${side}`}
                      </div>
                    </div>
                  )}
                </label>
              </div>
            )
          })}
        </div>
        {cidStatus === 'rejected' && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#FCEBEB', borderRadius: 8, fontSize: 13, color: '#7c1e1e' }}>
            Your CID was rejected. Please re-upload clearer photos.
          </div>
        )}
        {cidStatus === 'pending' && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#FAC775', borderRadius: 8, fontSize: 13, color: '#633806' }}>
            CID submitted and under admin review. You can still submit listings while waiting.
          </div>
        )}
        {cidStatus === 'verified' && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#C0DD97', borderRadius: 8, fontSize: 13, color: '#27500A' }}>
            Identity verified. You can submit listings for review.
          </div>
        )}
      </div>
    </div>

    {previewUrl && (
      <div
        onClick={() => setPreviewUrl(null)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      >
        <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
          <button
            onClick={() => setPreviewUrl(null)}
            style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >×</button>
          {previewUrl.match(/\.pdf(\?|$)/i)
            ? <iframe src={previewUrl} style={{ width: '80vw', height: '80vh', border: 'none' }} />
            : <img src={previewUrl} alt="Preview" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', display: 'block' }} />
          }
        </div>
      </div>
    )}
    </>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: '100px 0', textAlign: 'center' }}>
        <div className="animate-spin" style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--forest)', margin: '0 auto 12px' }} />
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>Loading...</p>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
