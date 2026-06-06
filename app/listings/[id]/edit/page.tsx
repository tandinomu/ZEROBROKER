'use client'
import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DZONGKHAGS, PROPERTY_TYPES } from '@/lib/types'
import { isEditable } from '@/lib/listing-lifecycle'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>(null)
  const [listingStatus, setListingStatus] = useState<string>('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: lst } = await supabase.from('listings').select('*').eq('id', id).eq('owner_id', user.id).single()
      if (!lst) { toast.error('Listing not found or access denied'); router.push('/dashboard'); return }
      if (!isEditable(lst.status)) {
        toast.error(`Listings with status "${lst.status}" cannot be edited. Only drafts and rejected listings can be edited.`)
        router.push(`/listings/${id}`)
        return
      }
      setListingStatus(lst.status)
      setForm({
        title: lst.title, description: lst.description, price: lst.price.toString(),
        property_type: lst.property_type, dzongkhag: lst.dzongkhag, gewog: lst.gewog || '',
        location_name: lst.location_name, latitude: lst.latitude?.toString() || '',
        longitude: lst.longitude?.toString() || '', bedrooms: lst.bedrooms?.toString() || '',
        bathrooms: lst.bathrooms?.toString() || '', area_sqft: lst.area_sqft?.toString() || '',
        is_featured: lst.is_featured, amenities: lst.amenities?.join(', ') || '',
      })
      setLoading(false)
    }
    load()
  }, [id])

  function set(key: string, val: any) { setForm((f: any) => ({ ...f, [key]: val })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const amenitiesArr = form.amenities ? form.amenities.split(',').map((s: string) => s.trim()).filter(Boolean) : []
    const { error } = await supabase.from('listings').update({
      title: form.title, description: form.description, price: parseFloat(form.price),
      property_type: form.property_type, dzongkhag: form.dzongkhag, gewog: form.gewog || null,
      location_name: form.location_name,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      bedrooms: form.bedrooms ? parseInt(form.bedrooms) : null,
      bathrooms: form.bathrooms ? parseInt(form.bathrooms) : null,
      area_sqft: form.area_sqft ? parseFloat(form.area_sqft) : null,
      is_featured: form.is_featured, amenities: amenitiesArr,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Listing updated!'); router.push(`/listings/${id}`) }
    setSaving(false)
  }

  if (loading || !form) return <div className="container-main page-pad" style={{ color: 'var(--muted)' }}>Loading...</div>

  return (
    <div className="container-main page-pad" style={{ maxWidth: 680 }}>
      <Link href={`/listings/${id}`} style={{ fontSize: 14, color: 'var(--muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 20 }}>
        Back to listing
      </Link>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--forest)', marginBottom: 22 }}>Edit Listing</h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--charcoal)', marginBottom: 14 }}>Basic Info</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div><label className="label">Title</label><input value={form.title} onChange={e => set('title', e.target.value)} required className="input-field" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              <div><label className="label">Type</label><select value={form.property_type} onChange={e => set('property_type', e.target.value)} className="input-field">{PROPERTY_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></div>
              <div><label className="label">Price (Nu.)</label><input type="number" value={form.price} onChange={e => set('price', e.target.value)} required className="input-field" min="0" /></div>
            </div>
            <div><label className="label">Description</label><textarea value={form.description} onChange={e => set('description', e.target.value)} required rows={4} className="input-field" style={{ resize: 'vertical' }} /></div>
            {listingStatus === 'rejected' && (
              <div style={{ padding: '10px 14px', background: '#FCEBEB', borderRadius: 8, fontSize: 13, color: '#7c1e1e' }}>
                This listing was rejected. Fix the issues below then return to the listing page to resubmit.
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--charcoal)', marginBottom: 14 }}>Location</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            <div><label className="label">Dzongkhag</label><select value={form.dzongkhag} onChange={e => set('dzongkhag', e.target.value)} className="input-field">{DZONGKHAGS.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
            <div><label className="label">Gewog</label><input value={form.gewog} onChange={e => set('gewog', e.target.value)} className="input-field" placeholder="Sub-district" /></div>
            <div><label className="label">Location Name</label><input value={form.location_name} onChange={e => set('location_name', e.target.value)} required className="input-field" /></div>
            <div><label className="label">Latitude</label><input type="number" value={form.latitude} onChange={e => set('latitude', e.target.value)} className="input-field" step="any" /></div>
            <div><label className="label">Longitude</label><input type="number" value={form.longitude} onChange={e => set('longitude', e.target.value)} className="input-field" step="any" /></div>
          </div>
        </div>

        {!['land','vehicle'].includes(form.property_type) && (
          <div className="card" style={{ padding: 20 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--charcoal)', marginBottom: 14 }}>Details</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              <div><label className="label">Bedrooms</label><input type="number" value={form.bedrooms} onChange={e => set('bedrooms', e.target.value)} className="input-field" min="0" /></div>
              <div><label className="label">Bathrooms</label><input type="number" value={form.bathrooms} onChange={e => set('bathrooms', e.target.value)} className="input-field" min="0" /></div>
              <div><label className="label">Area (sqft)</label><input type="number" value={form.area_sqft} onChange={e => set('area_sqft', e.target.value)} className="input-field" min="0" /></div>
            </div>
          </div>
        )}

        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--charcoal)', marginBottom: 14 }}>Extras</h2>
          <div><label className="label">Amenities (comma separated)</label><input value={form.amenities} onChange={e => set('amenities', e.target.value)} className="input-field" placeholder="Parking, Garden..." /></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <input type="checkbox" id="feat" checked={form.is_featured} onChange={e => set('is_featured', e.target.checked)} style={{ width: 15, height: 15, accentColor: 'var(--gold)' }} />
            <label htmlFor="feat" style={{ fontSize: 14, color: 'var(--charcoal)', cursor: 'pointer' }}>Featured listing</label>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="btn-primary" disabled={saving} style={{ padding: '11px 24px', fontSize: 14, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <Link href={`/listings/${id}`} className="btn-ghost" style={{ padding: '11px 18px', fontSize: 14 }}>Cancel</Link>
        </div>
      </form>
    </div>
  )
}
