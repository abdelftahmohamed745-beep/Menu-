# دليل نشر وتشغيل تطبيق المنيو الإلكتروني على Vercel و Node.js

تطبيق المنيو الرقمي مبني باستخدام **React + Vite** للواجهة الأمامية و **Express + Firebase Admin SDK** لدوال الخادم (Serverless Functions) على منصة Vercel.

---

## 1. آلية البناء التلقائي (Build Pipeline)

عند تنفيذ أمر البناء على Vercel:
```bash
npm run build
```
يقوم النظام تلقائياً بـ:
1. توليد معرّف إصدار فريد وتاريخ بناء تلقائي (`scripts/generate-build-id.js`).
2. تجميع الواجهة الأمامية عبر Vite داخل مجلد `dist/`.
3. تجميع كود الخادم كاملاً في ملف واحد ذاتي الاحتواء (`api/_server.mjs`) عبر esbuild مستهدفاً بيئة Node 20 ESM.

---

## 2. المتغيرات المطلوبة في Vercel (Environment Variables)

أضف المتغيرات التالية في لوحة تحكم Vercel (Settings ⬅️ Environment Variables):

| المتغير | الوصف | مثال |
|---|---|---|
| `SUPER_ADMIN_PASSWORD` | كلمة مرور بوابة الإدارة العامة (`/super-admin`) | كلمة مرور قوية |
| `SESSION_SECRET` | مفتاح تشفير التوقيع لملفات تعريف الارتباط (الجلسات) | نص عشوائي لا يقل عن 32 حرفاً |
| `FIREBASE_PROJECT_ID` | معرّف مشروع فايربيس | `keen-flame-j53bd` |
| `FIREBASE_CLIENT_EMAIL` | البريد الإلكتروني لحساب الخدمة (Service Account) | `...@...iam.gserviceaccount.com` |
| `FIREBASE_PRIVATE_KEY` | المفتاح الخاص لحساب الخدمة كاملاً | `-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----` |

---

## 3. التحقق من نجاح النشر المباشر

1. افتح الرابط: `https://<YOUR_APP>.vercel.app/api/ping`
   - يجب أن يرجع: `{"ok":true,"build":"v...","builtAt":"...","time":"..."}`
2. افتح الرابط: `https://<YOUR_APP>.vercel.app/api/health`
   - يجب أن يرجع: `{"ok":true,"databaseMode":"firebase-admin"}`
3. في أسفل شاشة تسجيل الدخول إلى `/super-admin` يظهر رقم الإصدار (Build ID) المتطابق.

---

## 4. الاختبارات والتحقق البرمجي

لتشغيل فحص الأنواع واختبارات دوال الخادم محلياً:
```bash
npm run lint   # فحص TypeScript بدون أخطاء
npm test       # اختبار دوال الخادم ومطابقة كلمات المرور
```
