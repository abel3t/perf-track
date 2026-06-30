import { Link, useRouter } from '@tanstack/react-router'
import { CalendarDays, BarChart2, LogOut } from 'lucide-react'
import { authClient } from '#/lib/auth-client'

const tabs = [
  { to: '/timeline', label: 'Timeline', icon: CalendarDays },
  { to: '/stats', label: 'Stats', icon: BarChart2 },
]

export default function BottomNav() {
  const router = useRouter()

  async function handleSignOut() {
    await authClient.signOut()
    await router.navigate({ to: '/login' })
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-md mx-auto flex border-t border-[var(--line)] bg-[var(--header-bg)] backdrop-blur-md">
        {tabs.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex-1 flex flex-col items-center gap-1 py-2.5 text-[var(--sea-ink-soft)] [&.active]:text-[var(--lagoon-deep)] transition-colors"
            activeProps={{ className: 'active' }}
          >
            <Icon size={22} strokeWidth={1.8} />
            <span className="text-[10px] font-semibold tracking-wide uppercase">{label}</span>
          </Link>
        ))}
        <button
          onClick={handleSignOut}
          className="flex-1 flex flex-col items-center gap-1 py-2.5 text-[var(--sea-ink-soft)] transition-colors hover:text-red-400"
        >
          <LogOut size={22} strokeWidth={1.8} />
          <span className="text-[10px] font-semibold tracking-wide uppercase">Logout</span>
        </button>
      </div>
    </nav>
  )
}
