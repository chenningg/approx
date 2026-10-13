export interface AppConfig {
  apiBaseUrl: string
}

export const config: AppConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000',
}