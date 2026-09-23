'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { BRANDING } from '@/lib/branding'
import {
  LayoutDashboard,
  Loader2,
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Columns3,
  Ticket,
  CalendarDays,
} from 'lucide-react'

const heroStats = [
  { label: 'Board view', value: 'Kanban', icon: Columns3 },
  { label: 'Full lifecycle', value: 'Tickets', icon: Ticket },
  { label: 'Team cadence', value: 'Mon–Fri', icon: CalendarDays },
]

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    try {
      const formData = new FormData(e.currentTarget)
      const email = formData.get('email') as string
      const password = formData.get('password') as string

      const result = await signIn('credentials', { email, password, redirect: false })
      if (result?.error) {
        toast.error('Invalid email or password')
      } else if (result?.ok) {
        toast.success('Signed in successfully!')
        window.location.href = '/dashboard' // Force a hard navigation to ensure session is loaded
      }
    } catch (err) {
      toast.error('A network error occurred. Please check your connection or server configuration.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    try {
      const formData = new FormData(e.currentTarget)
      const name = formData.get('name') as string
      const email = formData.get('email') as string
      const password = formData.get('password') as string

      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })

      const data = await res.json()
      if (res.ok) {
        toast.success('Account created! Signing you in...')
        const result = await signIn('credentials', { email, password, redirect: false })
        if (!result?.ok) {
          toast.error('Account created but auto-login failed. Please sign in manually.')
          setMode('login')
        } else {
          window.location.href = '/dashboard' // Force a hard navigation to ensure session is loaded
        }
      } else {
        toast.error(data.error || 'Registration failed')
      }
    } catch (err) {
      toast.error('A network error occurred. Please check your connection or server configuration.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen lg:flex bg-brand-panel">
      {/* Brand panel */}
      <div
        className="relative hidden lg:flex lg:w-1/2 flex-col justify-between overflow-hidden px-14 py-12"
        style={{
          background: 'linear-gradient(155deg, var(--brand-ink) 0%, var(--brand-ink-2) 65%, #223257 100%)',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0">
            <Image src="/logo.png" alt="Logo" width={40} height={40} className="rounded-xl object-contain" />
          </div>
          <div>
            <p className="text-white font-semibold leading-tight">{BRANDING.companyName}</p>
            <p className="text-[11px] tracking-wide text-[#8CC63F]">{BRANDING.portalLabel.toUpperCase()}</p>
          </div>
        </div>

        <div className="max-w-md">
          <p className="flex items-center gap-2 text-xs tracking-wide text-brand-accent mb-4">
            <span className="h-px w-5 bg-brand-accent inline-block" />
            PROJECT MANAGEMENT
          </p>
          <h1 className="text-4xl md:text-[2.75rem] font-bold leading-[1.1] tracking-tight text-white text-balance">
            Every ticket, every project, one clear board.
          </h1>
          <p className="mt-5 text-sm leading-relaxed text-brand-muted">
            Plan projects, move tickets across the board, and see exactly
            where your team&apos;s time is going — all from one workspace.
          </p>
        </div>

        <div className="flex items-center gap-8">
          {heroStats.map((stat) => (
            <div key={stat.label} className="flex items-start gap-2.5">
              <stat.icon className="h-4 w-4 text-brand-accent mt-0.5 shrink-0" />
              <div>
                <p className="text-white font-semibold text-sm leading-none">{stat.value}</p>
                <p className="text-[11px] tracking-wide text-brand-muted mt-1">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Auth panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-14">
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-center gap-2.5 mb-8 lg:hidden">
            <div className="h-9 w-9 shrink-0">
              <Image src="/logo.png" alt="Logo" width={36} height={36} className="rounded-xl object-contain" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">{BRANDING.companyName}</h1>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-8">
            <div className="h-11 w-11 rounded-full bg-white/10 flex items-center justify-center mb-5">
              <User className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-sm text-brand-muted mt-1.5 mb-6">
              {mode === 'login'
                ? 'Sign in to get back to your projects.'
                : 'Set up an account to start tracking work.'}
            </p>

            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-brand-muted">Work email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-muted" />
                    <Input
                      id="login-email"
                      name="email"
                      type="email"
                      placeholder="you@company.com"
                      required
                      className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-brand-muted/70 focus-visible:ring-brand-accent/40"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password" className="text-brand-muted">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-muted" />
                    <Input
                      id="login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter password"
                      required
                      className="pl-9 pr-9 bg-white/5 border-white/10 text-white placeholder:text-brand-muted/70 focus-visible:ring-brand-accent/40"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-brand-muted hover:text-white hover:bg-white/10"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-white text-brand-ink hover:bg-white/90 font-semibold"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign in
                </Button>
                <p className="text-xs text-center text-brand-muted">
                  Demo: admin@company.com / admin123
                </p>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-name" className="text-brand-muted">Full name</Label>
                  <Input
                    id="reg-name"
                    name="name"
                    placeholder="Jane Cooper"
                    required
                    className="bg-white/5 border-white/10 text-white placeholder:text-brand-muted/70 focus-visible:ring-brand-accent/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email" className="text-brand-muted">Work email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-muted" />
                    <Input
                      id="reg-email"
                      name="email"
                      type="email"
                      placeholder="you@company.com"
                      required
                      className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-brand-muted/70 focus-visible:ring-brand-accent/40"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password" className="text-brand-muted">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-muted" />
                    <Input
                      id="reg-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min 6 characters"
                      required
                      minLength={6}
                      className="pl-9 pr-9 bg-white/5 border-white/10 text-white placeholder:text-brand-muted/70 focus-visible:ring-brand-accent/40"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-brand-muted hover:text-white hover:bg-white/10"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-white text-brand-ink hover:bg-white/90 font-semibold"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create account
                </Button>
              </form>
            )}

            <button
              type="button"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="group w-full text-center text-sm text-brand-muted mt-5"
            >
              {mode === 'login' ? (
                <>New here? <span className="text-brand-accent group-hover:text-white group-hover:underline transition-colors">Create an account</span></>
              ) : (
                <>Already have an account? <span className="text-brand-accent group-hover:text-white group-hover:underline transition-colors">Sign in</span></>
              )}
            </button>
          </div>

          <p className="text-center text-xs text-brand-muted/70 mt-6">
            {BRANDING.companyName} · {BRANDING.portalLabel.toUpperCase()}
          </p>
        </div>
      </div>
    </div>
  )
}
