export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  session_id: string
  email: string
  username: string
}

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export async function login(body: LoginRequest): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
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