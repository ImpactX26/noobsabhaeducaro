/**
 * Authentication service for SIEG.AI.
 *
 * Credentials are verified by the backend against accounts in PostgreSQL. There is no local user
 * registry, no demo account and no auto-registration: a session exists only while the browser holds
 * a token the backend issued (and still accepts).
 */

import { ApiError, api, setAuthToken } from '../services/api';
import { initialApplicantDetails } from '../data/mockData';
import { AuthResponse, User, UserApplicationData } from './types';

const TOKEN_KEY = 'sieg_auth_token';
const USER_DATA_PREFIX = 'sieg_user_data_';
// keys written by the old, insecure localStorage mock: removed so a stale fake session cannot survive
const LEGACY_KEYS = ['sieg_auth_session', 'sieg_users_registry'];

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* storage unavailable: the session then lasts until the tab closes */
    }
  },
  remove: (k: string) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

const messageOf = (err: unknown) => (err instanceof ApiError || err instanceof Error ? err.message : 'Something went wrong. Please try again.');

class AuthService {
  constructor() {
    LEGACY_KEYS.forEach(store.remove);
    setAuthToken(store.get(TOKEN_KEY));
  }

  /** Re-opens the session after a page reload, but only if the backend still accepts the stored token. */
  async restoreSession(): Promise<User | null> {
    if (!store.get(TOKEN_KEY)) return null;
    try {
      return await api.me();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) this.signOut(); // expired, revoked or tampered
      return null;
    }
  }

  async signIn(email: string, password: string): Promise<AuthResponse> {
    if (!email.trim() || !password) return { success: false, error: 'Please enter both email and password.' };
    try {
      const session = await api.login({ email: email.trim(), password });
      this.setToken(session.token);
      return { success: true, user: session.user };
    } catch (err) {
      return { success: false, error: messageOf(err) };
    }
  }

  async signUp(name: string, email: string, password: string): Promise<AuthResponse> {
    if (!name.trim()) return { success: false, error: 'Full name is required.' };
    if (!email.trim().includes('@')) return { success: false, error: 'A valid email address is required.' };
    if (password.length < 8) return { success: false, error: 'Password must be at least 8 characters.' };
    try {
      const session = await api.register({ name: name.trim(), email: email.trim(), password });
      this.setToken(session.token);
      return { success: true, user: session.user };
    } catch (err) {
      return { success: false, error: messageOf(err) };
    }
  }

  signOut(): void {
    store.remove(TOKEN_KEY);
    setAuthToken(null);
  }

  private setToken(token: string) {
    store.set(TOKEN_KEY, token);
    setAuthToken(token);
  }

  // ---- per-account form defaults (convenience only; the applicant's real data is on the backend)

  getUserData(user: User): UserApplicationData {
    const stored = store.get(`${USER_DATA_PREFIX}${user.id}`);
    if (stored) {
      try {
        return JSON.parse(stored) as UserApplicationData;
      } catch {
        /* fall through to fresh defaults */
      }
    }
    return {
      details: { ...initialApplicantDetails, fullName: user.name, email: user.email },
    };
  }

  saveUserData(userId: string, data: UserApplicationData): void {
    store.set(`${USER_DATA_PREFIX}${userId}`, JSON.stringify(data));
  }
}

export const authService = new AuthService();
