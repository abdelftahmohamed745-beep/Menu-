import React from 'react';
import { Link } from 'react-router-dom';
import { useMenu } from '../context/MenuContext';
import {
  FolderTree,
  UtensilsCrossed,
  Eye,
  EyeOff,
  SlidersHorizontal,
  Plus,
  Store,
  QrCode,
  ExternalLink,
  ChevronLeft,
} from 'lucide-react';

export const AdminOverviewPage: React.FC = () => {
  const { venue, stats, categories, products, toggleProductVisibility } = useMenu();

  const menuUrl = venue?.slug ? `/menu/${venue.slug}` : '/menu/my-restaurant';

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-neutral-900 tracking-tight">
            نظرة عامة على المنيو
          </h2>
          <p className="text-sm text-neutral-500 mt-1">
            إحصاءات حقيقية ومحدثة مباشرة من قاعدة البيانات السحابية للمنشأة.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to={menuUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-sm font-semibold transition-colors shadow-xs"
          >
            <span>معاينة صفحة العميل</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* 1. Real Computed Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-semibold text-neutral-600">الأقسام</span>
            <FolderTree className="w-4 h-4 text-amber-700" />
          </div>
          <div className="text-2xl font-black text-neutral-900">
            {stats?.categoriesCount || 0}
          </div>
          <span className="text-[11px] text-neutral-600">أقسام رئيسية</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-semibold text-neutral-600">إجمالي الأصناف</span>
            <UtensilsCrossed className="w-4 h-4 text-indigo-700" />
          </div>
          <div className="text-2xl font-black text-neutral-900">
            {stats?.totalProductsCount || 0}
          </div>
          <span className="text-[11px] text-neutral-600">منتجات مضافة</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-semibold text-neutral-600">المنتجات الظاهرة</span>
            <Eye className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-2xl font-black text-emerald-800">
            {stats?.visibleProductsCount || 0}
          </div>
          <span className="text-[11px] text-neutral-600">تظهر للزبائن</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-2xs">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-semibold text-neutral-600">المنتجات المخفية</span>
            <EyeOff className="w-4 h-4 text-rose-700" />
          </div>
          <div className="text-2xl font-black text-rose-800">
            {stats?.hiddenProductsCount || 0}
          </div>
          <span className="text-[11px] text-neutral-600">معطلة مؤقتًا</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-2xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-semibold text-neutral-600">الفلاتر النشطة</span>
            <SlidersHorizontal className="w-4 h-4 text-purple-700" />
          </div>
          <div className="text-2xl font-black text-neutral-900">
            {stats?.filtersCount || 0}
          </div>
          <span className="text-[11px] text-neutral-600">علامات تصنيف</span>
        </div>
      </div>

      {/* 2. Quick Action Shortcuts */}
      <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-2xs">
        <h3 className="text-sm font-bold text-neutral-900 mb-3.5">إجراءات سريعة</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            to={venue ? `/admin/${venue.id}/products?action=new` : '#'}
            className="flex items-center gap-3 p-3 rounded-xl border border-neutral-200 hover:border-amber-300 hover:bg-amber-50/50 transition-colors text-right"
          >
            <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-neutral-800 block">إضافة منتج</span>
              <span className="text-[11px] text-neutral-600">صنف جديد في المنيو</span>
            </div>
          </Link>

          <Link
            to={venue ? `/admin/${venue.id}/categories?action=new` : '#'}
            className="flex items-center gap-3 p-3 rounded-xl border border-neutral-200 hover:border-amber-300 hover:bg-amber-50/50 transition-colors text-right"
          >
            <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0">
              <FolderTree className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-neutral-800 block">إضافة قسم</span>
              <span className="text-[11px] text-neutral-600">تصنيف طعام أو شراب</span>
            </div>
          </Link>

          <Link
            to={venue ? `/admin/${venue.id}/venue` : '#'}
            className="flex items-center gap-3 p-3 rounded-xl border border-neutral-200 hover:border-amber-300 hover:bg-amber-50/50 transition-colors text-right"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-neutral-800 block">بيانات المكان</span>
              <span className="text-[11px] text-neutral-600">الهوية، العملة، الرابط</span>
            </div>
          </Link>

          <Link
            to={venue ? `/admin/${venue.id}/qr` : '#'}
            className="flex items-center gap-3 p-3 rounded-xl border border-neutral-200 hover:border-amber-300 hover:bg-amber-50/50 transition-colors text-right"
          >
            <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-neutral-800 block">رمز QR والطباعة</span>
              <span className="text-[11px] text-neutral-600">تنزيل وطباعة الستاند</span>
            </div>
          </Link>
        </div>
      </div>

      {/* 3. Categories Overview & Products quick toggle */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Categories list card */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-neutral-900">الأقسام وترتيبها</h3>
              <Link
                to={venue ? `/admin/${venue.id}/categories` : '#'}
                className="text-xs text-amber-700 hover:text-amber-800 font-semibold flex items-center gap-1"
              >
                <span>إدارة الأقسام</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-neutral-100">
              {categories.map((cat, idx) => {
                const count = products.filter((p) => p.categoryId === cat.id).length;
                return (
                  <div key={cat.id} className="py-2.5 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-neutral-100 text-neutral-500 text-xs flex items-center justify-center font-mono">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-neutral-800">{cat.name}</span>
                    </div>
                    <span className="text-xs text-neutral-600 font-medium">
                      {count} أصناف
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Quick Products Overview */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-neutral-900">آخر المنتجات وحالة الظهور</h3>
              <Link
                to={venue ? `/admin/${venue.id}/products` : '#'}
                className="text-xs text-amber-700 hover:text-amber-800 font-semibold flex items-center gap-1"
              >
                <span>كل المنتجات ({products.length})</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-neutral-100">
              {products.slice(0, 5).map((prod) => (
                <div key={prod.id} className="py-2.5 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        prod.isVisible ? 'bg-emerald-500' : 'bg-neutral-300'
                      }`}
                    />
                    <span className="font-semibold text-neutral-800 truncate">
                      {prod.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-neutral-900">
                      {prod.price} {venue?.currencySymbol || venue?.currency}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleProductVisibility(prod.id)}
                      className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                        prod.isVisible
                          ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                          : 'text-neutral-500 bg-neutral-100 hover:bg-neutral-200'
                      }`}
                      title={prod.isVisible ? 'إخفاء المنتج' : 'إظهار المنتج'}
                    >
                      {prod.isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
