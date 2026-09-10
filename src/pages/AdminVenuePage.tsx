import React, { useState, useEffect } from 'react';
import { useMenu } from '../context/MenuContext';
import { Venue } from '../types';
import { ImageWithFallback } from '../components/common/ImageWithFallback';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import {
  Save,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Upload,
  Trash2,
  ExternalLink,
  Store,
} from 'lucide-react';

const COMMON_CURRENCIES = [
  { code: 'SAR', name: 'ريال سعودي (SAR)' },
  { code: 'AED', name: 'درهم إماراتي (AED)' },
  { code: 'KWD', name: 'دينار كويتي (KWD)' },
  { code: 'BHD', name: 'دينار بحريني (BHD)' },
  { code: 'QAR', name: 'ريال قطري (QAR)' },
  { code: 'OMR', name: 'ريال عماني (OMR)' },
  { code: 'EGP', name: 'جنيه مصري (EGP)' },
  { code: 'JOD', name: 'دينار أردني (JOD)' },
  { code: 'USD', name: 'دولار أمريكي (USD)' },
  { code: 'EUR', name: 'يورو (EUR)' },
];

export const AdminVenuePage: React.FC = () => {
  const { venue, updateVenue } = useMenu();

  const [formData, setFormData] = useState<Venue | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState<boolean>(false);

  // Initialize form
  useEffect(() => {
    if (venue) {
      setFormData(JSON.parse(JSON.stringify(venue)));
      setHasUnsavedChanges(false);
    }
  }, [venue]);

  // Track changes
  const handleChange = (field: keyof Venue, value: unknown) => {
    if (!formData) return;
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    setHasUnsavedChanges(true);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleSocialChange = (key: 'instagram' | 'whatsapp', value: string) => {
    if (!formData) return;
    const social = { ...(formData.socialLinks || {}), [key]: value };
    handleChange('socialLinks', social);
  };

  // Image upload simulation via FileReader (DataURL) or direct URL
  const handleImageFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'coverImage' | 'profileImage'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage('حجم الصورة كبير جدًا (الحد الأقصى 2 ميغابايت).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      handleChange(type, reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = (type: 'coverImage' | 'profileImage') => {
    handleChange(type, '');
  };

  // Form submission
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;

    if (!formData.name.trim()) {
      setErrorMessage('اسم المنشأة مطلوب.');
      return;
    }

    const cleanSlug = formData.slug.trim().toLowerCase();
    if (!cleanSlug) {
      setErrorMessage('الرابط المخصص (Slug) مطلوب.');
      return;
    }

    if (!/^[a-z0-9-_]+$/i.test(cleanSlug)) {
      setErrorMessage('الرابط المخصص يجب أن يتكون من أحرف إنجليزية وأرقام وشرطات فقط.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);
      await updateVenue({ ...formData, slug: cleanSlug });
      setHasUnsavedChanges(false);
      setSuccessMessage('تم حفظ بيانات المنشأة بنجاح.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل حفظ البيانات.';
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardChanges = () => {
    if (venue) {
      setFormData(JSON.parse(JSON.stringify(venue)));
      setHasUnsavedChanges(false);
      setErrorMessage(null);
      setSuccessMessage(null);
    }
    setIsDiscardConfirmOpen(false);
  };

  if (!formData) return null;

  const slugChanged = venue && formData.slug !== venue.slug;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-neutral-900 tracking-tight">
            بيانات المكان والهوية
          </h2>
          <p className="text-sm text-neutral-500 mt-1">
            تخصيص اسم المنشأة، الشعار، صورة الغلاف، العملة والرابط المخصص للمنيو.
          </p>
        </div>

        {hasUnsavedChanges && (
          <div className="flex items-center gap-2 bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-xl text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>توجد تغييرات غير محفوظة</span>
          </div>
        )}
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 p-4 rounded-xl text-sm font-semibold animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-2 bg-rose-50 text-rose-800 border border-rose-200 p-4 rounded-xl text-sm font-semibold animate-in fade-in">
          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Visual Brand Assets (Cover & Profile) */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-2xs space-y-6">
          <h3 className="text-base font-bold text-neutral-900 border-b border-neutral-100 pb-3 flex items-center gap-2">
            <Store className="w-4 h-4 text-amber-600" />
            <span>الصور والهوية البصرية</span>
          </h3>

          {/* Cover Image Upload & Preview */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-2">
              صورة الغلاف العريضة (اختيارية)
            </label>

            {formData.coverImage ? (
              <div className="relative rounded-2xl overflow-hidden h-40 sm:h-52 bg-neutral-100 border border-neutral-200 mb-3">
                <ImageWithFallback
                  src={formData.coverImage}
                  alt="معاينة الغلاف"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveImage('coverImage')}
                  className="absolute top-3 end-3 p-2 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-md transition-colors cursor-pointer"
                  title="حذف صورة الغلاف"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-neutral-200 p-6 text-center mb-3">
                <p className="text-xs text-neutral-500 mb-2">لا توجد صورة غلاف حاليًا</p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-xl cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>رفع صورة غلاف جديدة</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageFile(e, 'coverImage')}
                  className="hidden"
                />
              </label>

              <input
                type="text"
                placeholder="أو ضع رابط صورة مباشر (URL)..."
                value={formData.coverImage || ''}
                onChange={(e) => handleChange('coverImage', e.target.value)}
                className="flex-1 min-w-[200px] text-xs px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:border-amber-600"
                dir="ltr"
              />
            </div>
          </div>

          {/* Profile / Logo Upload & Preview */}
          <div className="pt-4 border-t border-neutral-100">
            <label className="block text-xs font-bold text-neutral-700 mb-2">
              شعار المنشأة أو الصورة الرمزية (اختيارية)
            </label>

            <div className="flex items-center gap-4 mb-3">
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-neutral-100 border border-neutral-200 relative flex-shrink-0">
                {formData.profileImage ? (
                  <ImageWithFallback
                    src={formData.profileImage}
                    alt="شعار المنشأة"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-400 text-xl font-bold bg-neutral-100">
                    {formData.name ? formData.name.charAt(0) : '?'}
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-xl cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>رفع شعار</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageFile(e, 'profileImage')}
                      className="hidden"
                    />
                  </label>

                  {formData.profileImage && (
                    <button
                      type="button"
                      onClick={() => handleRemoveImage('profileImage')}
                      className="inline-flex items-center gap-1 px-3 py-2 text-red-600 hover:bg-red-50 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف الشعار</span>
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  placeholder="أو رابط الشعار (URL)..."
                  value={formData.profileImage || ''}
                  onChange={(e) => handleChange('profileImage', e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:border-amber-600"
                  dir="ltr"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Basic Info & Currency */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-2xs space-y-4">
          <h3 className="text-base font-bold text-neutral-900 border-b border-neutral-100 pb-3">
            المعلومات الأساسية والعملة
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                اسم المطعم / الكافيه *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="مثال: مقهى الأريج"
                className="w-full text-sm px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:border-amber-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                العملة المعتمدة للأسعار *
              </label>
              <select
                value={formData.currency}
                onChange={(e) => handleChange('currency', e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:border-amber-600 focus:bg-white cursor-pointer"
              >
                {COMMON_CURRENCIES.map((curr) => (
                  <option key={curr.code} value={curr.code}>
                    {curr.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1.5">
              الوصف التعريفي
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="نبذة عن المقهى وتجربة الضيافة وقائمة الطعام..."
              className="w-full text-sm px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:border-amber-600 focus:bg-white leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                العنوان والموقع
              </label>
              <input
                type="text"
                value={formData.address || ''}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="مثال: الرياض، حي حطين"
                className="w-full text-sm px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:border-amber-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                ساعات العمل
              </label>
              <input
                type="text"
                value={formData.openingHours || ''}
                onChange={(e) => handleChange('openingHours', e.target.value)}
                placeholder="مثال: يوميًا من 7:00 ص إلى 12:00 م"
                className="w-full text-sm px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:border-amber-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                رقم الهاتف / التواصل
              </label>
              <input
                type="text"
                value={formData.phone || ''}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="05xxxxxxxx"
                className="w-full text-sm px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:border-amber-600 text-left"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                حساب انستغرام (دون @)
              </label>
              <input
                type="text"
                value={formData.socialLinks?.instagram || ''}
                onChange={(e) => handleSocialChange('instagram', e.target.value)}
                placeholder="alareej_cafe"
                className="w-full text-sm px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:border-amber-600 text-left"
                dir="ltr"
              />
            </div>
          </div>
        </div>

        {/* Slug and Menu URL */}
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-2xs space-y-4">
          <h3 className="text-base font-bold text-neutral-900 border-b border-neutral-100 pb-3">
            رابط المنيو الرقمي (Slug)
          </h3>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1.5">
              المعرّف المخصص في الرابط (Slug) *
            </label>
            <div className="flex items-center rounded-xl border border-neutral-200 bg-neutral-50 overflow-hidden focus-within:border-amber-600 focus-within:bg-white" dir="ltr">
              <span className="px-3.5 py-2.5 text-xs text-neutral-600 font-mono select-none bg-neutral-100 border-e border-neutral-200">
                /menu/
              </span>
              <input
                type="text"
                required
                value={formData.slug}
                onChange={(e) => handleChange('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                placeholder="my-restaurant"
                className="w-full text-sm px-3.5 py-2.5 bg-transparent outline-none font-mono font-medium"
              />
            </div>
            <p className="text-[11px] text-neutral-600 mt-1.5">
              يُستخدم هذا المعرّف لتوليد رابط صفحة المنيو ورمز الـ QR المطبوع على الطاولات.
            </p>
          </div>

          {slugChanged && (
            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>تنبيه هام حول تغيير الرابط:</strong> عند حفظ الرابط الجديد (<code>/{formData.slug}</code>)، لن يعود الرابط القديم صالحًا، وستحتاج إلى إعادة طباعة أو تحديث رموز الـ QR القديمة.
              </div>
            </div>
          )}
        </div>

        {/* Save Bar */}
        <div className="sticky bottom-4 z-20 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-neutral-200 shadow-lg flex items-center justify-between gap-4">
          <div className="text-xs text-neutral-600">
            {hasUnsavedChanges ? (
              <span className="text-amber-800 font-semibold">لديك تعديلات غير محفوظة</span>
            ) : (
              <span>جميع التعديلات محفوظة</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!hasUnsavedChanges || isSaving}
              onClick={() => setIsDiscardConfirmOpen(true)}
              className="px-4 py-2.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors disabled:opacity-40 cursor-pointer"
            >
              تراجع عن التعديلات
            </button>

            <button
              type="submit"
              disabled={!hasUnsavedChanges || isSaving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-600/20 disabled:opacity-40 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Discard confirmation dialog */}
      <ConfirmDialog
        isOpen={isDiscardConfirmOpen}
        onClose={() => setIsDiscardConfirmOpen(false)}
        onConfirm={handleDiscardChanges}
        title="إلغاء التغييرات غير المحفوظة؟"
        message="هل أنت متأكد من رغبتك في التراجع عن التعديلات وإعادة تعيين الحقول إلى القيم المحفوظة مسبقًا؟"
        confirmLabel="نعم، تراجع"
        isDestructive={false}
      />
    </div>
  );
};
