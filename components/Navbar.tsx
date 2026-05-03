'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'
import { Bell, Menu, X, ChevronDown, Home, Search, Users, Map, Plus, Shield } from 'lucide-react'

export default function Navbar() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) {
        supabase.from('profiles').select('*').eq('id', user.id).single()
          .then(({ data }) => setProfile(data))
        supabase.from('notifications').select('id', { count: 'exact', head: true })
          .eq('user_id', user.id).eq('is_read', false)
          .then(({ count }) => setUnreadCount(count || 0))
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) { setProfile(null); setUnreadCount(0) }
      else {
        supabase.from('profiles').select('*').eq('id', session.user.id).single()
          .then(({ data }) => setProfile(data))
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null); setProfile(null)
    router.push('/')
  }

  const navLinks = [
    { href: '/listings', label: 'Properties', icon: <Search size={14} /> },
    { href: '/map', label: 'Map', icon: <Map size={14} /> },
    { href: '/brokers', label: 'Brokers', icon: <Users size={14} /> },
  ]

  const canList = profile?.role === 'seller' || profile?.role === 'broker' || profile?.role === 'admin'
  const isAdmin = profile?.role === 'admin'

  return (
    <nav style={{ background: 'var(--white)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 50 }}>
      <div className="container-main">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>

          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <div style={{ width: 36, height: 36, background: 'var(--forest)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Home size={18} color="white" />
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--forest)' }}>Zero Broker</span>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }} className="hidden md:flex">
            {navLinks.map(link => (
              <Link key={link.href} href={link.href}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 500, color: pathname.startsWith(link.href) ? 'var(--forest)' : 'var(--muted)', background: pathname.startsWith(link.href) ? 'var(--cream-dark)' : 'transparent', transition: 'all 0.2s' }}>
                {link.icon}{link.label}
              </Link>
            ))}
            {isAdmin && (
              <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 500, color: pathname.startsWith('/admin') ? 'var(--forest)' : 'var(--muted)', background: pathname.startsWith('/admin') ? 'var(--cream-dark)' : 'transparent' }}>
                <Shield size={14} />Admin
              </Link>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {user ? (
              <>
                <Link href="/dashboard?tab=notifications" style={{ position: 'relative', padding: 8, borderRadius: 8, color: 'var(--muted)', textDecoration: 'none', display: 'flex' }}>
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span style={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, background: '#e24b4a', borderRadius: '50%', fontSize: 9, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>
                {canList && (
                  <Link href="/listings/new" className="btn-primary hidden md:inline-flex" style={{ padding: '8px 14px', fontSize: 13 }}>
                    <Plus size={14} />List Property
                  </Link>
                )}
                <div ref={dropRef} style={{ position: 'relative' }}>
                  <button onClick={() => setDropdownOpen(!dropdownOpen)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--white)', cursor: 'pointer' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 600 }}>
                      {profile?.full_name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--charcoal)', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {profile?.full_name?.split(' ')[0] || 'User'}
                    </span>
                    <ChevronDown size={13} color="var(--muted)" />
                  </button>
                  {dropdownOpen && (
                    <div style={{ position: 'absolute', right: 0, top: '110%', width: 200, background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-lg)', overflow: 'hidden', zIndex: 100 }}>
                      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)' }}>{profile?.full_name || 'User'}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'capitalize', marginTop: 2 }}>{profile?.role}</div>
                      </div>
                      {[
                        { href: '/dashboard', label: 'Dashboard' },
                        { href: '/dashboard?tab=profile', label: 'My Profile' },
                        { href: '/dashboard?tab=saved', label: 'Saved Properties' },
                      ].map(item => (
                        <Link key={item.href} href={item.href} onClick={() => setDropdownOpen(false)}
                          style={{ display: 'block', padding: '10px 16px', fontSize: 13, color: 'var(--charcoal-mid)', textDecoration: 'none', transition: 'background 0.15s' }}
                          onMouseOver={e => (e.currentTarget.style.background = 'var(--cream-dark)')}
                          onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
                          {item.label}
                        </Link>
                      ))}
                      {isAdmin && (
                        <Link href="/admin" onClick={() => setDropdownOpen(false)}
                          style={{ display: 'block', padding: '10px 16px', fontSize: 13, color: 'var(--forest)', fontWeight: 600, textDecoration: 'none', borderTop: '1px solid var(--border)' }}
                          onMouseOver={e => (e.currentTarget.style.background = 'var(--cream-dark)')}
                          onMouseOut={e => (e.currentTarget.style.background = 'transparent')}>
                          Admin Panel
                        </Link>
                      )}
                      <div style={{ borderTop: '1px solid var(--border)', padding: 8 }}>
                        <button onClick={handleLogout} style={{ width: '100%', padding: '8px', borderRadius: 8, border: 'none', background: 'transparent', fontSize: 13, color: '#e24b4a', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)' }}>
                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <Link href="/auth/login" className="btn-ghost">Login</Link>
                <Link href="/auth/register" className="btn-primary">Register</Link>
              </div>
            )}
            <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)}
              style={{ padding: 8, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--charcoal)' }}>
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div style={{ borderTop: '1px solid var(--border)', paddingBottom: 12 }} className="md:hidden">
            {navLinks.map(link => (
              <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', textDecoration: 'none', fontSize: 15, color: 'var(--charcoal)' }}>
                {link.icon}{link.label}
              </Link>
            ))}
            {canList && (
              <Link href="/listings/new" onClick={() => setMenuOpen(false)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', textDecoration: 'none', fontSize: 15, color: 'var(--forest)', fontWeight: 600 }}>
                <Plus size={15} />List Property
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
