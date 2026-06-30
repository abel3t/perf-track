import { Link, useRouter } from '@tanstack/react-router'
import { CalendarDays, BarChart2, LogOut, Zap } from 'lucide-react'
import { authClient } from '#/lib/auth-client'
import { Route } from '#/routes/_app'
import { NotificationToggle } from '#/routes/_app'

const tabs = [
  { to: '/timeline', label: 'Timeline', icon: CalendarDays },
  { to: '/stats', label: 'Stats', icon: BarChart2 },
]

export default function SideNav() {
  const router = useRouter()
  const { user } = Route.useRouteContext()

  async function handleSignOut() {
    await authClient.signOut()
    await router.navigate({ to: '/login' })
  }

  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-[var(--line)] bg-[var(--header-bg)] backdrop-blur-md h-full">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-[var(--line)]">
        <div className="flex items-center gap-2">
          <Zap size={20} className="text-[var(--lagoon-deep)]" fill="currentColor" />
          <span className="text-lg font-bold text-[var(--sea-ink)] display-title">PerfTrack</span>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {tabs.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[var(--sea-ink-soft)] hover:bg-[var(--line)] transition-colors [&.active]:bg-[var(--lagoon-deep)]/10 [&.active]:text-[var(--lagoon-deep)]"
            activeProps={{ className: 'active' }}
          >
            <Icon size={18} strokeWidth={1.8} />
            {label}
          </Link>
        ))}
      </nav>

      {/* User + logout */}
      <div className="px-3 py-4 border-t border-[var(--line)] space-y-1">
        <div className="px-3 py-2">
          <p className="text-xs font-semibold text-[var(--sea-ink)] truncate">{user.name}</p>
          <p className="text-[10px] text-[var(--sea-ink-soft)] truncate">{user.email}</p>
        </div>
        <div className="px-3 py-1">
          <NotificationToggle />
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[var(--sea-ink-soft)] hover:bg-red-50 hover:text-red-500 transition-colors"
        >
          <LogOut size={18} strokeWidth={1.8} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
