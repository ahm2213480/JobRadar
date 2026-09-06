const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  environment: string;
  database: 'connected' | 'not_configured' | 'unreachable';
  timestamp: string;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error(`API health check failed with status ${response.status}`);
  }
  return (await response.json()) as HealthResponse;
}
