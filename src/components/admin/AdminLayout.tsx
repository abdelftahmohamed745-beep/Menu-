import React, { useState } from 'react';
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom';
import { useMenu } from '../../context/MenuContext';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { ConfirmDialog } from '../common/ConfirmDialog';
import {
  LayoutDashboard,
  Layers,
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
  ChevronDown,
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '/admin', label: 'نظرة عامة', icon: LayoutDashboard, end: true },
  { path: '/admin/workspaces', label: 'المساحات والمنشآت', icon: Layers },
  { path: '/admin/venue', label: 'بيانات المكان', icon: Store },
  { path: '/admin/categories', label: 'الأقسام', icon: FolderTree },
  { path: '/admin/products', label: 'المنتجات', icon: UtensilsCrossed },
  { path: '/admin/filters', label: 'الفلاتر الديناميكية', icon: SlidersHorizontal },
  { path: '/admin/qr', label: 'رمز QR والطباعة', icon: QrCode },
];

export const AdminLayout: React.FC = () => {
  const { venue, allVenues, switchVenue, resetToInitialData } = useMenu();
  const { isAuthenticated, login, logout } = useAdminAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const location = useLocation();

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

  const menuUrl = venue?.slug ? `/menu/${venue.slug}` : '/menu/my-restaurant';

  // If not authenticated, render Admin Lock Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4 selection:bg-amber-500/20" dir="rtl">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl border border-neutral-200 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-black text-neutral-900 text-center mb-1">
            لوحة تحكم الإدارة
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
              العودة إلى واجهة القائمة العامة
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col" dir="rtl">
      {/* 1. Top Database Sync Status Bar */}
      <div className="bg-neutral-900 text-neutral-200 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 z-30">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 font-semibold">لوحة تحكم المشرف (نشطة)</span>
          <span className="text-neutral-400 hidden sm:inline">• كافة التعديلات تُحفظ وتُزامن سحابياً وفورياً</span>
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

      {/* 2. Main Admin Shell */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex md:w-64 flex-col bg-white border-e border-neutral-200 shadow-2xs">
          {/* Workspace Selector / Brand */}
          <div className="p-4 border-b border-neutral-100">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                المساحة الحالية
              </span>
              {allVenues.length > 1 && (
                <Link
                  to="/admin/workspaces"
                  className="text-[10px] text-neutral-400 hover:text-neutral-700 font-medium"
                >
                  تبديل ({allVenues.length})
                </Link>
              )}
            </div>

            {allVenues.length > 1 ? (
              <div className="relative">
                <select
                  value={venue?.id || ''}
                  onChange={(e) => switchVenue(e.target.value)}
                  className="w-full text-xs font-bold text-neutral-900 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl py-2 px-2.5 appearance-none focus:outline-none focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
                >
                  {allVenues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ) : (
              <h1 className="text-sm font-extrabold text-neutral-900 truncate">
                {venue?.name || 'إدارة المنيو'}
              </h1>
            )}
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
            <span className="text-sm font-bold text-neutral-900">{venue?.name}</span>
          </div>

          <Link
            to={menuUrl}
            target="_blank"
            rel="noreferrer"
            className="p-2 text-amber-700 hover:bg-amber-50 rounded-lg flex items-center gap-1 text-xs font-bold"
          >
            <span>المنيو</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Mobile Drawer Menu */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              className="w-72 bg-white h-full p-5 flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-4 border-b border-neutral-100 mb-4">
                <div>
                  <span className="text-xs text-amber-700 font-bold block">إدارة المنيو</span>
                  <h2 className="text-base font-extrabold text-neutral-900">{venue?.name}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg"
                  aria-label="إغلاق القائمة"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 space-y-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.path === location.pathname ||
                    (!item.end && location.pathname.startsWith(item.path));

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                        isActive
                          ? 'bg-neutral-900 text-white'
                          : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="pt-4 border-t border-neutral-100 space-y-2">
                <Link
                  to={menuUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold"
                >
                  <span>معاينة المنيو للزائر</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  className="flex items-center justify-center gap-2 w-full py-2 px-3 text-neutral-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>تسجيل خروج من الإدارة</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>

      {/* Confirmation modal for reset */}
      <ConfirmDialog
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={handleReset}
        title="إعادة تعيين القائمة؟"
        message="سيؤدي هذا الإجراء إلى حذف كافة الأصناف والأقسام وإعادة تعيين القائمة إلى الحالة النظيفة الأولية."
        confirmLabel="نعم، إعادة التعيين"
        isDestructive={true}
      />
    </div>
  );
};
