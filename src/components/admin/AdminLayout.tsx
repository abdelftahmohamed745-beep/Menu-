import React, { useState, useEffect } from 'react';
import { NavLink, Link, Outlet, useParams } from 'react-router-dom';
import { useMenu } from '../../context/MenuContext';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { ConfirmDialog } from '../common/ConfirmDialog';
import {
  LayoutDashboard,
  Store,
  FolderTree,
  UtensilsCrossed,
  SlidersHorizontal,
  QrCode,
  ExternalLink,
  Menu as MenuIcon,
  X,
  RotateCcw,
  Lock,
  LogOut,
  ArrowLeft,
  AlertCircle,
  Home,
} from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const { restaurantId } = useParams<{ restaurantId?: string }>();
  const { venue, isLoading, loadRestaurant, resetToInitialData } = useMenu();
  const { isAuthenticated, login, logout } = useAdminAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState<boolean>(false);

  // Load the specific restaurant based strictly on route param
  useEffect(() => {
    if (restaurantId) {
      setHasAttemptedLoad(false);
      loadRestaurant(restaurantId).then(() => {
        setHasAttemptedLoad(true);
      });
    } else {
      setHasAttemptedLoad(true);
    }
  }, [restaurantId, loadRestaurant]);

  const handleReset = async () => {
    try {
      await resetToInitialData();
      setIsResetConfirmOpen(false);
    } catch (err) {
      console.error('Failed to reset:', err);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    const success = login(pinInput);
    if (!success) {
      setPinError('رمز المرور غير صحيح');
    }
  };

  // 1. Loading state
  if (isLoading || (!hasAttemptedLoad && restaurantId)) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4" dir="rtl">
        <div className="text-white text-sm font-medium flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span>جاري تحميل لوحة التحكم...</span>
        </div>
      </div>
    );
  }

  // 2. Restaurant Not Found in Admin Context
  if (!restaurantId || (!venue && hasAttemptedLoad)) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-6" dir="rtl">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 border border-neutral-200 shadow-2xl text-center animate-in fade-in zoom-in-95 duration-150">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-5 border border-rose-100">
            <AlertCircle className="w-8 h-8 stroke-1.5" />
          </div>

          <h1 className="text-2xl font-extrabold text-neutral-900 mb-2">
            المطعم غير موجود
          </h1>

          <p className="text-neutral-600 text-xs mb-6 leading-relaxed">
            لم يتم العثور على مطعم مرتبط بالمعرف المحدد{' '}
            {restaurantId && (
              <code className="bg-neutral-100 text-rose-700 font-bold px-2 py-0.5 rounded font-mono text-xs" dir="ltr">
                {restaurantId}
              </code>
            )}
            . يرجى التأكد من صحة الرابط أو كود المطعم.
          </p>

          <Link
            to="/"
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-semibold text-xs transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>العودة إلى الصفحة الرئيسية</span>
          </Link>
        </div>
      </div>
    );
  }

  const baseAdminPath = `/admin/${venue.id}`;
  const menuUrl = `/menu/${venue.id}`;

  const NAV_ITEMS = [
    { path: `${baseAdminPath}`, label: 'نظرة عامة', icon: LayoutDashboard, end: true },
    { path: `${baseAdminPath}/venue`, label: 'بيانات المكان', icon: Store },
    { path: `${baseAdminPath}/categories`, label: 'الأقسام', icon: FolderTree },
    { path: `${baseAdminPath}/products`, label: 'المنتجات', icon: UtensilsCrossed },
    { path: `${baseAdminPath}/filters`, label: 'الفلاتر الديناميكية', icon: SlidersHorizontal },
    { path: `${baseAdminPath}/qr`, label: 'رمز QR والطباعة', icon: QrCode },
  ];

  // 3. Admin Lock Screen if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4 selection:bg-amber-500/20" dir="rtl">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl border border-neutral-200 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-black text-neutral-900 text-center mb-1">
            لوحة إدارة {venue.name}
          </h1>
          <p className="text-xs text-neutral-500 text-center mb-6">
            منطقة المشرف محمية برمز مرور خاص. أدخل الرمز للمتابعة.
          </p>

          {pinError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl mb-4 text-center font-medium">
              {pinError}
            </div>
          )}

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5 text-right">
                رمز مرور المشرف
              </label>
              <input
                type="password"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="أدخل رمز المرور..."
                autoFocus
                className="w-full text-center tracking-widest text-lg font-mono py-3 px-4 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-bold text-sm transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <span>تأكيد الدخول</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-neutral-100 text-center">
            <Link
              to={menuUrl}
              className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors"
            >
              العودة إلى منيو {venue.name}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 4. Authenticated Admin Dashboard for this specific restaurant
  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col" dir="rtl">
      {/* Top Database Sync Status Bar */}
      <div className="bg-neutral-900 text-neutral-200 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 z-30">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 font-semibold">إدارة: {venue.name}</span>
          <span className="text-neutral-400 text-[11px] font-mono" dir="ltr">({venue.id})</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsResetConfirmOpen(true)}
            className="inline-flex items-center gap-1 text-neutral-400 hover:text-rose-300 transition-colors cursor-pointer text-xs"
          >
            <RotateCcw className="w-3 h-3" />
            <span>إعادة تعيين القائمة</span>
          </button>
          <span className="text-neutral-700">|</span>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1 text-neutral-400 hover:text-white transition-colors cursor-pointer text-xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>تسجيل خروج</span>
          </button>
        </div>
      </div>

      {/* Main Admin Shell */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex md:w-64 flex-col bg-white border-e border-neutral-200 shadow-2xs">
          {/* Restaurant Brand Header */}
          <div className="p-4 border-b border-neutral-100">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block mb-1">
              المطعم النشط
            </span>
            <h1 className="text-sm font-extrabold text-neutral-900 truncate">
              {venue.name}
            </h1>
            <span className="text-[11px] text-neutral-400 font-mono block mt-0.5" dir="ltr">
              ID: {venue.id}
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      isActive
                        ? 'bg-neutral-900 text-white shadow-xs'
                        : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Bottom Menu Preview Shortcut & Logout */}
          <div className="p-4 border-t border-neutral-100 bg-neutral-50 space-y-2">
            <Link
              to={menuUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-xs"
            >
              <span>معاينة المنيو للزائر</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>

            <button
              type="button"
              onClick={logout}
              className="flex items-center justify-center gap-2 w-full py-2 px-3 text-neutral-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>تسجيل خروج من الإدارة</span>
            </button>
          </div>
        </aside>

        {/* Mobile Header */}
        <div className="md:hidden bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 text-neutral-700 hover:bg-neutral-100 rounded-lg"
            aria-label="فتح القائمة"
          >
            <MenuIcon className="w-6 h-6" />
          </button>

          <div className="text-center">
            <span className="text-xs text-neutral-400 block font-medium">لوحة التحكم</span>
            <span className="text-sm font-bold text-neutral-900">{venue.name}</span>
          </div>

          <Link
            to={menuUrl}
            target="_blank"
            rel="noreferrer"
            className="p-2 text-amber-700 hover:bg-amber-50 rounded-lg flex items-center gap-1 text-xs font-bold"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              className="w-72 bg-white h-full flex flex-col p-4 shadow-xl animate-in slide-in-from-right duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                <div>
                  <h2 className="text-base font-extrabold text-neutral-900">
                    {venue.name}
                  </h2>
                  <span className="text-[10px] text-neutral-400 font-mono" dir="ltr">
                    ID: {venue.id}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 text-neutral-400 hover:text-neutral-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.end}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                          isActive
                            ? 'bg-neutral-900 text-white shadow-xs'
                            : 'text-neutral-600 hover:bg-neutral-100'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>

              <div className="pt-3 border-t border-neutral-100 space-y-2">
                <Link
                  to={menuUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold shadow-xs"
                >
                  <span>معاينة المنيو للزائر</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>

                <button
                  type="button"
                  onClick={logout}
                  className="flex items-center justify-center gap-2 w-full py-2 px-3 text-neutral-500 hover:text-rose-600 rounded-xl text-xs font-semibold"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>تسجيل خروج</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Admin Page Outlet */}
        <main className="flex-1 p-4 md:p-8 max-w-6xl overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Confirmation Dialog for Reset */}
      <ConfirmDialog
        isOpen={isResetConfirmOpen}
        title="تأكيد إعادة تعيين قائمة هذا المطعم"
        message={`هل أنت متأكد من رغبتك في حذف جميع أقسام ومنتجات وفلاتر "${venue.name}" والبدء بقائمة فارغة؟ هذا الإجراء يخص هذا المطعم فقط ولا يؤثر على أي مطعم آخر.`}
        confirmLabel="نعم، إعادة التعيين"
        cancelLabel="إلغاء"
        isDangerous={true}
        onConfirm={handleReset}
        onCancel={() => setIsResetConfirmOpen(false)}
      />
    </div>
  );
};
