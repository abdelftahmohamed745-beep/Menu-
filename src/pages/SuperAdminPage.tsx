import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  LogOut,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Power,
  Store,
  Calendar,
  AlertCircle,
  Plus,
  ArrowRight,
  Database,
  Sparkles,
  Edit3,
  History,
  Link2,
  CheckCircle2,
  XCircle,
  Sliders,
} from 'lucide-react';
import { VenueSlugAlias } from '../types';

interface SuperAdminRestaurant {
  id: string; // Internal immutable ID
  name: string;
  slug: string; // Changeable public ID
  previousSlugs?: VenueSlugAlias[];
  currency: string;
  createdAt: string | null;
  hasLink: boolean;
  isLinkActive: boolean;
  linkCreatedAt: string | null;
  lastUsedAt: string | null;
}

interface SlugAuditLog {
  id?: string;
  venueId: string;
  venueName?: string;
  oldSlug: string;
  newSlug: string;
  changedBy: 'super_admin' | 'restaurant_owner';
  timestamp: string;
}

export const SuperAdminPage: React.FC = () => {
  const { role, refreshSession } = useAdminAuth();
  const navigate = useNavigate();

  // Authentication State
  const [password, setPassword] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');
  const [lockoutTimer, setLockoutTimer] = useState<number | null>(null);

  // Dashboard State
  const [restaurants, setRestaurants] = useState<SuperAdminRestaurant[]>([]);
  const [isLoadingList, setIsLoadingList] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [missingConfigs, setMissingConfigs] = useState<string[]>([]);

  // Magic Link Modals & Action State
  const [regenerateTarget, setRegenerateTarget] = useState<SuperAdminRestaurant | null>(null);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [copiedVenueId, setCopiedVenueId] = useState<string | null>(null);

  // New Restaurant Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newVenueName, setNewVenueName] = useState<string>('');
  const [isCreatingVenue, setIsCreatingVenue] = useState<boolean>(false);

  // Change Public ID State
  const [changeSlugTarget, setChangeSlugTarget] = useState<SuperAdminRestaurant | null>(null);
  const [newSlugInput, setNewSlugInput] = useState<string>('');
  const [isChangingSlug, setIsChangingSlug] = useState<boolean>(false);
  const [changeSlugError, setChangeSlugError] = useState<string | null>(null);
  const [isSlugConfirmOpen, setIsSlugConfirmOpen] = useState<boolean>(false);

  // Audit Logs Modal
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<SlugAuditLog[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState<boolean>(false);

  // Migration status
  const [migrationStatus, setMigrationStatus] = useState<string | null>(null);
  const [isMigrating, setIsMigrating] = useState<boolean>(false);

  // Add noindex meta tag dynamically
  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }
    meta.content = 'noindex, nofollow';

    return () => {
      if (meta && meta.parentNode) {
        meta.content = 'all';
      }
    };
  }, []);

  // Check server configuration variables
  const checkServerConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/super-admin/config-status');
      if (res.ok) {
        const data = await res.json();
        if (data.missingVariables && data.missingVariables.length > 0) {
          setMissingConfigs(data.missingVariables);
        } else {
          setMissingConfigs([]);
        }
      }
    } catch (err) {
      console.warn('Failed to check server config status:', err);
    }
  }, []);

  useEffect(() => {
    checkServerConfig();
  }, [checkServerConfig]);

  // Show Toast
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Fetch restaurants
  const fetchRestaurants = useCallback(async () => {
    try {
      setIsLoadingList(true);
      const res = await fetch('/api/super-admin/restaurants', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setRestaurants(data.restaurants || []);
      }
    } catch (err) {
      console.error('Failed to load restaurants for super admin:', err);
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (role === 'super_admin') {
      fetchRestaurants();
    }
  }, [role, fetchRestaurants]);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!password.trim()) {
      setLoginError('يرجى إدخال كلمة المرور');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/super-admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: password.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setPassword('');
        await refreshSession();
        fetchRestaurants();
        showToast('تم تسجيل الدخول بنجاح كمدير عام (Super Admin)');
      } else {
        setLoginError(data.error || 'بيانات الاعتماد غير صالحة');
        if (data.missingVariables) {
          setMissingConfigs(data.missingVariables);
        }
        if (data.retryAfter) {
          setLockoutTimer(data.retryAfter);
        }
      }
    } catch (err) {
      setLoginError('تعذر الاتصال بالخادم، يرجى التحقق من الشبكة');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await fetch('/api/super-admin/logout', {
        method: 'POST',
        credentials: 'include',
      });
      await refreshSession();
      setRestaurants([]);
      showToast('تم تسجيل الخروج بنجاح');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Generate or Copy Link
  const handleGenerateOrCopyLink = async (v: SuperAdminRestaurant) => {
    try {
      setActionLoadingId(v.id);
      const res = await fetch(`/api/super-admin/restaurants/${v.id}/link`, {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        if (data.fullUrl) {
          await navigator.clipboard.writeText(data.fullUrl);
          setCopiedVenueId(v.id);
          showToast(`تم نسخ الرابط السحري لمطعم «${v.name}»`);
          setTimeout(() => setCopiedVenueId(null), 2500);
        }
        await fetchRestaurants();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'تعذر توليد الرابط');
      }
    } catch (err) {
      console.error('Failed to generate link:', err);
      showToast('حدث خطأ أثناء توليد الرابط');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Regenerate Link (confirm executed)
  const handleRegenerateConfirm = async () => {
    if (!regenerateTarget) return;
    try {
      setIsRegenerating(true);
      const res = await fetch(`/api/super-admin/restaurants/${regenerateTarget.id}/regenerate-link`, {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        if (data.fullUrl) {
          await navigator.clipboard.writeText(data.fullUrl);
          showToast(`تم إعادة توليد ونسخ الرابط الجديد لمطعم «${regenerateTarget.name}»`);
        }
        setRegenerateTarget(null);
        await fetchRestaurants();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'تعذر إعادة توليد الرابط');
      }
    } catch (err) {
      console.error('Failed to regenerate link:', err);
      showToast('حدث خطأ أثناء إعادة التوليد');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Toggle Magic Link Active Status
  const handleToggleLink = async (v: SuperAdminRestaurant) => {
    try {
      setActionLoadingId(v.id);
      const res = await fetch(`/api/super-admin/restaurants/${v.id}/link/toggle`, {
        method: 'PATCH',
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        showToast(data.is_active ? 'تم تفعيل الرابط بنجاح' : 'تم تعطيل الرابط بنجاح');
        await fetchRestaurants();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'تعذر تغيير حالة الرابط');
      }
    } catch (err) {
      console.error('Failed to toggle link:', err);
      showToast('حدث خطأ في تغيير الحالة');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Toggle Alias Redirect Status
  const handleToggleAlias = async (v: SuperAdminRestaurant, aliasSlug: string) => {
    try {
      const actionKey = `alias_${v.id}_${aliasSlug}`;
      setActionLoadingId(actionKey);
      const res = await fetch(`/api/venues/${v.id}/aliases/${aliasSlug}/toggle`, {
        method: 'PATCH',
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        showToast(
          data.isActive
            ? `تم تفعيل تحويل الرابط القديم «${aliasSlug}» بنجاح`
            : `تم تعطيل تحويل الرابط القديم «${aliasSlug}» (لن يعمل بعد الآن)`
        );
        await fetchRestaurants();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'تعذر تعديل حالة تحويل الرابط');
      }
    } catch (err) {
      console.error('Failed to toggle alias:', err);
      showToast('حدث خطأ أثناء تعديل حالة الرابط القديم');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open Change Slug Modal
  const handleOpenChangeSlug = (v: SuperAdminRestaurant) => {
    setChangeSlugTarget(v);
    setNewSlugInput(v.slug || v.id);
    setChangeSlugError(null);
  };

  const handleProceedSlugConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newSlugInput.trim().toLowerCase();
    if (!clean) {
      setChangeSlugError('معرّف المطعم لا يمكن أن يكون فارغاً');
      return;
    }
    if (clean.length < 4 || clean.length > 32) {
      setChangeSlugError('معرّف المطعم يجب أن يتكون من 4 إلى 32 حرفاً أو رقماً');
      return;
    }
    if (!/^[a-z0-9][a-z0-9-]{2,30}[a-z0-9]$/.test(clean)) {
      setChangeSlugError('معرّف المطعم يجب أن يتكون من أحرف إنجليزية وأرقام وشرطة (-) فقط');
      return;
    }

    setChangeSlugError(null);
    setIsSlugConfirmOpen(true);
  };

  const handleConfirmChangeSlug = async () => {
    if (!changeSlugTarget) return;
    const clean = newSlugInput.trim().toLowerCase();
    try {
      setIsChangingSlug(true);
      const res = await fetch(`/api/venues/${changeSlugTarget.id}/change-slug`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ newSlug: clean }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        showToast(`تم تغيير معرّف المطعم بنجاح إلى «${clean}»`);
        setChangeSlugTarget(null);
        setIsSlugConfirmOpen(false);
        await fetchRestaurants();
      } else {
        setChangeSlugError(data.error || 'تعذر تغيير المعرّف');
        setIsSlugConfirmOpen(false);
      }
    } catch (err) {
      console.error('Error changing slug:', err);
      setChangeSlugError('حدث خطأ في الاتصال بالخادم');
      setIsSlugConfirmOpen(false);
    } finally {
      setIsChangingSlug(false);
    }
  };

  // Load Audit Logs
  const handleOpenAuditModal = async () => {
    try {
      setIsAuditModalOpen(true);
      setIsLoadingAudit(true);
      const res = await fetch('/api/super-admin/slug-audit-logs', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      showToast('تعذر تحميل سجل التغييرات');
    } finally {
      setIsLoadingAudit(false);
    }
  };

  // Enter Directly
  const handleEnterDirectly = (v: SuperAdminRestaurant) => {
    navigate(`/admin/${v.id}`);
  };

  // Create New Restaurant
  const handleCreateVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVenueName.trim()) return;

    try {
      setIsCreatingVenue(true);
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let randomSlug = 'rest-';
      for (let i = 0; i < 8; i++) {
        randomSlug += chars[Math.floor(Math.random() * chars.length)];
      }

      const { menuRepository } = await import('../repositories');
      const newVenue = await menuRepository.createVenue({
        name: newVenueName.trim(),
        slug: randomSlug,
        description: 'مرحباً بكم في قائمتنا الرقمية',
      });

      // Register initial slug in server registry
      await fetch(`/api/venues/${newVenue.id}/change-slug`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ newSlug: randomSlug }),
      }).catch(() => {});

      setNewVenueName('');
      setIsCreateModalOpen(false);
      showToast(`تم إنشاء مطعم «${newVenueName.trim()}» بنجاح`);
      await fetchRestaurants();
    } catch (err) {
      console.error('Failed to create venue:', err);
      showToast('تعذر إنشاء المطعم');
    } finally {
      setIsCreatingVenue(false);
    }
  };

  // Execute DB Migration for removing legacy access codes & registering slugs
  const handleRunMigration = async () => {
    try {
      setIsMigrating(true);
      setMigrationStatus('جاري فحص وتنظيف قاعدة البيانات وتسجيل المعرّفات...');
      const res = await fetch('/api/migrations/remove-access-codes', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setMigrationStatus(
          `اكتمل الترحيل: تم فحص ${data.scannedVenues} مطعم وتطهير ${data.cleanedVenues} حقل كود قديم وتسجيل المعرّفات.`
        );
        showToast('تم ترحيل وتطهير قاعدة البيانات بنجاح');
        await fetchRestaurants();
      } else {
        setMigrationStatus('فشل تنفيذ الترحيل، يرجى المحاولة لاحقاً');
      }
    } catch (err) {
      setMigrationStatus('خطأ أثناء تشغيل ترحيل قاعدة البيانات');
    } finally {
      setIsMigrating(false);
    }
  };

  const filteredRestaurants = restaurants.filter(
    (r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // -------------------------------------------------------------------------
  // VIEW 1: Super Admin Login Screen
  // -------------------------------------------------------------------------
  if (role !== 'super_admin') {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4 selection:bg-amber-500/20" dir="rtl">
        {/* Toast */}
        {toastMessage && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 border border-neutral-700 text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-2xl animate-in fade-in slide-in-from-top-2">
            {toastMessage}
          </div>
        )}

        <div className="max-w-md w-full bg-neutral-900 rounded-3xl p-8 border border-neutral-800 shadow-2xl space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert className="w-8 h-8 stroke-1.5" />
          </div>

          <div className="text-center space-y-1.5">
            <h1 className="text-2xl font-black text-white tracking-tight">
              بوابة الإدارة العامة للمنصة
            </h1>
            <p className="text-xs text-neutral-400">
              Super Admin Portal — الدخول مخصص فقط لإدارة المنصة
            </p>
          </div>

          {/* Missing Server Config Alert */}
          {missingConfigs.map((varName) => (
            <div
              key={varName}
              className="p-3.5 bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs rounded-xl flex items-start gap-2.5 text-right font-medium animate-in fade-in"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
              <div>
                <p className="font-bold text-rose-300">
                  إعداد الخادم ناقص: <span className="font-mono text-white underline">{varName}</span>
                </p>
                <p className="text-[11px] text-rose-200/80 mt-1 leading-relaxed">
                  يرجى إضافة هذا المتغير في إعدادات البيئة (Environment Variables) في Vercel أو الأداة ثم إعادة تشغيل الخادم.
                </p>
              </div>
            </div>
          ))}

          {loginError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl flex items-center gap-2 text-right">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          {lockoutTimer && lockoutTimer > 0 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs rounded-xl flex items-center gap-2 text-right font-mono">
              <Lock className="w-4 h-4 flex-shrink-0" />
              <span>تم إيقاف المحاولات مؤقتًا. يرجى الانتظار {lockoutTimer} ثانية.</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1.5 text-right">
                كلمة مرور الإدارة العامة (Super Admin Password)
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting || Boolean(lockoutTimer && lockoutTimer > 0)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 text-left font-mono tracking-widest placeholder:tracking-normal placeholder-neutral-500 disabled:opacity-50"
                  dir="ltr"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || Boolean(lockoutTimer && lockoutTimer > 0)}
              className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-amber-600/20"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري التحقق...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>تسجيل الدخول للإدارة العامة</span>
                </>
              )}
            </button>
          </form>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-xs text-neutral-500 hover:text-neutral-400 transition-colors cursor-pointer inline-flex items-center gap-1"
            >
              <span>العودة إلى الصفحة الرئيسية</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // VIEW 2: Super Admin Dashboard Screen
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 selection:bg-amber-500/20 pb-16" dir="rtl">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 border border-neutral-700 text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-2xl animate-in fade-in slide-in-from-top-2">
          {toastMessage}
        </div>
      )}

      {/* Top Navbar */}
      <header className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black text-white">لوحة تحكم الإدارة العامة</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Super Admin
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">إدارة المطاعم، المعرّفات القابلة للتغيير والروابط السحرية</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Run Migration Button */}
            <button
              type="button"
              onClick={handleRunMigration}
              disabled={isMigrating}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-neutral-700 flex items-center gap-1.5"
              title="تطهير قاعدة البيانات من أي حقول أكواد قديمة وتسجيل المعرّفات"
            >
              <Database className={`w-3.5 h-3.5 text-amber-400 ${isMigrating ? 'animate-spin' : ''}`} />
              <span>{isMigrating ? 'جاري التطهير...' : 'تطهير قاعدة البيانات'}</span>
            </button>

            {/* View Audit Logs Button */}
            <button
              type="button"
              onClick={handleOpenAuditModal}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-neutral-700 flex items-center gap-1.5"
              title="سجل التغييرات لجميع معرّفات المطاعم"
            >
              <History className="w-3.5 h-3.5 text-sky-400" />
              <span>سجل التغييرات</span>
            </button>

            {/* Logout Button */}
            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-rose-500/20 flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>تسجيل خروج</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 space-y-6">
        {/* Migration Alert Banner */}
        {migrationStatus && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs rounded-2xl flex items-center justify-between">
            <span>{migrationStatus}</span>
            <button
              type="button"
              onClick={() => setMigrationStatus(null)}
              className="text-neutral-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}

        {/* Filter / Search / Create Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-neutral-900 p-4 rounded-2xl border border-neutral-800">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث عن مطعم بالاسم أو المعرّف العام (Slug) أو الداخلي..."
            className="w-full sm:w-96 px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          />

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={fetchRestaurants}
              disabled={isLoadingList}
              className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl border border-neutral-700 cursor-pointer"
              title="تحديث القائمة"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingList ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء مطعم جديد</span>
            </button>
          </div>
        </div>

        {/* Restaurants Table */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-neutral-800/80 text-neutral-400 border-b border-neutral-800 font-bold">
                <tr>
                  <th className="py-3.5 px-4">المطعم</th>
                  <th className="py-3.5 px-4">معرّف المطعم (Public Slug) والتحويلات</th>
                  <th className="py-3.5 px-4">حالة الرابط السحري</th>
                  <th className="py-3.5 px-4">آخر استخدام للرابط</th>
                  <th className="py-3.5 px-4">تاريخ الإنشاء</th>
                  <th className="py-3.5 px-4 text-center">إجراءات التحكم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {filteredRestaurants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-neutral-500">
                      {isLoadingList ? 'جاري تحميل قائمة المطاعم...' : 'لا يوجد مطاعم مطابقة للبحث.'}
                    </td>
                  </tr>
                ) : (
                  filteredRestaurants.map((v) => {
                    const isCopied = copiedVenueId === v.id;
                    const isLoadingThis = actionLoadingId === v.id;

                    return (
                      <tr key={v.id} className="hover:bg-neutral-800/30 transition-colors">
                        {/* Name & Internal ID */}
                        <td className="py-3.5 px-4 font-bold text-white">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              <span className="text-sm">{v.name}</span>
                            </div>
                            <div className="text-[10px] font-mono text-neutral-500" dir="ltr">
                              ID الداخلي: {v.id}
                            </div>
                          </div>
                        </td>

                        {/* Public ID (Slug) & Aliases */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1.5">
                            {/* Current Public Slug */}
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-xs" dir="ltr">
                                /{v.slug}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleOpenChangeSlug(v)}
                                className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-amber-400 rounded transition-colors cursor-pointer"
                                title="تغيير معرّف المطعم العام"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Previous Redirect Aliases */}
                            {v.previousSlugs && v.previousSlugs.length > 0 && (
                              <div className="space-y-1 pt-1 border-t border-neutral-800/60">
                                <span className="text-[10px] text-neutral-400 block font-semibold">تحويلات الـ QR القديمة:</span>
                                {v.previousSlugs.map((alias) => {
                                  const actionKey = `alias_${v.id}_${alias.slug}`;
                                  const isActionLoading = actionLoadingId === actionKey;

                                  return (
                                    <div
                                      key={alias.slug}
                                      className="flex items-center justify-between gap-2 p-1 rounded bg-neutral-950/60 border border-neutral-800 text-[11px]"
                                    >
                                      <div className="flex items-center gap-1.5 font-mono text-neutral-300" dir="ltr">
                                        <Link2 className="w-3 h-3 text-neutral-500" />
                                        <span>/{alias.slug}</span>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => handleToggleAlias(v, alias.slug)}
                                        disabled={isActionLoading}
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                                          alias.isActive
                                            ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30'
                                            : 'bg-neutral-800 text-neutral-500 hover:bg-neutral-700 border border-neutral-700'
                                        }`}
                                        title={alias.isActive ? 'انقر لتعطيل التحويل القديم' : 'انقر لتفعيل التحويل القديم'}
                                      >
                                        {alias.isActive ? (
                                          <>
                                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                                            <span>نشط (يحوّل)</span>
                                          </>
                                        ) : (
                                          <>
                                            <XCircle className="w-2.5 h-2.5 text-neutral-500" />
                                            <span>معطل</span>
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Magic Link Status */}
                        <td className="py-3.5 px-4">
                          {!v.hasLink ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700">
                              لم يُولَّد بعد
                            </span>
                          ) : v.isLinkActive ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              نشط وصالح
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              معطل
                            </span>
                          )}
                        </td>

                        {/* Last Used */}
                        <td className="py-3.5 px-4 text-neutral-400 text-[11px]">
                          {v.lastUsedAt ? new Date(v.lastUsedAt).toLocaleString('ar-SA') : 'لم يستخدم بعد'}
                        </td>

                        {/* Created At */}
                        <td className="py-3.5 px-4 text-neutral-400 text-[11px]">
                          {v.createdAt ? new Date(v.createdAt).toLocaleDateString('ar-SA') : '—'}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-center gap-2">
                            {/* 1. Enter Directly as Super Admin */}
                            <button
                              type="button"
                              onClick={() => handleEnterDirectly(v)}
                              className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 border border-neutral-700"
                              title="دخول مباشر كمدير عام"
                            >
                              <ExternalLink className="w-3 h-3 text-amber-400" />
                              <span>دخول مباشر</span>
                            </button>

                            {/* 2. Generate / Copy Login Link */}
                            <button
                              type="button"
                              onClick={() => handleGenerateOrCopyLink(v)}
                              disabled={isLoadingThis}
                              className="px-2.5 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                              title="توليد أو نسخ رابط الدخول السحري"
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span>تم النسخ!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>نسخ الرابط</span>
                                </>
                              )}
                            </button>

                            {/* 3. Regenerate Link */}
                            <button
                              type="button"
                              onClick={() => setRegenerateTarget(v)}
                              className="p-1.5 text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                              title="إعادة توليد الرابط (إلغاء القديم فوراً)"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>

                            {/* 4. Disable / Enable Link */}
                            {v.hasLink && (
                              <button
                                type="button"
                                onClick={() => handleToggleLink(v)}
                                disabled={isLoadingThis}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  v.isLinkActive
                                    ? 'text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10'
                                    : 'text-neutral-400 hover:text-emerald-400 hover:bg-emerald-500/10'
                                }`}
                                title={v.isLinkActive ? 'تعطيل الرابط' : 'تفعيل الرابط'}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Confirmation Dialog: Regenerate Magic Link */}
      <ConfirmDialog
        isOpen={Boolean(regenerateTarget)}
        onClose={() => setRegenerateTarget(null)}
        onConfirm={handleRegenerateConfirm}
        title="إعادة توليد الرابط السحري؟"
        message={`هل أنت متأكد من إعادة توليد الرابط لمطعم «${regenerateTarget?.name}»؟ سيتم إلغاء صلاحية الرابط القديم فوراً ولن يتمكن صاحب المطعم من الدخول عبره مجدداً حتى ترسل له الرابط الجديد.`}
        confirmLabel={isRegenerating ? 'جاري التوليد...' : 'نعم، إعادة التوليد وإلغاء القديم'}
        isDestructive={true}
      />

      {/* Confirmation Dialog: Change Restaurant Public ID */}
      <ConfirmDialog
        isOpen={isSlugConfirmOpen}
        onClose={() => setIsSlugConfirmOpen(false)}
        onConfirm={handleConfirmChangeSlug}
        title="تأكيد تغيير معرّف المطعم (Public ID)"
        message={`هل أنت متأكد من تغيير معرّف مطعم «${changeSlugTarget?.name}» من «${changeSlugTarget?.slug}» إلى «${newSlugInput.trim().toLowerCase()}»؟
- سيصبح رابط المنيو الجديد: (${window.location.origin}/menu/${newSlugInput.trim().toLowerCase()})
- ستظل رموز الـ QR القديمة تعمل تلقائياً وتحوّل الزبائن إلى الرابط الجديد طالما أن خيار التحويل (Alias) مفعل في النظام.
هل تريد المتابعة وحفظ التغيير؟`}
        confirmLabel={isChangingSlug ? 'جاري الحفظ...' : 'تأكيد وحفظ المعرّف الجديد'}
        isDestructive={false}
      />

      {/* Modal: Change Public ID */}
      {changeSlugTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setChangeSlugTarget(null)}
        >
          <div
            className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-500" />
                <span>تغيير معرّف المطعم العام</span>
              </h2>
              <button
                type="button"
                onClick={() => setChangeSlugTarget(null)}
                className="text-neutral-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-neutral-400 space-y-1">
              <p>
                المطعم: <strong className="text-white">{changeSlugTarget.name}</strong>
              </p>
              <p>
                المعرّف الحالي: <span className="font-mono text-amber-400">/{changeSlugTarget.slug}</span>
              </p>
            </div>

            {changeSlugError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{changeSlugError}</span>
              </div>
            )}

            <form onSubmit={handleProceedSlugConfirm} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                  المعرّف الجديد (Public ID / Slug)
                </label>
                <div className="flex items-center bg-neutral-800 border border-neutral-700 rounded-xl overflow-hidden focus-within:border-amber-500" dir="ltr">
                  <span className="px-3 text-neutral-500 font-mono text-xs select-none">/menu/</span>
                  <input
                    type="text"
                    required
                    value={newSlugInput}
                    onChange={(e) => setNewSlugInput(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                    placeholder="new-restaurant-slug"
                    className="w-full px-2 py-2.5 bg-transparent text-white font-mono text-xs outline-none"
                  />
                </div>
                <p className="text-[11px] text-neutral-500 mt-1.5 leading-relaxed">
                  الشروط: من 4 إلى 32 حرفاً أو رقماً إنجليزياً وشرطة (-) فقط، بدون مسافات، ولا يتطابق مع الكلمات المحجوزة.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setChangeSlugTarget(null)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold rounded-xl text-xs cursor-pointer flex items-center gap-1.5"
                >
                  <span>متابعة للحفظ</span>
                  <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Audit Logs */}
      {isAuditModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsAuditModalOpen(false)}
        >
          <div
            className="max-w-2xl w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-sky-400" />
                <span>سجل تغييرات معرّفات المطاعم (Audit Log)</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsAuditModalOpen(false)}
                className="text-neutral-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-2.5 pr-1">
              {isLoadingAudit ? (
                <div className="py-12 text-center text-neutral-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-neutral-400" />
                  <p>جاري تحميل سجل التغييرات...</p>
                </div>
              ) : auditLogs.length === 0 ? (
                <p className="text-center py-12 text-neutral-500 text-xs">
                  لا توجد أي تغييرات مسجلة حتى الآن.
                </p>
              ) : (
                auditLogs.map((log, idx) => (
                  <div
                    key={log.id || idx}
                    className="p-3.5 bg-neutral-950/80 border border-neutral-800 rounded-2xl flex items-center justify-between text-xs gap-3"
                  >
                    <div className="space-y-1">
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>{log.venueName || 'مطعم'}</span>
                        <span className="text-[10px] text-neutral-500 font-mono" dir="ltr">({log.venueId})</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[11px]" dir="ltr">
                        <span className="text-rose-400 line-through">/{log.oldSlug}</span>
                        <span className="text-neutral-500">→</span>
                        <span className="text-emerald-400 font-bold">/{log.newSlug}</span>
                      </div>
                    </div>

                    <div className="text-left space-y-0.5 text-[11px] text-neutral-400">
                      <div className="font-bold text-neutral-300">
                        {log.changedBy === 'super_admin' ? 'مدير عام (Super Admin)' : 'صاحب المطعم (Owner)'}
                      </div>
                      <div>{new Date(log.timestamp).toLocaleString('ar-SA')}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Restaurant */}
      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsCreateModalOpen(false)}
        >
          <div
            className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Store className="w-4 h-4 text-amber-500" />
                <span>إنشاء مطعم جديد</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-neutral-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateVenue} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                  اسم المطعم أو الكافيه *
                </label>
                <input
                  type="text"
                  required
                  value={newVenueName}
                  onChange={(e) => setNewVenueName(e.target.value)}
                  placeholder="مثال: بيتزا روما"
                  className="w-full px-3.5 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-xs outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isCreatingVenue}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold rounded-xl text-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isCreatingVenue ? 'جاري الإنشاء...' : 'إنشاء المطعم'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
