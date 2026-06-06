'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Home, ShoppingBag, Building2, Layers } from 'lucide-react'

const ROLES = [
  { value: 'buyer',  label: 'Buyer',          desc: 'I want to find and buy property',   icon: <ShoppingBag size={18} /> },
  { value: 'seller', label: 'Seller',         desc: 'I want to list and sell property',   icon: <Building2 size={18} /> },
  { value: 'both',   label: 'Buyer + Seller', desc: 'I want to buy and sell property',    icon: <Layers size={18} /> },
]

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('buyer')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName, role } }
    })
    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: fullName,
        phone: phone || null,
        role,
      })
    }
    toast.success('Account created! Welcome to Zero Broker.')
    router.push('/dashboard')
    router.refresh()
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <div style={{ width: 40, height: 40, background: 'var(--forest)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Home size={20} color="white" />
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--forest)' }}>Zero Broker</span>
          </Link>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--charcoal)', marginTop: 18, marginBottom: 6 }}>Create your account</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>Join Bhutan's real estate platform</p>
        </div>
        <div className="card" style={{ padding: 28 }}>
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="label">I am a...</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {ROLES.map(r => (
                  <button key={r.value} type="button" onClick={() => setRole(r.value)}
                    style={{ padding: '10px 6px', borderRadius: 10, border: role === r.value ? '2px solid var(--forest)' : '1.5px solid var(--border)', background: role === r.value ? 'rgba(26,58,42,0.06)' : 'var(--white)', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' }}>
                    <div style={{ color: role === r.value ? 'var(--forest)' : 'var(--muted)', display: 'flex', justifyContent: 'center', marginBottom: 4 }}>{r.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: role === r.value ? 'var(--forest)' : 'var(--charcoal)' }}>{r.label}</div>
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>{ROLES.find(r => r.value === role)?.desc}</p>
            </div>
            <div>
              <label className="label">Full name</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)} required
                className="input-field" placeholder="Tenzin Wangchuk" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <div>
                <label className="label">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="input-field" placeholder="you@email.com" />
              </div>
              <div>
                <label className="label">Phone</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  className="input-field" placeholder="+975 17xxxxxx" />
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                  className="input-field" placeholder="Min. 6 characters" style={{ paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 15, marginTop: 4, opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--muted)' }}>
            Already have an account?{' '}
            <Link href="/auth/login" style={{ color: 'var(--forest)', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
