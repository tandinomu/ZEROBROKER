export type UserRole = 'buyer' | 'seller' | 'both' | 'admin'
export type ListingStatus = 'draft' | 'pending' | 'approved' | 'active' | 'rejected' | 'archived' | 'enquiring' | 'negotiating' | 'sold' | 'paused'
export type PropertyType = 'land' | 'house' | 'apartment' | 'commercial' | 'vehicle'
export type EnquiryStatus = 'pending' | 'accepted' | 'declined' | 'negotiating' | 'completed'
export type DocType = 'ownership_certificate' | 'tax_clearance' | 'cid' | 'land_certificate' | 'vehicle_registration' | 'other'
export type DocStatus = 'pending' | 'verified' | 'rejected'
export type ReportReason = 'fraud' | 'duplicate' | 'misleading' | 'wrong_price' | 'spam' | 'other'
export type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed'

export interface Profile {
  id: string
  full_name: string
  phone?: string
  avatar_url?: string
  role: UserRole
  is_verified: boolean
  cid_url?: string
  cid_back_url?: string
  cid_status?: 'unverified' | 'pending' | 'verified' | 'rejected'
  created_at: string
  updated_at: string
}

export interface ListingDocument {
  id: string
  listing_id: string
  owner_id: string
  doc_type: DocType
  doc_url: string
  file_name?: string
  status: DocStatus
  rejection_reason?: string
  verified_by?: string
  verified_at?: string
  created_at: string
}

export interface ListingReport {
  id: string
  listing_id: string
  reporter_id: string
  reason: ReportReason
  description?: string
  status: ReportStatus
  reviewed_by?: string
  created_at: string
  listings?: Listing
  reporter?: Profile
}

export interface Message {
  id: string
  enquiry_id: string
  sender_id: string
  content: string
  is_read: boolean
  created_at: string
  sender?: Profile
}

export interface Listing {
  id: string
  owner_id: string
  is_verified?: boolean
  verification_status?: 'unverified' | 'docs_submitted' | 'verified'
  title: string
  description: string
  price: number
  property_type: PropertyType
  status: ListingStatus
  dzongkhag: string
  gewog?: string
  location_name: string
  latitude?: number
  longitude?: number
  bedrooms?: number
  bathrooms?: number
  area_sqft?: number
  is_featured: boolean
  images: string[]
  amenities: string[]
  approved_at?: string
  approved_by?: string
  rejection_reason?: string
  rejected_by?: string
  rejected_at?: string
  created_at: string
  updated_at: string
  profiles?: Profile
}

export interface Enquiry {
  id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  message: string
  status: EnquiryStatus
  buyer_confirmed_deal: boolean
  seller_confirmed_deal: boolean
  created_at: string
  updated_at: string
  listings?: Listing
  buyer?: Profile
  seller?: Profile
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: string
  is_read: boolean
  link?: string
  created_at: string
}

export const DZONGKHAGS = [
  'Bumthang', 'Chhukha', 'Dagana', 'Gasa', 'Haa',
  'Lhuentse', 'Mongar', 'Paro', 'Pemagatshel', 'Punakha',
  'Samdrup Jongkhar', 'Samtse', 'Sarpang', 'Thimphu',
  'Trashigang', 'Trashiyangtse', 'Trongsa', 'Tsirang',
  'Wangdue Phodrang', 'Zhemgang'
]

export const DOC_TYPES: { value: DocType; label: string; desc: string }[] = [
  { value: 'ownership_certificate', label: 'Ownership Certificate', desc: 'Official document proving ownership' },
  { value: 'tax_clearance', label: 'Tax Clearance', desc: 'Tax clearance certificate' },
  { value: 'cid', label: 'CID / Identity', desc: 'Citizen Identity Document' },
  { value: 'land_certificate', label: 'Land Certificate', desc: 'Land registration (Thram)' },
  { value: 'vehicle_registration', label: 'Vehicle Registration', desc: 'Vehicle registration document' },
  { value: 'other', label: 'Other Document', desc: 'Any supporting document' },
]

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'fraud', label: 'Fraudulent listing' },
  { value: 'duplicate', label: 'Duplicate listing' },
  { value: 'misleading', label: 'Misleading information' },
  { value: 'wrong_price', label: 'Incorrect/unrealistic price' },
  { value: 'spam', label: 'Spam or irrelevant' },
  { value: 'other', label: 'Other reason' },
]

export const DOC_STATUS_CONFIG: Record<DocStatus, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Under Review', color: '#633806', bg: '#FAC775' },
  verified: { label: 'Verified',     color: '#27500A', bg: '#C0DD97' },
  rejected: { label: 'Rejected',     color: '#7c1e1e', bg: '#FCEBEB' },
}

export const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: 'land', label: 'Land / Plot' },
  { value: 'house', label: 'House' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'vehicle', label: 'Vehicle' },
]

export const STATUS_CONFIG: Record<ListingStatus, { label: string; color: string; bg: string }> = {
  draft:       { label: 'Draft',            color: '#444441', bg: '#F1EFE8' },
  pending:     { label: 'Pending Review',   color: '#633806', bg: '#FAC775' },
  approved:    { label: 'Published',        color: '#27500A', bg: '#C0DD97' },
  active:      { label: 'Published',        color: '#27500A', bg: '#C0DD97' }, // backward compat alias
  rejected:    { label: 'Rejected',         color: '#7c1e1e', bg: '#FCEBEB' },
  archived:    { label: 'Archived',         color: '#444441', bg: '#E8E6E0' },
  enquiring:   { label: 'Live — Enquiring', color: '#0C447C', bg: '#B5D4F4' },
  negotiating: { label: 'Live — Negotiating', color: '#633806', bg: '#FAC775' },
  sold:        { label: 'Sold',             color: '#3d3d3a', bg: '#D3D1C7' },
  paused:      { label: 'Paused',           color: '#444441', bg: '#F1EFE8' },
}

export function formatPrice(price: number): string {
  if (price >= 10000000) return `Nu. ${(price / 10000000).toFixed(2)} Cr`
  if (price >= 100000) return `Nu. ${(price / 100000).toFixed(2)} L`
  return `Nu. ${price.toLocaleString()}`
}
