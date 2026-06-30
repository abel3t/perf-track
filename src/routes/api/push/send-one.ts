import { createFileRoute } from '@tanstack/react-router'
import { Receiver } from '@upstash/qstash'
import { sendActivityNotification } from '#/server/push'

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
})

export const Route = createFileRoute('/api/push/send-one')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text()
        console.log('[send-one] received webhook, body length:', body.length)

        try {
          await receiver.verify({
            signature: request.headers.get('Upstash-Signature') ?? '',
            body,
          })
        } catch (err) {
          console.error('[send-one] signature verification failed:', err)
          return new Response('Unauthorized', { status: 401 })
        }

        const { activityId, scheduledDate } = JSON.parse(body)
        console.log('[send-one] sending notification for', { activityId, scheduledDate })
        await sendActivityNotification(activityId, scheduledDate)
        console.log('[send-one] done')
        return Response.json({ ok: true })
      },
    },
  },
})
