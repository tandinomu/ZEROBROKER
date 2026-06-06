import { ShieldCheck, ShieldAlert, Clock } from 'lucide-react'

type BadgeVariant = 'verified' | 'pending' | 'unverified'

interface Props {
  variant: BadgeVariant
  size?: 'sm' | 'md'
  label?: string
}

const CONFIG = {
  verified:   { icon: ShieldCheck, color: '#27500A', bg: '#C0DD97', defaultLabel: 'Verified Listing' },
  pending:    { icon: Clock,        color: '#633806', bg: '#FAC775', defaultLabel: 'Pending Verification' },
  unverified: { icon: ShieldAlert,  color: '#6b6b67', bg: '#f0ece0', defaultLabel: 'Unverified' },
}

export default function VerificationBadge({ variant, size = 'sm', label }: Props) {
  const cfg = CONFIG[variant]
  const Icon = cfg.icon
  const pad = size === 'md' ? '5px 12px' : '3px 9px'
  const fontSize = size === 'md' ? 12 : 10
  const iconSize = size === 'md' ? 13 : 11

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: pad, borderRadius: 20, fontSize, fontWeight: 700,
      color: cfg.color, background: cfg.bg,
    }}>
      <Icon size={iconSize} />
      {label ?? cfg.defaultLabel}
    </span>
  )
}
