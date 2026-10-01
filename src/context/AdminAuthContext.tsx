import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type UserRole = 'super_admin' | 'restaurant_owner' | null;

interface AdminAuthContextValue {
  isAuthenticated: boolean;
  role: UserRole;
  restaurantId: string | null;
  isLoading: boolean;
  isAuthorizedFor: (venueId: string) => boolean;
  loginRestaurant: (venueId: string, password: string) => Promise<{ success: boolean; error?: string; remainingMinutes?: number }>;
  login: (password: string, venueId?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const ADMIN_STORAGE_KEY = 'app_admin_session_auth';

// Arabic digit normalizer
function normalizeArabicDigits(str: string): string {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return str.replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)));
}

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
        credentials: 'include',
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

    setIsAuthenticated(false);
    setRole(null);
    setRestaurantId(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  // Check if current session is authorized for a specific restaurant
  const isAuthorizedFor = useCallback(
    (venueId: string): boolean => {
      if (!isAuthenticated || !role) return false;
      // Super admin is authorized for EVERY restaurant directly without password
      if (role === 'super_admin') return true;
      // Restaurant owner is authorized if matching restaurantId
      if (role === 'restaurant_owner') {
        if (!restaurantId) return true;
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
  ): Promise<{ success: boolean; error?: string; remainingMinutes?: number }> => {
    try {
      const cleanPassword = normalizeArabicDigits(password.trim());
      const res = await fetch('/api/admin/restaurant-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ restaurantId: venueId, password: cleanPassword }),
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = {};
      if (contentType.includes('application/json')) {
        data = await res.json().catch(() => ({}));
      }

      if (res.ok && data.success) {
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

      if (res.status === 429) {
        return {
          success: false,
          error: data.error || 'تم إيقاف المحاولات مؤقتًا لتكرار المحاولات غير الصحيحة',
          remainingMinutes: data.remainingMinutes || 15,
        };
      }

      if (res.status === 404) {
        return {
          success: false,
          error: data.error || 'لم يتم العثور على هذا المطعم',
        };
      }

      if (res.status === 401) {
        return {
          success: false,
          error: data.error || 'كلمة المرور غير صحيحة',
        };
      }

      return {
        success: false,
        error: data.error || `خطأ ${res.status}: تعذر تسجيل الدخول للمطعم`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `تعذر الاتصال بالخادم (${err?.message || 'Network Error'}) - تحقق من اتصالك بالإنترنت`,
      };
    }
  };

  // Backward-compatible login method
  const login = async (password: string, venueId?: string): Promise<boolean> => {
    if (venueId) {
      const result = await loginRestaurant(venueId, password);
      return result.success;
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
