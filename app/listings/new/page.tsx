'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import { DZONGKHAGS, PROPERTY_TYPES } from '@/lib/types'
import toast from 'react-hot-toast'
import { Upload, X, MapPin } from 'lucide-react'

export default function NewListingPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [images, setImages] = useState<string[]>([])
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({
    title: '', description: '', price: '', property_type: 'house',
    dzongkhag: 'Thimphu', gewog: '', location_name: '',
    latitude: '', longitude: '', bedrooms: '', bathrooms: '', area_sqft: '',
    is_featured: false, amenities: '',
  })

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/auth/login'); return }
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => {
          setProfile(data)
          if (data && !['seller','both','admin'].includes(data.role)) {
            toast.error('Only sellers can create listings')
            router.push('/dashboard')
          }
        })
    })
  }, [])

  function set(key: string, val: any) { setForm(f => ({ ...f, [key]: val })) }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    for (const file of files) {
      const ext = file.name.split('.').pop()
      const path = `${user?.id}/${Date.now()}.${ext}`
      const { data, error } = await supabase.storage.from('listing-images').upload(path, file)
      if (!error && data) {
        const { data: { publicUrl } } = supabase.storage.from('listing-images').getPublicUrl(data.path)
        setImages(prev => [...prev, publicUrl])
      }
    }
    setUploading(false)
    toast.success('Images uploaded!')
  }

  async function useCurrentLocation() {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return }
    navigator.geolocation.getCurrentPosition(
      pos => { set('latitude', pos.coords.latitude.toString()); set('longitude', pos.coords.longitude.toString()); toast.success('Location set!') },
      () => toast.error('Could not get location')
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    e.preventDefault()
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Not authenticated — please login and try again')
        router.push('/auth/login')
        setLoading(false)
        return
      }

      const amenitiesArr = form.amenities ? form.amenities.split(',').map(s => s.trim()).filter(Boolean) : []
      const payload = {
        owner_id: user.id,
        title: form.title,
        description: form.description,
        price: parseFloat(form.price),
        property_type: form.property_type,
        dzongkhag: form.dzongkhag,
        gewog: form.gewog || null,
        location_name: form.location_name,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        bedrooms: form.bedrooms ? parseInt(form.bedrooms) : null,
        bathrooms: form.bathrooms ? parseInt(form.bathrooms) : null,
        area_sqft: form.area_sqft ? parseFloat(form.area_sqft) : null,
        is_featured: form.is_featured,
        images,
        amenities: amenitiesArr,
        status: 'draft',
      }

      const { data, error } = await supabase.from('listings').insert(payload).select().single()
      if (error) {
        console.error('Listing insert error:', error)
        toast.error('Failed to create listing: ' + (error.message || JSON.stringify(error)))
      } else {
        toast.success('Listing saved as draft! Verify your identity then submit for review.')
        router.push(`/listings/${data.id}`)
      }
    } catch (err) {
      console.error('Unexpected error creating listing:', err)
      toast.error('Unexpected error creating listing')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container-main page-pad" style={{ maxWidth: 680 }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--forest)', marginBottom: 6 }}>List a Property</h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>Your listing will be saved as a draft. Upload documents and verify your CID before submitting for review.</p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="card" style={{ padding: 22 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--charcoal)', marginBottom: 16 }}>Basic Information</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="label">Title *</label>
              <input value={form.title} onChange={e => set('title', e.target.value)} required className="input-field" placeholder="e.g. 3BHK House in Thimphu City" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              <div>
                <label className="label">Property Type *</label>
                <select value={form.property_type} onChange={e => set('property_type', e.target.value)} className="input-field">
                  {PROPERTY_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Price (Nu.) *</label>
                <input type="number" value={form.price} onChange={e => set('price', e.target.value)} required className="input-field" placeholder="5000000" min="0" />
              </div>
            </div>
            <div>
              <label className="label">Description *</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} required rows={5}
                className="input-field" placeholder="Describe the property..." style={{ resize: 'vertical' }} />
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 22 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--charcoal)', marginBottom: 16 }}>Location</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              <div>
                <label className="label">Dzongkhag *</label>
                <select value={form.dzongkhag} onChange={e => set('dzongkhag', e.target.value)} className="input-field">
                  {DZONGKHAGS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Gewog (Sub-district)</label>
                <input value={form.gewog} onChange={e => set('gewog', e.target.value)} className="input-field" placeholder="e.g. Motithang" />
              </div>
            </div>
            <div>
              <label className="label">Location Name *</label>
              <input value={form.location_name} onChange={e => set('location_name', e.target.value)} required className="input-field" placeholder="e.g. Chubachu" />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="label" style={{ marginBottom: 0 }}>GPS Coordinates (optional)</label>
                <button type="button" onClick={useCurrentLocation} className="btn-ghost"
                  style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}>
                  <MapPin size={12} />Use my location
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                <input type="number" value={form.latitude} onChange={e => set('latitude', e.target.value)} className="input-field" placeholder="Latitude (27.4728)" step="any" />
                <input type="number" value={form.longitude} onChange={e => set('longitude', e.target.value)} className="input-field" placeholder="Longitude (89.6390)" step="any" />
              </div>
            </div>
          </div>
        </div>

        {!['land','vehicle'].includes(form.property_type) && (
          <div className="card" style={{ padding: 22 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--charcoal)', marginBottom: 16 }}>Property Details</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              <div><label className="label">Bedrooms</label><input type="number" value={form.bedrooms} onChange={e => set('bedrooms', e.target.value)} className="input-field" placeholder="3" min="0" /></div>
              <div><label className="label">Bathrooms</label><input type="number" value={form.bathrooms} onChange={e => set('bathrooms', e.target.value)} className="input-field" placeholder="2" min="0" /></div>
              <div><label className="label">Area (sqft)</label><input type="number" value={form.area_sqft} onChange={e => set('area_sqft', e.target.value)} className="input-field" placeholder="1500" min="0" /></div>
            </div>
          </div>
        )}
        {['land'].includes(form.property_type) && (
          <div className="card" style={{ padding: 22 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--charcoal)', marginBottom: 16 }}>Land Details</h2>
            <div><label className="label">Area (sqft)</label><input type="number" value={form.area_sqft} onChange={e => set('area_sqft', e.target.value)} className="input-field" placeholder="10000" min="0" /></div>
          </div>
        )}

        <div className="card" style={{ padding: 22 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--charcoal)', marginBottom: 16 }}>Photos</h2>
          <label style={{ display: 'block', border: '2px dashed var(--border)', borderRadius: 10, padding: 24, textAlign: 'center', cursor: 'pointer', background: 'var(--cream)' }}>
            <input type="file" multiple accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
            <Upload size={22} style={{ color: 'var(--muted)', margin: '0 auto 8px', display: 'block' }} />
            <div style={{ fontSize: 14, color: 'var(--charcoal-mid)', fontWeight: 500 }}>{uploading ? 'Uploading...' : 'Click to upload photos'}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>JPG, PNG up to 10MB each (max 20)</div>
          </label>
          {images.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {images.map((img, i) => (
                <div key={i} style={{ position: 'relative', width: 80, height: 60 }}>
                  <img src={img} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
                  <button type="button" onClick={() => setImages(imgs => imgs.filter((_, j) => j !== i))}
                    style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#e24b4a', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 22 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--charcoal)', marginBottom: 16 }}>Extras</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="label">Amenities (comma separated)</label>
              <input value={form.amenities} onChange={e => set('amenities', e.target.value)} className="input-field" placeholder="Parking, Garden, Water, Solar, Security" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="featured" checked={form.is_featured} onChange={e => set('is_featured', e.target.checked)} style={{ width: 15, height: 15, accentColor: 'var(--gold)' }} />
              <label htmlFor="featured" style={{ fontSize: 14, color: 'var(--charcoal)', cursor: 'pointer' }}>Mark as featured listing</label>
            </div>
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={loading}
          style={{ padding: '13px 28px', fontSize: 15, justifyContent: 'center', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Saving...' : 'Save as Draft'}
        </button>
      </form>
    </div>
  )
}
