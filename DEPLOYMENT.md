# دليل نشر وتشغيل تطبيق المنيو الإلكتروني (SPA Deployment Guide)

تطبيق المنيو مبني باستخدام **React + Vite + TypeScript** بنظام **Single Page Application (SPA)** مع توجيه المسارات عبر **React Router**.

---

## 1. بناء المشروع للإنتاج (Production Build)

قم بتنفيذ أمر البناء التالي لإنشاء ملفات الموقع الجاهزة داخل مجلد `dist/`:

```bash
npm run build
```

---

## 2. إعدادات إعادة التوجيه (SPA Fallback / Rewrites)

بما أن التطبيق يعتمد على مسارات ديناميكية مثل:
- `/menu/:slug`
- `/admin`
- `/admin/products`
- `/admin/venue`

يجب توجيه كافة الطلبات (HTTP 404 Fallback) إلى ملف `index.html` ليعمل التوجيه الداخلي بسلاسة دون أخطاء عند تحديث الصفحة أو فتح الروابط مباشرة.

### أ) Nginx
في ملف إعدادات الموقع `nginx.conf`:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### ب) Vercel
قم بإنشاء أو تعديل ملف `vercel.json` في جذر المشروع:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### ج) Netlify
قم بإنشاء ملف باسم `public/_redirects`:
```text
/*    /index.html   200
```

### د) Apache (`.htaccess`)
في مجلد المشروع:
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

---

## 3. بنية البيانات والتوسّع المستقبلي (Backend Ready)

التطبيق يطبق نمط الـ Repository Pattern عبر واجهة `IMenuRepository`:
- **الحالي:** `LocalStorageMenuRepository` لتخزين ومعالجة البيانات محليًا دون خادم.
- **المستقبلي:** لربط خادم backend أو REST API حقيقي أو قاعدة بيانات (مثل Firebase / PostgreSQL):
  يكفي إنشاء صف جديد مثل `ApiMenuRepository implements IMenuRepository` وتمريره في `MenuContext` دون الحاجة لتعديل أي واجهة مستخدم أو مكون داخلي.
