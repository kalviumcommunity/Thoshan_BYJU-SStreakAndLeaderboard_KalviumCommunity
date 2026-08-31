export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
export const TOKEN_KEY = 'byjus_jwt_token';
export const USER_KEY = 'byjus_user_profile';

export interface BackendUser {
  id: string;
  firebaseUid?: string | null;
  email: string;
  name: string | null;
  displayName?: string | null;
  uid?: string;
  createdAt: string;
  updatedAt: string;
  latestStreak?: Record<string, unknown> | null;
  weeklyScore?: Record<string, unknown> | null;
}

type AuthListener = (user: BackendUser | null) => void;
const listeners: Set<AuthListener> = new Set();

export function notifyAuthListeners(user: BackendUser | null) {
  listeners.forEach((listener) => {
    try {
      listener(user);
    } catch (e) {
      console.error('Error in auth listener:', e);
    }
  });
}

export function subscribeToAuth(callback: (user: BackendUser | null) => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export async function getAuthToken(): Promise<string | null> {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Small centralized fetch wrapper that automatically attaches the JWT Bearer token
 * and clears stored session + triggers redirect to /login on 401 Unauthorized.
 */
export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Clear stored token and user profile
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    notifyAuthListeners(null);

    // Prevent infinite loop if already on login page
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
  }

  return response;
}
