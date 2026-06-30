import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

import { db } from '#/db'
import { Accounts, Sessions, Users, Verifications } from '#/db/schema'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: Users,
      session: Sessions,
      account: Accounts,
      verification: Verifications,
    },
  }),
  emailAndPassword: { enabled: true },
  plugins: [tanstackStartCookies()],
})
