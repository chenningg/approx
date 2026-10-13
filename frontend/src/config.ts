export interface AppConfig {
  apiBaseUrl: string
  authEnabled: boolean
}

export const config: AppConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000',
  authEnabled: import.meta.env.VITE_AUTH_ENABLED ? JSON.parse(import.meta.env.VITE_AUTH_ENABLED.toLowerCase()) : false
}