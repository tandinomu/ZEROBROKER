import {
  canTransition,
  getAvailableTransitions,
  isPublic,
  isEditable,
  TRANSITIONS,
} from '../lib/listing-lifecycle'

describe('canTransition', () => {
  it('allows seller to submit a draft for review', () => {
    expect(canTransition('draft', 'pending', 'seller')).toBe(true)
  })

  it('allows seller with both role to submit a draft', () => {
    expect(canTransition('draft', 'pending', 'both')).toBe(true)
  })

  it('prevents buyer from submitting any listing', () => {
    expect(canTransition('draft', 'pending', 'buyer')).toBe(false)
  })

  it('allows admin to approve a pending listing', () => {
    expect(canTransition('pending', 'approved', 'admin')).toBe(true)
  })

  it('prevents seller from approving their own listing', () => {
    expect(canTransition('pending', 'approved', 'seller')).toBe(false)
  })

  it('allows admin to reject a pending listing', () => {
    expect(canTransition('pending', 'rejected', 'admin')).toBe(true)
  })

  it('prevents seller from jumping draft → approved (bypassing review)', () => {
    expect(canTransition('draft', 'approved', 'seller')).toBe(false)
  })

  it('allows seller to archive a live listing', () => {
    expect(canTransition('approved', 'archived', 'seller')).toBe(true)
    expect(canTransition('enquiring', 'archived', 'seller')).toBe(true)
    expect(canTransition('negotiating', 'archived', 'seller')).toBe(true)
  })

  it('allows seller to restore an archived listing to draft', () => {
    expect(canTransition('archived', 'draft', 'seller')).toBe(true)
  })

  it('prevents invalid reverse transitions', () => {
    expect(canTransition('sold', 'pending', 'admin')).toBe(false)
    expect(canTransition('approved', 'draft', 'seller')).toBe(false)
    expect(canTransition('sold', 'approved', 'admin')).toBe(false)
  })

  it('allows seller to resubmit a rejected listing', () => {
    expect(canTransition('rejected', 'pending', 'seller')).toBe(true)
  })
})

describe('getAvailableTransitions', () => {
  it('returns submit-for-review for a seller on a draft listing', () => {
    const transitions = getAvailableTransitions('draft', 'seller')
    expect(transitions.some(t => t.to === 'pending')).toBe(true)
  })

  it('returns approve and reject for admin on a pending listing', () => {
    const transitions = getAvailableTransitions('pending', 'admin')
    const targets = transitions.map(t => t.to)
    expect(targets).toContain('approved')
    expect(targets).toContain('rejected')
  })

  it('returns no transitions for a buyer on any listing state', () => {
    const states = ['draft', 'pending', 'approved', 'rejected', 'sold'] as const
    states.forEach(s => {
      expect(getAvailableTransitions(s, 'buyer')).toHaveLength(0)
    })
  })

  it('returns transitions that reference valid TRANSITIONS entries', () => {
    const transitions = getAvailableTransitions('approved', 'seller')
    transitions.forEach(t => {
      expect(TRANSITIONS).toContain(t)
    })
  })
})

describe('isPublic', () => {
  it('treats approved and live states as public', () => {
    expect(isPublic('approved')).toBe(true)
    expect(isPublic('active')).toBe(true)
    expect(isPublic('enquiring')).toBe(true)
    expect(isPublic('negotiating')).toBe(true)
  })

  it('treats draft, pending, rejected, archived, sold as non-public', () => {
    expect(isPublic('draft')).toBe(false)
    expect(isPublic('pending')).toBe(false)
    expect(isPublic('rejected')).toBe(false)
    expect(isPublic('archived')).toBe(false)
    expect(isPublic('sold')).toBe(false)
  })
})

describe('isEditable', () => {
  it('allows editing only draft and rejected listings', () => {
    expect(isEditable('draft')).toBe(true)
    expect(isEditable('rejected')).toBe(true)
  })

  it('prevents editing of approved or live listings', () => {
    expect(isEditable('approved')).toBe(false)
    expect(isEditable('pending')).toBe(false)
    expect(isEditable('enquiring')).toBe(false)
    expect(isEditable('negotiating')).toBe(false)
    expect(isEditable('sold')).toBe(false)
    expect(isEditable('archived')).toBe(false)
  })
})
