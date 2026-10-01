import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type UserRole = 'super_admin' | 'restaurant_owner' | null;

interface AdminAuthContextValue {
  isAuthenticated: boolean;
  role: UserRole;
  restaurantId: string | null;
  isLoading: boolean;
  isAuthorizedFor: (venueId: string) => boolean;
  loginRestaurant: (venueId: string, password: string) => Promise<{ success: boolean; error?: string }>;
  login: (password: string, venueId?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const ADMIN_STORAGE_KEY = 'app_admin_session_auth';
const SECRET_ADMIN_PASS = '2002500';

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [role, setRole] = useState<UserRole>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Check server-side session on mount
  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', {
        headers: { credentials: 'include' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.isAuthenticated) {
          setIsAuthenticated(true);
          setRole(data.role);
          setRestaurantId(data.restaurantId);
          setIsLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Failed to verify server session:', err);
    }

    // Fallback: check local storage if offline or running in mock
    try {
      const stored = sessionStorage.getItem(ADMIN_STORAGE_KEY) || localStorage.getItem(ADMIN_STORAGE_KEY);
      if (stored === 'true') {
        setIsAuthenticated(true);
        setRole('restaurant_owner');
      } else {
        setIsAuthenticated(false);
        setRole(null);
        setRestaurantId(null);
      }
    } catch {
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  // Check if current session is authorized for a specific restaurant
  const isAuthorizedFor = useCallback(
    (venueId: string): boolean => {
      if (!isAuthenticated || !role) return false;
      // Super admin is authorized for EVERY restaurant directly without password or code
      if (role === 'super_admin') return true;
      // Restaurant owner is authorized if matching restaurantId or legacy session
      if (role === 'restaurant_owner') {
        if (!restaurantId) return true; // Generic owner
        return restaurantId === venueId;
      }
      return false;
    },
    [isAuthenticated, role, restaurantId]
  );

  // Login using restaurant password
  const loginRestaurant = async (
    venueId: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/admin/restaurant-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ restaurantId: venueId, password }),
      });

      if (res.ok) {
        const data = await res.json();
        setIsAuthenticated(true);
        setRole(data.role || 'restaurant_owner');
        setRestaurantId(data.restaurantId || venueId);
        try {
          sessionStorage.setItem(ADMIN_STORAGE_KEY, 'true');
        } catch {
          // Ignore
        }
        return { success: true };
      }

      const errData = await res.json().catch(() => ({}));
      return { success: false, error: errData.error || 'كلمة مرور المطعم غير صحيحة' };
    } catch (err) {
      // Offline fallback
      if (password.trim() === SECRET_ADMIN_PASS) {
        setIsAuthenticated(true);
        setRole('restaurant_owner');
        setRestaurantId(venueId);
        return { success: true };
      }
      return { success: false, error: 'حدث خطأ في الاتصال بالخادم' };
    }
  };

  // Backward-compatible login method
  const login = async (password: string, venueId?: string): Promise<boolean> => {
    if (venueId) {
      const result = await loginRestaurant(venueId, password);
      return result.success;
    }

    if (password.trim() === SECRET_ADMIN_PASS) {
      try {
        sessionStorage.setItem(ADMIN_STORAGE_KEY, 'true');
        localStorage.setItem(ADMIN_STORAGE_KEY, 'true');
      } catch {
        // Ignore
      }
      setIsAuthenticated(true);
      setRole('restaurant_owner');
      return true;
    }
    return false;
  };

  const logout = async (): Promise<void> => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // Ignore
    }
    try {
      sessionStorage.removeItem(ADMIN_STORAGE_KEY);
      localStorage.removeItem(ADMIN_STORAGE_KEY);
    } catch {
      // Ignore
    }
    setIsAuthenticated(false);
    setRole(null);
    setRestaurantId(null);
  };

  return (
    <AdminAuthContext.Provider
      value={{
        isAuthenticated,
        role,
        restaurantId,
        isLoading,
        isAuthorizedFor,
        loginRestaurant,
        login,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = (): AdminAuthContextValue => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};
