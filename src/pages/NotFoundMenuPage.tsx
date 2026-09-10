import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, Store } from 'lucide-react';

export const NotFoundMenuPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6" dir="rtl">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 border border-neutral-200 shadow-sm text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-5">
          <AlertCircle className="w-8 h-8 stroke-1" />
        </div>

        <h1 className="text-2xl font-extrabold text-neutral-900 mb-2">
          المنيو غير موجود
        </h1>

        <p className="text-neutral-600 text-sm mb-6 leading-relaxed">
          عذرًا، لم يتم العثور على منيو للمنشأة بالرابط المخصص{' '}
          {slug && <code className="bg-neutral-100 text-amber-800 px-2 py-0.5 rounded font-mono text-xs" dir="ltr">/{slug}</code>}.
          تأكد من صحة الرابط أو مسح رمز الـ QR الصحيح.
        </p>

        <div className="space-y-3">
          <Link
            to="/"
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold text-sm transition-colors cursor-pointer"
          >
            <Store className="w-4 h-4" />
            <span>عرض القائمة الرئيسية</span>
          </Link>

          <Link
            to="/admin"
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl font-semibold text-sm transition-colors cursor-pointer"
          >
            <span>الانتقال إلى لوحة التحكم</span>
            <ArrowRight className="w-4 h-4 rotate-180" />
          </Link>
        </div>
      </div>
    </div>
  );
};
