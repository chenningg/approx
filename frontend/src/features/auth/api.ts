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

export interface VerifyResponse {
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

export async function verify(): Promise<VerifyResponse> {
  const response = await fetch(`${config.apiBaseUrl}/auth/verify`, {
    method: 'POST',
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`Verification failed with status ${response.status}`)
  }

  return (await response.json()) as VerifyResponse
}

export async function logout(): Promise<void> {
  const response = await fetch(`${config.apiBaseUrl}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`Logout failed with status ${response.status}`)
  }
}