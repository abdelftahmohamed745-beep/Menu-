import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Home, ArrowLeft } from 'lucide-react';

export const MagicLinkErrorPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4 selection:bg-amber-500/20" dir="rtl">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-2xl border border-neutral-200 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200 shadow-sm">
          <AlertTriangle className="w-8 h-8 stroke-1.5" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-black text-neutral-900 tracking-tight">
            الرابط غير صالح أو تم إلغاؤه
          </h1>
          <p className="text-xs text-neutral-600 leading-relaxed max-w-sm mx-auto">
            عذراً، هذا الرابط الخاص بالدخول إلى لوحة إدارة المطعم غير صالح، أو قد تم تعطيله، أو استبداله برابط جديد من قِبل المشرف.
          </p>
        </div>

        <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 text-xs text-neutral-600 space-y-1.5 text-right">
          <div className="font-bold text-neutral-800">ماذا يمكنك أن تفعل الآن؟</div>
          <ul className="list-disc list-inside space-y-1 text-neutral-500 text-[11px] leading-relaxed">
            <li>التواصل مع إدارة المنصة (Super Admin) للحصول على رابط دخول جديد صالح.</li>
            <li>أو التوجه إلى صفحة المنيو وتسجيل الدخول المباشر باستخدام كلمة مرور المطعم البديلة.</li>
          </ul>
        </div>

        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            <span>العودة إلى الصفحة الرئيسية</span>
          </button>
        </div>
      </div>
    </div>
  );
};
