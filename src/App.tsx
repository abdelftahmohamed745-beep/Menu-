import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MenuProvider, useMenu } from './context/MenuContext';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { CustomerMenuPage } from './pages/CustomerMenuPage';
import { NotFoundMenuPage } from './pages/NotFoundMenuPage';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminOverviewPage } from './pages/AdminOverviewPage';
import { AdminVenuePage } from './pages/AdminVenuePage';
import { AdminCategoriesPage } from './pages/AdminCategoriesPage';
import { AdminProductsPage } from './pages/AdminProductsPage';
import { AdminFiltersPage } from './pages/AdminFiltersPage';
import { AdminQrPage } from './pages/AdminQrPage';
import { AdminWorkspacesPage } from './pages/AdminWorkspacesPage';

const DynamicHomeRedirect: React.FC = () => {
  const { venue, isLoading } = useMenu();
  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center text-neutral-500 text-sm" dir="rtl">
        جاري التحميل...
      </div>
    );
  }
  const targetSlug = venue?.slug || 'my-restaurant';
  return <Navigate to={`/menu/${targetSlug}`} replace />;
};

export default function App() {
  return (
    <AdminAuthProvider>
      <MenuProvider>
        <BrowserRouter>
          <Routes>
            {/* Dynamic Redirect to Restaurant Menu */}
            <Route path="/" element={<DynamicHomeRedirect />} />

            {/* Customer Facing Menu */}
            <Route path="/menu/:slug" element={<CustomerMenuPage />} />

            {/* Admin Control Panel */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminOverviewPage />} />
              <Route path="workspaces" element={<AdminWorkspacesPage />} />
              <Route path="venue" element={<AdminVenuePage />} />
              <Route path="categories" element={<AdminCategoriesPage />} />
              <Route path="products" element={<AdminProductsPage />} />
              <Route path="filters" element={<AdminFiltersPage />} />
              <Route path="qr" element={<AdminQrPage />} />
            </Route>

            {/* Fallback 404 Route */}
            <Route path="*" element={<NotFoundMenuPage />} />
          </Routes>
        </BrowserRouter>
      </MenuProvider>
    </AdminAuthProvider>
  );
}
