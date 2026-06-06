'use client'
import { Check, X, Circle } from 'lucide-react'
import type { Listing, Profile } from '@/lib/types'

interface Props {
  listing: Listing
  profile: Profile | null
}

export default function ListingProgressBar({ listing, profile }: Props) {
  const cidOk = profile?.cid_status === 'pending' || profile?.cid_status === 'verified'
  const hasImages = (listing.images?.length ?? 0) > 0
  const submitted = !['draft'].includes(listing.status)
  const isLive = ['approved', 'active', 'enquiring', 'negotiating'].includes(listing.status)
  const isRejected = listing.status === 'rejected'

  const steps = [
    { label: 'Create Listing',        done: true, failed: false },
    { label: 'Add Details & Photos',  done: !!(listing.title && listing.description && listing.price && hasImages), failed: false },
    { label: 'Verify Identity (CID)', done: cidOk, failed: false },
    { label: 'Submit for Review',     done: submitted, failed: false },
    { label: 'Admin Review',          done: isLive || isRejected, failed: isRejected },
    { label: 'Go Live',               done: isLive, failed: false },
  ]

  const activeStepIdx = steps.findIndex(s => !s.done)
  const completedCount = steps.filter(s => s.done && !s.failed).length
  const pct = Math.round((completedCount / steps.length) * 100)
  const barColor = isRejected ? '#e24b4a' : pct === 100 ? '#1D9E75' : 'var(--forest)'

  return (
    <div className="card" style={{ padding: '18px 20px', marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--charcoal)' }}>
          Listing Progress
        </h2>
        <span style={{ fontSize: 12, fontWeight: 700, color: isRejected ? '#e24b4a' : pct === 100 ? 'var(--forest)' : 'var(--muted)' }}>
          {isRejected ? 'Rejected — fix & resubmit' : `${completedCount}/${steps.length} steps`}
        </span>
      </div>

      <div style={{ height: 5, borderRadius: 3, background: 'var(--border)', marginBottom: 18, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 3, background: barColor, width: `${pct}%`, transition: 'width 0.4s ease' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {steps.map((step, i) => {
          const isActive = i === activeStepIdx && !isRejected
          return (
            <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: step.failed ? '#FCEBEB' : step.done ? 'var(--forest)' : isActive ? 'var(--cream-dark)' : 'var(--cream-dark)',
                border: step.failed ? '1.5px solid #e24b4a' : step.done ? 'none' : isActive ? '2px solid var(--forest)' : '1.5px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {step.failed
                  ? <X size={11} color="#e24b4a" strokeWidth={3} />
                  : step.done
                  ? <Check size={12} color="white" strokeWidth={3} />
                  : <span style={{ fontSize: 10, fontWeight: 700, color: isActive ? 'var(--forest)' : 'var(--muted)' }}>{i + 1}</span>}
              </div>
              <span style={{ fontSize: 13, fontWeight: step.done || isActive ? 500 : 400, color: step.failed ? '#e24b4a' : step.done ? 'var(--charcoal)' : isActive ? 'var(--forest)' : 'var(--muted)' }}>
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
