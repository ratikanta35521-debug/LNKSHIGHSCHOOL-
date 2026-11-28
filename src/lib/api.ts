import { AuthUser } from '../types';

const PROFILE_STORAGE_KEY = 'lnks_portal_user_profile_v1';

// In-memory Bearer token (paired with server HttpOnly Partitioned session cookie for refresh persistence)
let authToken: string | null = null;
let onUnauthorizedCallback: (() => void) | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

export function setUnauthorizedHandler(cb: () => void): void {
  onUnauthorizedCallback = cb;
}

/**
 * Persists non-sensitive user profile metadata in localStorage so page refresh
 * renders immediately while the server HttpOnly session cookie is re-verified against SQLite.
 */
export function saveCachedUserProfile(user: AuthUser): void {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

export function loadCachedUserProfile(): AuthUser | null {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (parsed && parsed.role && parsed.name && typeof parsed.id === 'number') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearCachedUserProfile(): void {
  try {
    localStorage.removeItem(PROFILE_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiRequest<T>(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    isFormData?: boolean;
    skipUnauthorizedHandler?: boolean;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'X-Requested-With': 'XMLHttpRequest',
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  let fetchBody: BodyInit | undefined;
  if (options.isFormData && options.body instanceof FormData) {
    fetchBody = options.body;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    fetchBody = JSON.stringify(options.body);
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: fetchBody,
    credentials: 'include',
    cache: 'no-store',
  });

  if (res.status === 401 && !options.skipUnauthorizedHandler) {
    authToken = null;
    clearCachedUserProfile();
    if (onUnauthorizedCallback) onUnauthorizedCallback();
  }

  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    let errMsg = `Request failed (${res.status})`;
    if (contentType.includes('application/json')) {
      const data = await res.json().catch(() => ({}));
      if (data?.error) errMsg = data.error;
    }
    throw new ApiError(errMsg, res.status);
  }

  if (contentType.includes('application/json')) {
    return (await res.json()) as T;
  }
  return (await res.text()) as unknown as T;
}

export async function downloadAuthenticatedFile(url: string, filename: string): Promise<void> {
  const headers: Record<string, string> = {
    'X-Requested-With': 'XMLHttpRequest',
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  const res = await fetch(url, { headers, credentials: 'include' });
  if (!res.ok) {
    throw new Error('Download failed.');
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
}
