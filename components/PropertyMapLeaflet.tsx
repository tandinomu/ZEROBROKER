'use client'
import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import Link from 'next/link'
import { formatPrice } from '@/lib/types'

// Fix default icon paths broken by webpack
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function selectedIcon(selected: boolean) {
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${selected ? '#1a3a2a' : '#2d6a4f'};
      color:white;
      border:2.5px solid ${selected ? '#c8a84b' : 'white'};
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      width:28px;height:28px;
      box-shadow:0 2px 6px rgba(0,0,0,0.35);
      transition:all 0.2s;
    "></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -30],
  })
}

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => { map.flyTo([lat, lng], 15, { duration: 1.2 }) }, [lat, lng])
  return null
}

interface Listing {
  id: string
  title: string
  price: number
  latitude: number
  longitude: number
  dzongkhag: string
  location_name: string
  property_type: string
  bedrooms?: number
}

interface Props {
  listings: Listing[]
  selected: Listing | null
  onSelect: (l: Listing | null) => void
}

export default function PropertyMapLeaflet({ listings, selected, onSelect }: Props) {
  const center: [number, number] =
    listings.length > 0
      ? [listings[0].latitude, listings[0].longitude]
      : [27.4728, 89.639]

  return (
    <MapContainer
      center={center}
      zoom={9}
      style={{ width: '100%', height: '100%' }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {listings.map(l => (
        <Marker
          key={l.id}
          position={[l.latitude, l.longitude]}
          icon={selectedIcon(selected?.id === l.id)}
          eventHandlers={{ click: () => onSelect(selected?.id === l.id ? null : l) }}
        >
          <Popup>
            <div style={{ minWidth: 180 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{l.title}</div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
                {l.location_name}, {l.dzongkhag}
              </div>
              <div style={{ fontWeight: 700, color: '#2d6a4f', marginBottom: 8 }}>
                {formatPrice(l.price)}
              </div>
              <Link
                href={`/listings/${l.id}`}
                style={{ fontSize: 12, color: 'white', background: '#2d6a4f', borderRadius: 6, padding: '4px 10px', textDecoration: 'none', display: 'inline-block' }}
              >
                View listing →
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
      {selected && <FlyTo lat={selected.latitude} lng={selected.longitude} />}
    </MapContainer>
  )
}
