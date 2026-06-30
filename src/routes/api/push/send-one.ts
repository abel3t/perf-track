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

        try {
          await receiver.verify({
            signature: request.headers.get('Upstash-Signature') ?? '',
            body,
          })
        } catch {
          return new Response('Unauthorized', { status: 401 })
        }

        const { activityId, scheduledDate } = JSON.parse(body)
        await sendActivityNotification(activityId, scheduledDate)
        return Response.json({ ok: true })
      },
    },
  },
})
