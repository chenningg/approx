import { verify } from './api'

export const authKey = ['auth', 'verify'] as const

export const verifyQueryOptions = {
  queryKey: authKey,
  queryFn: verify,
  retry: false,
}
