import { config } from '@/config'

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  session_id: string
  email: string
  username: string
}

export async function login(body: LoginRequest): Promise<LoginResponse> {
  const response = await fetch(`${config.apiBaseUrl}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as {
      detail?: string
    } | null
    throw new Error(error?.detail ?? `Login failed with status ${response.status}`)
  }

  return (await response.json()) as LoginResponse
}