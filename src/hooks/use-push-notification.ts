import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { registerSW } from 'virtual:pwa-register'
import { getVapidPublicKey, subscribePush, unsubscribePush, getPushSubscriptionStatus } from '#/server/push'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export function usePushNotification() {
  const queryClient = useQueryClient()
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [swReady, setSwReady] = useState(false)
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    const ok = 'Notification' in window && 'serviceWorker' in navigator
    setSupported(ok)
    if (ok) setPermission(Notification.permission)
    if ('serviceWorker' in navigator) {
      registerSW({ immediate: true })
      navigator.serviceWorker.ready.then(() => setSwReady(true))
    }
  }, [])

  const { data: status } = useQuery({
    queryKey: ['push-status'],
    queryFn: () => getPushSubscriptionStatus(),
    enabled: swReady,
  })

  const subscribe = useMutation({
    mutationFn: async () => {
      console.log('[push] step 1: requesting permission')
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') throw new Error('Permission denied')

      console.log('[push] step 2: getting VAPID key')
      const { publicKey } = await getVapidPublicKey()
      console.log('[push] step 2 done, publicKey:', publicKey?.slice(0, 20))

      console.log('[push] step 3: waiting for SW ready')
      const reg = await navigator.serviceWorker.ready
      console.log('[push] step 3 done')

      console.log('[push] step 4: subscribing to push')
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      })
      console.log('[push] step 4 done')

      const json = sub.toJSON()
      console.log('[push] step 5: saving subscription to server')
      await subscribePush({
        data: {
          endpoint: json.endpoint!,
          p256dh: json.keys!.p256dh,
          auth: json.keys!.auth,
        },
      })
      console.log('[push] done')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['push-status'] }),
  })

  const unsubscribe = useMutation({
    mutationFn: async () => {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      await sub?.unsubscribe()
      await unsubscribePush()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['push-status'] }),
  })

  return {
    supported,
    permission,
    subscribed: status?.subscribed ?? false,
    isLoading: subscribe.isPending || unsubscribe.isPending,
    error: subscribe.error ?? unsubscribe.error,
    subscribe: () => subscribe.mutate(),
    unsubscribe: () => unsubscribe.mutate(),
  }
}
