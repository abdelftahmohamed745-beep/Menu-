import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMenu } from '../context/MenuContext';
import { QrCode, Plus, ArrowLeft, Store, AlertCircle } from 'lucide-react';

export const HomePage: React.FC = () => {
  const [restaurantIdInput, setRestaurantIdInput] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const { createWorkspace } = useMenu();
  const navigate = useNavigate();

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const idVal = restaurantIdInput.trim().toLowerCase();
    if (!idVal) {
      setErrorMsg('يرجى إدخال معرّف المطعم');
      return;
    }
    navigate(`/menu/${idVal}`);
  };

  const handleCreateNew = async () => {
    try {
      setIsCreating(true);
      setErrorMsg('');
      const newVenue = await createWorkspace({
        name: 'مطعم جديد',
        description: 'مرحباً بكم في قائمتنا الرقمية',
      });
      // Navigate to the newly created unique restaurant menu
      navigate(`/menu/${newVenue.slug || newVenue.id}`);
    } catch (err) {
      console.error('Failed to create new restaurant:', err);
      setErrorMsg('حدث خطأ أثناء إنشاء المطعم، يرجى المحاولة لاحقاً');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-100/60 flex flex-col items-center justify-center p-6 text-center" dir="rtl">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-neutral-200/80 shadow-sm space-y-6">
        {/* Visual Icon */}
        <div className="w-16 h-16 rounded-2xl bg-neutral-900 text-white flex items-center justify-center mx-auto shadow-md">
          <QrCode className="w-8 h-8 stroke-1.5" />
        </div>

        {/* Brand / Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight">
            المنيو الرقمي
          </h1>
          <p className="text-xs text-neutral-500 leading-relaxed max-w-sm mx-auto">
            منصة قوائم الطعام الرقمية عبر رمز QR. كل مطعم يمتلك معرّفاً خاصاً وقائمة طعام مستقلة تماماً.
          </p>
        </div>

        {/* Empty State Instruction */}
        <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/60 text-xs text-neutral-600 space-y-1.5 text-right">
          <div className="flex items-center gap-2 font-bold text-neutral-800">
            <Store className="w-4 h-4 text-amber-700" />
            <span>كيف تتصفح المنيو؟</span>
          </div>
          <p className="text-neutral-500 leading-relaxed text-[11px]">
            يرجى مسح رمز الـ QR الموجود على طاولة المطعم أو استخدام الرابط الخاص بالمطعم مباشرة للدخول إلى قائمته المخصصة.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 text-right">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Direct Lookup Input */}
        <form onSubmit={handleLookup} className="space-y-2">
          <label className="block text-xs font-bold text-neutral-700 text-right">
            لديك معرّف المطعم؟
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={restaurantIdInput}
              onChange={(e) => setRestaurantIdInput(e.target.value)}
              placeholder="مثال: my-restaurant"
              dir="ltr"
              className="flex-1 px-3 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl text-xs font-mono text-center focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>دخول</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>

        {/* Create New Restaurant Section */}
        <div className="pt-4 border-t border-neutral-100">
          <button
            type="button"
            onClick={handleCreateNew}
            disabled={isCreating}
            className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>{isCreating ? 'جاري إنشاء المطعم...' : 'إنشاء منيو جديد لمطعمك الآن'}</span>
          </button>
          <p className="text-[10px] text-neutral-400 mt-2">
            سيتم توليد معرف عشوائي وفريد ورابط خاص للمطعم فوراً.
          </p>
        </div>
      </div>
    </div>
  );
};
