import type { ListingStatus, UserRole } from './types'

export interface Transition {
  from: ListingStatus
  to: ListingStatus
  allowedRoles: UserRole[]
  label: string
  requiresReason?: boolean
}

export const TRANSITIONS: Transition[] = [
  // Seller submits draft for first review
  { from: 'draft',       to: 'pending',   allowedRoles: ['seller', 'both', 'admin'], label: 'Submit for Review' },
  // Seller resubmits after rejection
  { from: 'rejected',    to: 'pending',   allowedRoles: ['seller', 'both', 'admin'], label: 'Resubmit for Review' },
  // Admin approves → PUBLISHED
  { from: 'pending',     to: 'approved',  allowedRoles: ['admin'], label: 'Approve & Publish' },
  // Admin rejects → REJECTED
  { from: 'pending',     to: 'rejected',  allowedRoles: ['admin'], label: 'Reject', requiresReason: true },
  // Seller marks sold (from any live state)
  { from: 'approved',    to: 'sold',      allowedRoles: ['seller', 'both', 'admin'], label: 'Mark as Sold' },
  { from: 'enquiring',   to: 'sold',      allowedRoles: ['seller', 'both', 'admin'], label: 'Mark as Sold' },
  { from: 'negotiating', to: 'sold',      allowedRoles: ['seller', 'both', 'admin'], label: 'Mark as Sold' },
  { from: 'active',      to: 'sold',      allowedRoles: ['seller', 'both', 'admin'], label: 'Mark as Sold' },
  // Seller archives (removes from marketplace without selling)
  { from: 'approved',    to: 'archived',  allowedRoles: ['seller', 'both', 'admin'], label: 'Archive Listing' },
  { from: 'enquiring',   to: 'archived',  allowedRoles: ['seller', 'both', 'admin'], label: 'Archive Listing' },
  { from: 'negotiating', to: 'archived',  allowedRoles: ['seller', 'both', 'admin'], label: 'Archive Listing' },
  { from: 'active',      to: 'archived',  allowedRoles: ['seller', 'both', 'admin'], label: 'Archive Listing' },
  { from: 'rejected',    to: 'archived',  allowedRoles: ['seller', 'both', 'admin'], label: 'Archive Listing' },
  { from: 'draft',       to: 'archived',  allowedRoles: ['seller', 'both', 'admin'], label: 'Archive Listing' },
  { from: 'sold',        to: 'archived',  allowedRoles: ['admin'], label: 'Archive' },
  // Restore archived listing to draft so seller can edit and resubmit
  { from: 'archived',    to: 'draft',     allowedRoles: ['seller', 'both', 'admin'], label: 'Restore to Draft' },
]

export function getAvailableTransitions(from: ListingStatus, role: UserRole): Transition[] {
  return TRANSITIONS.filter(t => t.from === from && t.allowedRoles.includes(role))
}

export function canTransition(from: ListingStatus, to: ListingStatus, role: UserRole): boolean {
  return TRANSITIONS.some(t => t.from === from && t.to === to && t.allowedRoles.includes(role))
}

// Listings visible on the public marketplace
export const PUBLIC_STATUSES: ListingStatus[] = ['approved', 'active', 'enquiring', 'negotiating']

// Statuses where the seller can edit listing content
export const EDITABLE_STATUSES: ListingStatus[] = ['draft', 'rejected']

// Statuses that are end-states (hidden from marketplace)
export const TERMINAL_STATUSES: ListingStatus[] = ['sold', 'archived']

export function isPublic(status: ListingStatus): boolean {
  return PUBLIC_STATUSES.includes(status)
}

export function isEditable(status: ListingStatus): boolean {
  return EDITABLE_STATUSES.includes(status)
}
