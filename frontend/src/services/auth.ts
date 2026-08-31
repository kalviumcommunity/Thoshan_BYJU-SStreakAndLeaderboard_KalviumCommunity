import {
  apiFetch,
  API_BASE_URL,
  TOKEN_KEY,
  USER_KEY,
  notifyAuthListeners,
  subscribeToAuth,
  type BackendUser,
} from './apiClient';

export { API_BASE_URL, TOKEN_KEY, USER_KEY, type BackendUser };

/**
 * Get JWT Bearer token from local storage.
 */
export async function getAuthToken(): Promise<string | null> {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Register a new user with email, password, and name via backend JWT endpoint.
 */
export async function signUp(
  email: string,
  password: string,
  name: string
): Promise<{ token: string; user: BackendUser }> {
  const response = await apiFetch('/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: email.trim(),
      password,
      name: name.trim(),
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Registration failed. Please try again.');
  }

  const user: BackendUser = {
    ...data.user,
    uid: data.user.id,
    displayName: data.user.name,
  };

  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  notifyAuthListeners(user);

  return {
    token: data.token,
    user,
  };
}

/**
 * Log in an existing user with email and password via backend JWT endpoint.
 */
export async function login(
  email: string,
  password: string
): Promise<{ token: string; user: BackendUser }> {
  const response = await apiFetch('/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: email.trim(),
      password,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Invalid email or password.');
  }

  const user: BackendUser = {
    ...data.user,
    uid: data.user.id,
    displayName: data.user.name,
  };

  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  notifyAuthListeners(user);

  return {
    token: data.token,
    user,
  };
}

/**
 * Log out user and clear JWT token session.
 */
export async function logout(): Promise<void> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    try {
      await apiFetch('/auth/logout', {
        method: 'POST',
      });
    } catch {
      // Ignore network errors on logout
    }
  }

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  notifyAuthListeners(null);
}

/**
 * Fetch authenticated user profile using current JWT token.
 */
export async function fetchProfile(): Promise<BackendUser> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    throw new Error('No authenticated user session found');
  }

  const response = await apiFetch('/auth/me');

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Failed to fetch user profile');
  }

  const user: BackendUser = {
    ...data.user,
    uid: data.user.id,
    displayName: data.user.name,
  };

  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

/**
 * Listen to JWT auth state changes.
 */
export function subscribeToAuthState(callback: (user: BackendUser | null) => void): () => void {
  const unsubscribe = subscribeToAuth(callback);

  const token = localStorage.getItem(TOKEN_KEY);
  const cachedUserRaw = localStorage.getItem(USER_KEY);

  if (token) {
    if (cachedUserRaw) {
      try {
        const cachedUser = JSON.parse(cachedUserRaw) as BackendUser;
        callback(cachedUser);
      } catch {
        callback(null);
      }
    }

    fetchProfile()
      .then((user) => {
        callback(user);
      })
      .catch(() => {
        // If profile fetch fails with 401, apiFetch automatically cleared session and notified
      });
  } else {
    callback(null);
  }

  return unsubscribe;
}
