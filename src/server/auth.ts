import { createServerFn } from '@tanstack/react-start'

export const getSession = createServerFn({ method: 'GET' }).handler(async () => {
  const [{ auth }, { getRequest }] = await Promise.all([
    import('#/lib/auth'),
    import('@tanstack/react-start/server'),
  ])
  const req = getRequest()
  return auth.api.getSession({ headers: req.headers })
})
