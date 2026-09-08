import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { User, LoginRequest } from '../types';
import { authApi } from '../services/api';
import { initPushNotifications } from '../services/push';
import { disconnectSocket } from '../services/socket';

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginRequest, rememberMe?: boolean) => Promise<void>;
  loginWithToken: (token: string, user: User, rememberMe?: boolean) => void;
  logout: () => void;
  hasRole: (role: string | string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('nexus_token') || sessionStorage.getItem('nexus_token')
  );
  const [isLoading, setIsLoading] = useState(true);
  const skipGetMe = useRef(false);

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        // Skip getMe if user was just set by login()
        if (skipGetMe.current) {
          skipGetMe.current = false;
        } else {
          try {
            const response = await authApi.getMe();
            if (response.success && response.data) {
              setUser(response.data);
              initPushNotifications();
            } else {
              logout();
            }
          } catch {
            logout();
          }
        }
      }
      setIsLoading(false);
    };

    initAuth();

    // Cross-tab sync: listen for storage changes
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'nexus_token') {
        if (!e.newValue) {
          // Logged out in another tab
          setToken(null);
          setUser(null);
        } else if (e.newValue !== token) {
          // Logged in in another tab
          setToken(e.newValue);
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [token]);

  const login = async (data: LoginRequest, rememberMe = true) => {
    const response = await authApi.login(data);
    if (response.success && response.data) {
      const { token: newToken, user: newUser } = response.data;
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem('nexus_token', newToken);
      storage.setItem('nexus_user', JSON.stringify(newUser));
      skipGetMe.current = true;
      setToken(newToken);
      setUser(newUser);
      initPushNotifications();
    } else {
      throw new Error(response.error || 'Ошибка авторизации');
    }
  };

  const loginWithToken = (newToken: string, newUser: User, rememberMe = true) => {
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('nexus_token', newToken);
    storage.setItem('nexus_user', JSON.stringify(newUser));
    skipGetMe.current = true;
    setToken(newToken);
    setUser(newUser);
    initPushNotifications();
  };

  const logout = () => {
    disconnectSocket();
    localStorage.removeItem('nexus_token');
    localStorage.removeItem('nexus_user');
    sessionStorage.removeItem('nexus_token');
    sessionStorage.removeItem('nexus_user');
    setToken(null);
    setUser(null);
  };

  const hasRole = (role: string | string[]) => {
    if (!user) return false;
    const userRoles = user.roles?.length ? user.roles : [user.role];
    if (Array.isArray(role)) return role.some(r => userRoles.includes(r));
    return userRoles.includes(role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,
        loginWithToken,
        logout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
