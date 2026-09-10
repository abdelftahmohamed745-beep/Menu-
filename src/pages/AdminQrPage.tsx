import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useMenu } from '../context/MenuContext';
import { ImageWithFallback } from '../components/common/ImageWithFallback';
import {
  QrCode,
  Download,
  Copy,
  Check,
  Printer,
  ExternalLink,
  Smartphone,
  Store,
} from 'lucide-react';

export const AdminQrPage: React.FC = () => {
  const { venue } = useMenu();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const printCanvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const origin = window.location.origin;
  const menuSlug = venue?.id || venue?.slug || '';
  const menuUrl = menuSlug ? `${origin}/menu/${menuSlug}` : '';

  // Generate QR Code
  useEffect(() => {
    if (!canvasRef.current) return;

    QRCode.toCanvas(
      canvasRef.current,
      menuUrl,
      {
        width: 280,
        margin: 2,
        color: {
          dark: '#1c1917', // warm black / dark stone
          light: '#ffffff',
        },
      },
      (err) => {
        if (err) console.error('QR code generation error:', err);
      }
    );

    // Also generate data URL for download and printing
    QRCode.toDataURL(
      menuUrl,
      {
        width: 600,
        margin: 2,
        color: {
          dark: '#1c1917',
          light: '#ffffff',
        },
      },
      (err, url) => {
        if (!err && url) {
          setQrDataUrl(url);
        }
      }
    );
  }, [menuUrl]);

  // Copy link
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(menuUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // Download PNG
  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `menu-qr-${menuSlug}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Trigger Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Page Header (Hidden when printing) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-extrabold text-neutral-900 tracking-tight">
            رمز QR للزبائن وطباعة الستاند
          </h2>
          <p className="text-sm text-neutral-500 mt-1">
            وجّه الزبائن مباشرة إلى قائمة الطعام عبر مسح الكود بكاميرا هواتفهم دون الحاجة لأي تطبيق أو تسجيل دخول.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة ستاند الطاولة</span>
          </button>
        </div>
      </div>

      {/* Main QR Display & Actions Card (Hidden when printing) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 print:hidden">
        {/* QR Preview Box */}
        <div className="md:col-span-5 bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 mb-4 shadow-inner">
            <canvas ref={canvasRef} className="rounded-xl max-w-full" />
          </div>

          <div className="text-xs text-neutral-500 mb-4">
            يصل مباشرة إلى: <br />
            <code className="text-amber-800 font-mono font-semibold" dir="ltr">
              /menu/{menuSlug}
            </code>
          </div>

          <div className="w-full grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تنزيل PNG</span>
            </button>

            <a
              href={menuUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <span>فتح الرابط</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Link and Setup Instructions */}
        <div className="md:col-span-7 space-y-4">
          {/* Link Box */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-2xs space-y-2">
            <span className="text-xs font-bold text-neutral-700 block">
              رابط المنيو الرقمي المباشر
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={menuUrl}
                className="flex-1 text-xs px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl font-mono text-neutral-700 select-all outline-none"
                dir="ltr"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="flex-shrink-0 inline-flex items-center gap-1 px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>تم النسخ!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>نسخ</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Practical Tips */}
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-2xs space-y-3">
            <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-amber-600" />
              <span>كيف يستخدم الزبون رمز الـ QR؟</span>
            </h3>
            <ol className="list-decimal list-inside text-xs text-neutral-600 space-y-1.5 leading-relaxed">
              <li>يقوم الزبون بفتح تطبيق الكاميرا الأساسي في هاتفه الذكي.</li>
              <li>يوجه الكاميرا نحو رمز الـ QR المطبوع على الطاولة.</li>
              <li>يضغط على الإشعار الظاهر ليفتح المنيو فورًا داخل المتصفح دون الحاجة لتثبيت تطبيق أو تسجيل دخول.</li>
              <li>يمكنه البحث بالاسم، تصفية المأكولات والمشروبات، والاطلاع على الأسعار وتفاصيل المكونات.</li>
            </ol>
          </div>

          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5">
            <Printer className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>جاهز للطباعة مباشرة:</strong> تم تجهيز قالب ستاند الطاولة أدناه ليتناسب مع المقاسات القياسية لبطاقات الطاولات (Table Tent). اضغط زر «طباعة ستاند الطاولة» لتجربته فورًا.
            </div>
          </div>
        </div>
      </div>

      {/* 4. Table Stand / Tent Printable Layout */}
      <div className="space-y-3">
        <h3 className="text-base font-bold text-neutral-900 print:hidden">
          معاينة بطاقة ستاند الطاولة المطبوعة
        </h3>

        <div className="bg-white rounded-3xl border-2 border-neutral-300 p-8 max-w-sm mx-auto text-center shadow-lg print:border-none print:shadow-none print:p-4 print:max-w-none print:w-full">
          {/* Logo / Profile */}
          {venue?.profileImage ? (
            <div className="w-20 h-20 rounded-2xl overflow-hidden mx-auto mb-3 border border-neutral-100 shadow-xs">
              <ImageWithFallback
                src={venue.profileImage}
                alt={venue.name}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-amber-600 text-white flex items-center justify-center font-bold text-2xl mx-auto mb-3">
              {venue?.name ? venue.name.charAt(0) : <Store className="w-8 h-8" />}
            </div>
          )}

          <h4 className="text-xl font-black text-neutral-900 mb-1">
            {venue?.name}
          </h4>

          <p className="text-xs text-neutral-500 max-w-xs mx-auto mb-5 leading-relaxed">
            امسح الرمز بكاميرا جوالك للاطلاع على قائمة الطعام والأسعار
          </p>

          {/* QR Frame */}
          <div className="inline-block p-3 bg-white rounded-2xl border-2 border-neutral-900 shadow-xs mb-4">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR Code"
                className="w-48 h-48 sm:w-56 sm:h-56 mx-auto"
              />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-neutral-400">
                <QrCode className="w-12 h-12" />
              </div>
            )}
          </div>

          <div className="text-[11px] font-bold text-neutral-700 tracking-wider uppercase mb-1">
            قائمة طعام رقمية سريعة
          </div>

          <div className="text-[10px] text-neutral-600 font-mono" dir="ltr">
            {menuUrl}
          </div>
        </div>
      </div>
    </div>
  );
};
