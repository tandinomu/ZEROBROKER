import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { canTransition } from '@/lib/listing-lifecycle'
import type { ListingStatus, UserRole } from '@/lib/types'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { status: newStatus, rejection_reason } = body
  if (!newStatus) return NextResponse.json({ error: 'status is required' }, { status: 400 })

  const { data: listing, error: fetchErr } = await supabase
    .from('listings').select('id, status, owner_id, title').eq('id', id).single()
  if (fetchErr || !listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role as UserRole
  const isOwner = listing.owner_id === user.id
  const isAdmin = role === 'admin'

  if (!isAdmin && !isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!canTransition(listing.status as ListingStatus, newStatus as ListingStatus, role)) {
    return NextResponse.json({
      error: `Transition from '${listing.status}' to '${newStatus}' is not allowed for role '${role}'`,
    }, { status: 422 })
  }

  const update: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  }

  if (newStatus === 'approved') {
    update.approved_at = new Date().toISOString()
    update.approved_by = user.id
    update.rejection_reason = null
    update.rejected_by = null
    update.rejected_at = null
  }

  if (newStatus === 'rejected') {
    if (!rejection_reason?.trim()) {
      return NextResponse.json({ error: 'rejection_reason is required when rejecting' }, { status: 400 })
    }
    update.rejection_reason = rejection_reason.trim()
    update.rejected_by = user.id
    update.rejected_at = new Date().toISOString()
  }

  if (newStatus === 'pending') {
    // Clear rejection data when resubmitting
    update.rejection_reason = null
    update.rejected_by = null
    update.rejected_at = null
  }

  const { data, error } = await supabase
    .from('listings').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Fire notification to listing owner (skip if actor IS the owner, e.g. admin transitions their own)
  const notifTargetId = newStatus === 'pending' ? null : listing.owner_id
  if (notifTargetId && notifTargetId !== user.id) {
    const link = `/listings/${id}`
    let notif: Record<string, unknown> | null = null
    if (newStatus === 'approved') {
      notif = { user_id: notifTargetId, title: 'Listing Approved!', message: `"${listing.title}" is now live on the marketplace.`, type: 'status_change', link }
    } else if (newStatus === 'rejected') {
      notif = { user_id: notifTargetId, title: 'Listing Rejected', message: `"${listing.title}" was rejected: ${rejection_reason}`, type: 'status_change', link }
    } else if (newStatus === 'archived') {
      notif = { user_id: notifTargetId, title: 'Listing Archived', message: `"${listing.title}" has been archived.`, type: 'status_change', link }
    }
    if (notif) await supabase.from('notifications').insert(notif)
  }

  return NextResponse.json({ data })
}
