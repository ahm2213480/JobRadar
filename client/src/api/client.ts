import type { AuthSuccessResponse, AuthUser, RefreshResponse } from '../types/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  environment: string;
  database: 'connected' | 'not_configured' | 'unreachable';
  timestamp: string;
}

// The access token lives in memory only (never localStorage) to keep the XSS
// blast radius small. Persistence across reloads is handled by the httpOnly
// refresh cookie via POST /auth/refresh.
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

interface RequestOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
}

async function parseError(response: Response): Promise<ApiError> {
  let message = `Request failed with status ${response.status}`;
  try {
    const data = (await response.json()) as { error?: string };
    if (data.error) {
      message = data.error;
    }
  } catch {
    // Response body was not JSON — keep the generic message.
  }
  return new ApiError(response.status, message);
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
  allowRefresh = true,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  // Access token expired: try one silent refresh, then replay the request.
  if (response.status === 401 && allowRefresh && !path.startsWith('/auth/')) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return request<T>(path, options, false);
    }
  }

  if (!response.ok) {
    throw await parseError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

/** Silent session bootstrap/refresh using the httpOnly cookie. */
export async function refreshSession(): Promise<boolean> {
  try {
    const data = await request<RefreshResponse>('/auth/refresh', { method: 'POST' }, false);
    setAccessToken(data.accessToken);
    return true;
  } catch {
    setAccessToken(null);
    return false;
  }
}

export async function fetchHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health');
}

export async function register(input: {
  fullName: string;
  email: string;
  password: string;
}): Promise<AuthSuccessResponse> {
  return request<AuthSuccessResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthSuccessResponse> {
  return request<AuthSuccessResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function logout(): Promise<void> {
  try {
    await request<void>('/auth/logout', { method: 'POST' }, false);
  } finally {
    setAccessToken(null);
  }
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const data = await request<{ user: AuthUser }>('/auth/me');
  return data.user;
}
