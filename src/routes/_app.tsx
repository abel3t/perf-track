import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'
import { getSession } from '#/server/auth'
import BottomNav from '#/components/BottomNav'
import SideNav from '#/components/SideNav'
import { usePushNotification } from '#/hooks/use-push-notification'
import { useMutation } from '@tanstack/react-query'
import { BellIcon, BellOffIcon, BellRingIcon } from 'lucide-react'
import { sendTestPush } from '#/server/push'

export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session?.user) throw redirect({ to: '/login' })
    return { user: session.user }
  },
  component: AppShell,
})

function NotificationBanner() {
  const { supported, permission, subscribed, isLoading, subscribe } = usePushNotification()

  if (!supported || permission === 'denied') return null
  if (subscribed) return null

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-[var(--lagoon-deep)]/10 border-b border-[var(--line)] text-sm">
      <BellIcon size={14} className="text-[var(--lagoon-deep)] shrink-0" />
      <span className="flex-1 text-[var(--sea-ink-soft)]">Enable notifications to get activity reminders</span>
      <button
        onClick={subscribe}
        disabled={isLoading}
        className="text-xs font-semibold text-[var(--lagoon-deep)] cursor-pointer shrink-0"
      >
        {isLoading ? 'Enabling…' : 'Enable'}
      </button>
    </div>
  )
}

export function NotificationToggle() {
  const { supported, permission, subscribed, isLoading, subscribe, unsubscribe } =
    usePushNotification()

  const testPush = useMutation({
    mutationFn: () => sendTestPush(),
    onSuccess: (res) => {
      if (!res.ok) alert('No subscription found — enable notifications first')
      else alert('Test sent! Check your notifications.')
    },
    onError: (err) => alert('Error: ' + (err as Error).message),
  })

  if (!supported || permission === 'denied') return null

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={subscribed ? unsubscribe : subscribe}
        disabled={isLoading}
        className="flex items-center gap-2 text-sm text-[var(--sea-ink-soft)] cursor-pointer hover:text-[var(--sea-ink)] transition-colors"
      >
        {subscribed ? <BellOffIcon size={16} /> : <BellIcon size={16} />}
        {subscribed ? 'Disable notifications' : 'Enable notifications'}
      </button>
      {subscribed && (
        <button
          onClick={() => testPush.mutate()}
          disabled={testPush.isPending}
          className="flex items-center gap-2 text-sm text-[var(--sea-ink-soft)] cursor-pointer hover:text-[var(--lagoon-deep)] transition-colors"
        >
          <BellRingIcon size={16} />
          {testPush.isPending ? 'Sending…' : 'Test notification'}
        </button>
      )}
    </div>
  )
}

function AppShell() {
  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Desktop: sidebar */}
      <SideNav />

      {/* Content area — must be overflow-hidden so child manages its own scroll */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <NotificationBanner />
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
