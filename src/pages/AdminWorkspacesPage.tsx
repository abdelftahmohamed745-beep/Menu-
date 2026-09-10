import React, { useState } from 'react';
import { useMenu } from '../context/MenuContext';
import { Venue } from '../types';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import {
  Layers,
  Plus,
  ExternalLink,
  Trash2,
  CheckCircle2,
  Copy,
  Check,
  Store,
  Calendar,
  DollarSign,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

export const AdminWorkspacesPage: React.FC = () => {
  const { venue, allVenues, switchVenue, createWorkspace, deleteWorkspace } = useMenu();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newVenueName, setNewVenueName] = useState<string>('');
  const [newVenueCurrency, setNewVenueCurrency] = useState<string>('SAR');
  const [newVenueSlug, setNewVenueSlug] = useState<string>('');
  const [venueToDelete, setVenueToDelete] = useState<Venue | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const handleCopyLink = (slug: string) => {
    const url = `${window.location.origin}/menu/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!newVenueName.trim()) {
      setErrorMsg('يرجى إدخال اسم المنشأة أو المطعم');
      return;
    }

    try {
      setIsSubmitting(true);
      const generatedSlug = newVenueSlug.trim()
        ? newVenueSlug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-')
        : `menu-${Date.now().toString().slice(-6)}`;

      await createWorkspace({
        name: newVenueName.trim(),
        currency: newVenueCurrency,
        slug: generatedSlug,
        description: 'مرحباً بكم في قائمتنا الرقمية',
      });

      setNewVenueName('');
      setNewVenueSlug('');
      setIsCreateModalOpen(false);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg('تعذر إنشاء المساحة، يرجى المحاولة لاحقاً');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!venueToDelete) return;
    try {
      await deleteWorkspace(venueToDelete.id);
      setVenueToDelete(null);
    } catch (err) {
      console.error('Failed to delete workspace:', err);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-neutral-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 text-amber-700 text-xs font-bold uppercase tracking-wider mb-1">
            <Layers className="w-4 h-4" />
            <span>نظام المساحات والحسابات المتعددة</span>
          </div>
          <h1 className="text-xl font-extrabold text-neutral-900">
            إدارة المساحات وقوائم الطعام
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            استعراض ومراجعة كافة المساحات المسجلة في النظام والتبديل بينها أو إنشاء مساحة مستقلة جديدة.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setErrorMsg('');
            setIsCreateModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>إنشاء مساحة جديدة</span>
        </button>
      </div>

      {/* Grid of Workspaces */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {allVenues.map((v) => {
          const isActive = venue?.id === v.id;
          const menuUrl = `${window.location.origin}/menu/${v.slug}`;

          return (
            <div
              key={v.id}
              className={`bg-white rounded-2xl border p-5 transition-all flex flex-col justify-between ${
                isActive
                  ? 'border-amber-600 ring-2 ring-amber-500/20 shadow-sm'
                  : 'border-neutral-200 hover:border-neutral-300 shadow-2xs'
              }`}
            >
              <div>
                {/* Header with Active Badge */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-700 font-bold border border-neutral-200/60 overflow-hidden flex-shrink-0">
                      {v.profileImage ? (
                        <img src={v.profileImage} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Store className="w-5 h-5 text-neutral-500" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-neutral-900 leading-snug truncate max-w-[160px]">
                        {v.name}
                      </h3>
                      <span className="text-[11px] font-mono text-neutral-500">
                        /{v.slug}
                      </span>
                    </div>
                  </div>

                  {isActive ? (
                    <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-300/60">
                      <CheckCircle2 className="w-3 h-3 text-amber-700" />
                      <span>نشطة حالياً</span>
                    </span>
                  ) : null}
                </div>

                {/* Details */}
                <div className="space-y-1.5 text-xs text-neutral-600 bg-neutral-50 p-3 rounded-xl mb-4 border border-neutral-100 font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-600 flex items-center gap-1 font-sans">
                      <DollarSign className="w-3.5 h-3.5" />
                      العملة:
                    </span>
                    <span className="font-semibold text-neutral-800">{v.currency} ({v.currencySymbol || ''})</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-600 flex items-center gap-1 font-sans">
                      <Calendar className="w-3.5 h-3.5" />
                      تاريخ الإنشاء:
                    </span>
                    <span className="text-[11px] text-neutral-600">
                      {v.createdAt ? new Date(v.createdAt).toLocaleDateString('ar-SA') : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 border-t border-neutral-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleCopyLink(v.slug)}
                    className="p-1.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                    title="نسخ رابط القائمة"
                  >
                    {copiedSlug === v.slug ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                  <a
                    href={menuUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                    title="فتح القائمة للعميل"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  {allVenues.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setVenueToDelete(v)}
                      className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="حذف المساحة"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {!isActive ? (
                  <button
                    type="button"
                    onClick={() => switchVenue(v.id)}
                    className="inline-flex items-center gap-1 text-xs font-bold py-1.5 px-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg transition-colors cursor-pointer"
                  >
                    <span>التبديل والتحكم</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                ) : (
                  <span className="text-xs text-neutral-500 font-medium">
                    لوحة التحكم تدير هذه المساحة
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Create Workspace */}
      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsCreateModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-neutral-200 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-bold text-neutral-900 mb-1">
              إنشاء مساحة / منشأة جديدة
            </h2>
            <p className="text-xs text-neutral-500 mb-4">
              سيتم إنشاء قائمة طعام جديدة مستقلة تماماً ومفصولة عن باقي المساحات.
            </p>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  اسم المنشأة أو المطعم <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newVenueName}
                  onChange={(e) => setNewVenueName(e.target.value)}
                  placeholder="مثال: برجر هاوس"
                  required
                  autoFocus
                  className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  الرابط المخصص (Slug اختياري)
                </label>
                <input
                  type="text"
                  value={newVenueSlug}
                  onChange={(e) => setNewVenueSlug(e.target.value)}
                  placeholder="مثال: burger-house"
                  dir="ltr"
                  className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 text-sm font-mono text-left"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  العملة
                </label>
                <select
                  value={newVenueCurrency}
                  onChange={(e) => setNewVenueCurrency(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 text-sm bg-white"
                >
                  <option value="SAR">ريال سعودي (SAR)</option>
                  <option value="AED">درهم إماراتي (AED)</option>
                  <option value="KWD">دينار كويتي (KWD)</option>
                  <option value="BHD">دينار بحريني (BHD)</option>
                  <option value="QAR">ريال قطري (QAR)</option>
                  <option value="OMR">ريال عماني (OMR)</option>
                  <option value="EGP">جنيه مصري (EGP)</option>
                  <option value="USD">دولار أمريكي (USD)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-bold transition-all cursor-pointer"
                >
                  {isSubmitting ? 'جاري الإنشاء...' : 'إنشاء وبدء التحكم'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="py-2.5 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl font-medium transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation for deleting workspace */}
      <ConfirmDialog
        isOpen={Boolean(venueToDelete)}
        onClose={() => setVenueToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="حذف المساحة بالكامل؟"
        message={`هل أنت متأكد من رغبتك في حذف مساحة «${venueToDelete?.name}»؟ سيؤدي ذلك لحذف كافة الأصناف والأقسام والفلاتر التابعة لها بشكل نهائي.`}
        confirmLabel="نعم، حذف المساحة"
        isDestructive={true}
      />
    </div>
  );
};
