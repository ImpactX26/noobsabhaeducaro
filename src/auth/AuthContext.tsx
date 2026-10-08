import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { User, UserApplicationData, AuthResponse } from './types';
import { authService } from './authService';
import { setUnauthorizedHandler } from '../services/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  /** True while a stored session is being re-verified with the backend. */
  isLoading: boolean;
  authModalOpen: boolean;
  authModalMode: 'login' | 'signup';
  userData: UserApplicationData | null;
  signIn: (email: string, pass: string) => Promise<AuthResponse>;
  signUp: (name: string, email: string, pass: string) => Promise<AuthResponse>;
  signOut: () => void;
  openAuthModal: (mode?: 'login' | 'signup') => void;
  closeAuthModal: () => void;
  saveCurrentUserData: (data: UserApplicationData) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');
  const [userData, setUserData] = useState<UserApplicationData | null>(null);

  const start = useCallback((account: User) => {
    setUser(account);
    setUserData(authService.getUserData(account));
  }, []);

  const signOut = useCallback(() => {
    authService.signOut();
    setUser(null);
    setUserData(null);
  }, []);

  // Re-open the session on page load, but only if the backend still accepts the stored token
  useEffect(() => {
    let cancelled = false;
    void authService.restoreSession().then((account) => {
      if (cancelled) return;
      if (account) start(account);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [start]);

  // The backend rejected our token (expired / revoked): end the session here too
  useEffect(() => {
    setUnauthorizedHandler(signOut);
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  const openAuthModal = (mode: 'login' | 'signup' = 'login') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
  };

  const signIn = async (email: string, pass: string): Promise<AuthResponse> => {
    const res = await authService.signIn(email, pass);
    if (res.success && res.user) {
      start(res.user);
      setAuthModalOpen(false);
    }
    return res;
  };

  const signUp = async (name: string, email: string, pass: string): Promise<AuthResponse> => {
    const res = await authService.signUp(name, email, pass);
    if (res.success && res.user) {
      start(res.user);
      setAuthModalOpen(false);
    }
    return res;
  };

  const saveCurrentUserData = (data: UserApplicationData) => {
    if (user) {
      setUserData(data);
      authService.saveUserData(user.id, data);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        authModalOpen,
        authModalMode,
        userData,
        signIn,
        signUp,
        signOut,
        openAuthModal,
        closeAuthModal,
        saveCurrentUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
