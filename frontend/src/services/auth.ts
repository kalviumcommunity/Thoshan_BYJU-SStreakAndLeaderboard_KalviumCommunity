import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  onAuthStateChanged,
  type User as FirebaseUser
} from "firebase/auth";
import { auth } from "../config/firebase";

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface BackendUser {
  id: string;
  firebaseUid: string;
  email: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
  latestStreak?: Record<string, unknown> | null;
  weeklyScore?: Record<string, unknown> | null;
}

/**
 * Sign up a new user with Firebase Email & Password, update display name, and sync with backend database.
 */
export async function signUp(email: string, password: string, name: string): Promise<{ firebaseUser: FirebaseUser; user: BackendUser }> {
  // 1. Create user in Firebase Auth
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  
  if (name) {
    await updateProfile(userCredential.user, { displayName: name });
  }

  // 2. Obtain Firebase ID Token
  const idToken = await userCredential.user.getIdToken();

  // 3. Sync user into PostgreSQL database via backend API
  const response = await fetch(`${API_BASE_URL}/auth/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`
    },
    body: JSON.stringify({ name })
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || "Failed to sync user with backend");
  }

  return {
    firebaseUser: userCredential.user,
    user: data.user
  };
}

/**
 * Log in an existing user with Firebase Email & Password and fetch their backend profile.
 */
export async function login(email: string, password: string): Promise<{ firebaseUser: FirebaseUser; user: BackendUser }> {
  // 1. Authenticate with Firebase Auth
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const idToken = await userCredential.user.getIdToken();

  // 2. Fetch user profile from backend
  const response = await fetch(`${API_BASE_URL}/profile`, {
    headers: {
      "Authorization": `Bearer ${idToken}`
    }
  });

  let data = await response.json();

  // Edge case: If user exists in Firebase but hasn't synced with Postgres yet
  if (response.status === 404) {
    const syncResponse = await fetch(`${API_BASE_URL}/auth/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      },
      body: JSON.stringify({ name: userCredential.user.displayName || "" })
    });
    data = await syncResponse.json();
  }

  if (!data.success) {
    throw new Error(data.message || "Failed to fetch user profile");
  }

  return {
    firebaseUser: userCredential.user,
    user: data.user
  };
}

/**
 * Sign in using Firebase Google Auth popup and sync with backend database.
 */
export async function signInWithGoogle(): Promise<{ firebaseUser: FirebaseUser; user: BackendUser }> {
  const provider = new GoogleAuthProvider();
  const userCredential = await signInWithPopup(auth, provider);
  const idToken = await userCredential.user.getIdToken();

  const response = await fetch(`${API_BASE_URL}/auth/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`
    },
    body: JSON.stringify({ name: userCredential.user.displayName || "" })
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || "Failed to sync Google user with backend");
  }

  return {
    firebaseUser: userCredential.user,
    user: data.user
  };
}

/**
 * Log out current user from Firebase.
 */
export async function logout(): Promise<void> {
  await signOut(auth);
}

/**
 * Get fresh Firebase ID token for authenticated requests.
 */
export async function getAuthToken(): Promise<string | null> {
  const currentUser = auth.currentUser;
  if (!currentUser) return null;
  return currentUser.getIdToken();
}

/**
 * Fetch authenticated user profile from backend.
 */
export async function fetchProfile(): Promise<BackendUser> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error("No authenticated user found");
  }

  const response = await fetch(`${API_BASE_URL}/profile`, {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || "Failed to fetch profile");
  }

  return data.user;
}

/**
 * Listen to auth state changes.
 */
export function subscribeToAuthState(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}
