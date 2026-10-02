import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

export type UserRole = 'super_admin' | 'restaurant_owner' | null;

interface AdminAuthContextValue {
  isAuthenticated: boolean;
  role: UserRole;
  restaurantId: string | null;
  isLoading: boolean;
  isAuthorizedFor: (venueId: string) => boolean;
  loginRestaurant: (
    venueId: string,
    password: string
  ) => Promise<{ success: boolean; error?: string; code?: string; remainingSeconds?: number; mustChangePassword?: boolean }>;
  loginSuperAdmin: (
    password: string
  ) => Promise<{ success: boolean; error?: string; code?: string; remainingSeconds?: number }>;
  login: (password: string, targetVenueId?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

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
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.isAuthenticated) {
          setIsAuthenticated(true);
          setRole(data.role);
          setRestaurantId(data.restaurantId);

          // Authenticate client Firebase SDK using minted Custom Token
          if (data.customToken) {
            await signInWithCustomToken(auth, data.customToken).catch((err) => {
              console.warn('Failed to sign in with custom token:', err);
            });
          }

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
      if (!isAuthenticated || !role || !venueId) return false;
      // Super admin is authorized for EVERY restaurant
      if (role === 'super_admin') return true;
      // Restaurant owner must have an explicit matching restaurantId
      if (role === 'restaurant_owner') {
        if (!restaurantId) return false;
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
  ): Promise<{
    success: boolean;
    error?: string;
    code?: string;
    remainingSeconds?: number;
    mustChangePassword?: boolean;
  }> => {
    try {
      const cleanPassword = normalizeArabicDigits(password.trim());
      const res = await fetch('/api/admin/restaurant-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
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

        // Authenticate client Firebase SDK with custom token
        if (data.customToken) {
          await signInWithCustomToken(auth, data.customToken).catch((err) => {
            console.warn('Custom token bridge error:', err);
          });
        }

        return {
          success: true,
          mustChangePassword: Boolean(data.mustChangePassword),
        };
      }

      if (res.status === 429) {
        return {
          success: false,
          error: data.error || 'تم إيقاف المحاولات مؤقتًا لتكرار المحاولات غير الصحيحة',
          code: data.code || 'RATE_LIMITED',
          remainingSeconds: data.remainingSeconds || 900,
        };
      }

      return {
        success: false,
        error: data.error || 'تعذر تسجيل الدخول للمطعم',
        code: data.code || `HTTP_${res.status}`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `تعذر الاتصال بالخادم (${err?.message || 'Network Error'})`,
        code: 'NETWORK_ERROR',
      };
    }
  };

  const loginSuperAdmin = async (
    pass: string
  ): Promise<{ success: boolean; error?: string; code?: string; remainingSeconds?: number }> => {
    try {
      const cleanPass = normalizeArabicDigits(pass.trim());
      const res = await fetch('/api/super-admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({ password: cleanPass }),
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = {};
      if (contentType.includes('application/json')) {
        data = await res.json().catch(() => ({}));
      }

      if (res.ok && data.success) {
        setIsAuthenticated(true);
        setRole('super_admin');
        setRestaurantId(null);

        if (data.customToken) {
          await signInWithCustomToken(auth, data.customToken).catch((err) => {
            console.warn('Super Admin custom token bridge error:', err);
          });
        }

        return { success: true };
      }

      if (res.status === 429) {
        return {
          success: false,
          error: data.error || 'تم إيقاف المحاولات مؤقتًا لتكرار المحاولات غير الصحيحة',
          code: data.code || 'RATE_LIMITED',
          remainingSeconds: data.remainingSeconds || 900,
        };
      }

      return {
        success: false,
        error: data.error || 'كلمة مرور المدير العام غير صحيحة',
        code: data.code || `HTTP_${res.status}`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `تعذر الاتصال بالخادم (${err?.message || 'Network Error'})`,
        code: 'NETWORK_ERROR',
      };
    }
  };

  const login = async (pass: string, targetVenueId?: string): Promise<boolean> => {
    if (targetVenueId) {
      const res = await loginRestaurant(targetVenueId, pass);
      return res.success;
    }
    const res = await loginSuperAdmin(pass);
    return res.success;
  };

  const logout = async (): Promise<void> => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'include',
      });
    } catch {
      // Ignore
    }
    // Sign out of Firebase Client Auth
    await signOut(auth).catch(() => {});

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
        loginSuperAdmin,
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
