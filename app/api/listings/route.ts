import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Allow debug insertion when header matches DEBUG_API_KEY (for local testing)
  const debugKey = req.headers.get('x-debug-key')
  const allowedDebug = process.env.DEBUG_API_KEY && debugKey === process.env.DEBUG_API_KEY

  const body = await req.json().catch(() => ({}))

  if (!user && !allowedDebug) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const ownerId = user?.id || body.owner_id || null
  if (!ownerId) return NextResponse.json({ error: 'owner_id required' }, { status: 400 })

  const payload = {
    owner_id: ownerId,
    title: body.title || 'Test listing (server)',
    description: body.description || 'Server-side test insert',
    price: body.price ? parseFloat(body.price) : 0,
    property_type: body.property_type || 'house',
    dzongkhag: body.dzongkhag || 'Thimphu',
    gewog: body.gewog || null,
    location_name: body.location_name || 'Test Location',
    latitude: body.latitude ? parseFloat(body.latitude) : null,
    longitude: body.longitude ? parseFloat(body.longitude) : null,
    bedrooms: body.bedrooms ? parseInt(body.bedrooms) : null,
    bathrooms: body.bathrooms ? parseInt(body.bathrooms) : null,
    area_sqft: body.area_sqft ? parseFloat(body.area_sqft) : null,
    is_featured: !!body.is_featured,
    images: body.images || [],
    amenities: body.amenities || [],
    status: body.status || 'draft',
  }

  const { data, error } = await supabase.from('listings').insert(payload).select().single()
  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }
  return NextResponse.json({ data }, { status: 201 })
}

export async function GET() {
  return NextResponse.json({ ok: true, message: 'Listings test endpoint (POST to create)' })
}
