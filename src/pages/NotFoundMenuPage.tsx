import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, Home } from 'lucide-react';

export const NotFoundMenuPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  return (
    <div className="min-h-screen bg-neutral-100/60 flex items-center justify-center p-6" dir="rtl">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 border border-neutral-200/80 shadow-sm text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-5 border border-rose-100">
          <AlertCircle className="w-8 h-8 stroke-1.5" />
        </div>

        <h1 className="text-2xl font-extrabold text-neutral-900 mb-2">
          المطعم غير موجود
        </h1>

        <p className="text-neutral-600 text-sm mb-6 leading-relaxed">
          عذرًا، لم يتم العثور على مطعم مرتبط بالمعرف المحدد{' '}
          {slug && (
            <code className="bg-neutral-100 text-rose-700 font-bold px-2 py-0.5 rounded font-mono text-xs" dir="ltr">
              {slug}
            </code>
          )}
          . يرجى التأكد من صحة الرابط أو مسح رمز الـ QR الصحيح.
        </p>

        <div>
          <Link
            to="/"
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-semibold text-sm transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>العودة إلى الصفحة الرئيسية</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
