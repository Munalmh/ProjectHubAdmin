'use client'

import { useEffect } from 'react'
import { useSession, SessionProvider } from 'next-auth/react'
import { useAppStore } from '@/store/app-store'
import { LoginPage } from '@/components/app/auth/login-page'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import {
  LayoutDashboard, FolderKanban, Columns3, Ticket, Users, LogOut, Menu, Moon, Sun, X, BarChart3, UserCog, Brush
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { signOut } from 'next-auth/react'
import { Toaster } from 'sonner'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BRANDING } from '@/lib/branding'
import { useBrandingStore } from '@/store/brandingStore'

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: false },
  { href: '/projects', label: 'Projects', icon: FolderKanban, exact: false },
  { href: '/board', label: 'Kanban Board', icon: Columns3, exact: false },
  { href: '/tickets', label: 'Tickets', icon: Ticket, exact: false },
  { href: '/team', label: 'Team', icon: Users, exact: false },
  { href: '/reports', label: 'Reports', icon: BarChart3, exact: false },
  { href: '/workload', label: 'Workload', icon: UserCog, exact: false },
  { href: '/branding', label: 'Branding', icon: Brush, exact: false },
]

function SidebarNav({ collapsed, onClose }: { collapsed?: boolean; onClose?: () => void }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const user = session?.user as { name?: string; email?: string; role?: string } | undefined
  const { companyName, logoUrl } = useBrandingStore()

  return (
    <div className="flex flex-col h-full bg-brand-ink text-white">
      <div className="p-4 flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-white overflow-hidden shrink-0 flex items-center justify-center">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-full w-full object-contain p-0.5" />
          ) : (
            <img src="/logo.png" alt="Logo" className="h-full w-full object-cover p-0.5" />
          )}
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <h1 className="text-[15px] font-bold tracking-tight leading-none text-white truncate max-w-[130px]">{companyName}</h1>
            <span className="text-[9px] font-bold text-[#8CC63F] tracking-widest mt-1 uppercase truncate">{BRANDING.portalLabel}</span>
          </div>
        )}
        {onClose && (
          <Button variant="ghost" size="icon" className="ml-auto h-8 w-8 lg:hidden text-white hover:bg-white/10 hover:text-white" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <ScrollArea className="flex-1 px-3 py-2">
        <nav className="flex flex-col gap-1">
          {navItems.map(item => {
            const active = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onClose?.()}
                className={`flex items-center gap-3 rounded-md px-3 h-10 text-sm transition-colors ${
                  active
                    ? 'bg-[#8CC63F]/10 text-[#8CC63F] font-medium'
                    : 'text-[#A0ABC0] hover:bg-white/5 hover:text-white'
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && item.label}
              </Link>
            )
          })}
        </nav>
      </ScrollArea>
      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-3 p-2 rounded-lg">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs bg-brand-accent/15 text-brand-accent">
              {user?.name ? getInitials(user.name) : '?'}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
              <p className="text-[11px] text-brand-muted truncate capitalize">{user?.role || 'member'}</p>
            </div>
          )}
          {!collapsed && (
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-brand-muted hover:bg-white/10 hover:text-white" onClick={() => signOut({ callbackUrl: '/' })} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}

function AppContent({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const { sidebarOpen, setSidebarOpen } = useAppStore()

  useEffect(() => {
    if (status === 'loading') return
    if (!session) return
  }, [session, status])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!session) return <LoginPage />

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col shrink-0 h-screen sticky top-0">
        <SidebarNav />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-60 p-0 border-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarNav onClose={() => setSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b flex items-center gap-3 px-4 shrink-0">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
          </Sheet>
          <div className="flex-1" />
          <ThemeToggle />
        </header>
        <div className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </div>
      </main>
      <Toaster richColors position="top-right" />
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AppContent>{children}</AppContent>
    </SessionProvider>
  )
}
