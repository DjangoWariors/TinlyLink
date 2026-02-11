import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { authAPI, setTokens, clearTokens, getAccessToken, onAuthLogout } from '@/services/api';
import toast from 'react-hot-toast';
import type { User, Subscription, Usage, LoginCredentials, RegisterData } from '@/types';

interface AuthContextType {
  user: User | null;
  subscription: Subscription | null;
  usage: Usage | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default subscription for free users
const defaultSubscription: Subscription = {
  plan: 'free',
  status: 'active',
  current_period_start: null,
  current_period_end: null,
  cancel_at_period_end: false,
  is_paid: false,
  limits: {
    links_per_month: 50,
    qr_codes_per_month: 10,
    api_calls_per_month: 0,
    custom_domains: 0,
    analytics_retention_days: 30,
    custom_slugs: false,
    password_protection: false,
    show_ads: true,
    team_members: 0,
  },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const isAuthenticated = !!user;

  // Default usage for new users
  const defaultUsage: Usage = {
    period_start: new Date().toISOString(),
    period_end: new Date().toISOString(),
    links_created: 0,
    qr_codes_created: 0,
    api_calls: 0,
  };

  // Clear auth state helper
  const clearAuthState = useCallback(() => {
    clearTokens();
    setUser(null);
    setSubscription(null);
    setUsage(null);
  }, []);

  // Listen for auth logout events from API interceptor
  useEffect(() => {
    const unsubscribe = onAuthLogout(() => {
      clearAuthState();
      toast.error('Your session has expired. Please log in again.');
      navigate('/login');
    });
    return unsubscribe;
  }, [clearAuthState, navigate]);

  // Check if user is already logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = getAccessToken();
      if (token) {
        try {
          const userData = await authAPI.getMe();
          setUser(userData);
          setSubscription(userData.subscription || defaultSubscription);
          setUsage(userData.usage || defaultUsage);
        } catch (error: any) {
          // Only clear tokens on auth errors (401), not network errors
          if (error?.response?.status === 401) {
            clearAuthState();
          }
          // For network errors, keep the token - the interceptor will retry
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, [clearAuthState]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const response = await authAPI.login(credentials);
    setTokens(response.access_token, response.refresh_token);
    setUser(response.user);
    setSubscription(response.subscription || defaultSubscription);
    // Fetch fresh usage after login
    try {
      const userData = await authAPI.getMe();
      setUsage(userData.usage || defaultUsage);
    } catch { setUsage(defaultUsage); }
    navigate('/dashboard');
  }, [navigate]);

  const register = useCallback(async (data: RegisterData) => {
    const response = await authAPI.register(data);
    setTokens(response.access_token, response.refresh_token);
    setUser(response.user);
    setSubscription(response.subscription || defaultSubscription);
    setUsage(defaultUsage);
    navigate('/dashboard');
  }, [navigate]);

  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      // Continue even if logout fails
    }
    clearAuthState();
    navigate('/login');
  }, [clearAuthState, navigate]);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await authAPI.getMe();
      setUser(userData);
      setSubscription(userData.subscription || defaultSubscription);
      setUsage(userData.usage || defaultUsage);
    } catch (error) {
      // Ignore errors
    }
  }, []);

  const value = {
    user,
    subscription,
    usage,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
