export type UserRole = 'buyer' | 'seller' | 'broker' | 'admin'
export type ListingStatus = 'pending' | 'active' | 'enquiring' | 'negotiating' | 'sold' | 'paused'
export type PropertyType = 'land' | 'house' | 'apartment' | 'commercial' | 'vehicle'
export type EnquiryStatus = 'pending' | 'accepted' | 'declined' | 'negotiating' | 'completed'

export interface Profile {
  id: string
  full_name: string
  phone?: string
  avatar_url?: string
  role: UserRole
  is_verified: boolean
  created_at: string
  updated_at: string
}

export interface BrokerProfile {
  id: string
  user_id: string
  license_number?: string
  bio?: string
  years_experience: number
  specialization?: string
  is_verified: boolean
  avg_rating: number
  total_reviews: number
  total_deals: number
  subscription_tier: 'free' | 'basic' | 'premium'
  created_at: string
  profiles?: Profile
}

export interface Listing {
  id: string
  owner_id: string
  broker_id?: string
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

export interface Review {
  id: string
  broker_id: string
  reviewer_id: string
  listing_id?: string
  rating: number
  comment?: string
  created_at: string
  reviewer?: Profile
}

export const DZONGKHAGS = [
  'Bumthang', 'Chhukha', 'Dagana', 'Gasa', 'Haa',
  'Lhuentse', 'Mongar', 'Paro', 'Pemagatshel', 'Punakha',
  'Samdrup Jongkhar', 'Samtse', 'Sarpang', 'Thimphu',
  'Trashigang', 'Trashiyangtse', 'Trongsa', 'Tsirang',
  'Wangdue Phodrang', 'Zhemgang'
]

export const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: 'land', label: 'Land / Plot' },
  { value: 'house', label: 'House' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'vehicle', label: 'Vehicle' },
]

export const STATUS_CONFIG: Record<ListingStatus, { label: string; color: string; bg: string }> = {
  pending:     { label: 'Pending Review', color: '#633806', bg: '#FAC775' },
  active:      { label: 'Active',         color: '#27500A', bg: '#C0DD97' },
  enquiring:   { label: 'Enquiring',      color: '#0C447C', bg: '#B5D4F4' },
  negotiating: { label: 'Negotiating',    color: '#633806', bg: '#FAC775' },
  sold:        { label: 'Sold',           color: '#3d3d3a', bg: '#D3D1C7' },
  paused:      { label: 'Paused',         color: '#444441', bg: '#F1EFE8' },
}

export function formatPrice(price: number): string {
  if (price >= 10000000) return `Nu. ${(price / 10000000).toFixed(2)} Cr`
  if (price >= 100000) return `Nu. ${(price / 100000).toFixed(2)} L`
  return `Nu. ${price.toLocaleString()}`
}
