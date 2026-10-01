import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MenuProvider } from './context/MenuContext';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { HomePage } from './pages/HomePage';
import { CustomerMenuPage } from './pages/CustomerMenuPage';
import { NotFoundMenuPage } from './pages/NotFoundMenuPage';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminOverviewPage } from './pages/AdminOverviewPage';
import { AdminVenuePage } from './pages/AdminVenuePage';
import { AdminCategoriesPage } from './pages/AdminCategoriesPage';
import { AdminProductsPage } from './pages/AdminProductsPage';
import { AdminFiltersPage } from './pages/AdminFiltersPage';
import { AdminQrPage } from './pages/AdminQrPage';
import { SuperAdminPage } from './pages/SuperAdminPage';
import { MagicLinkErrorPage } from './pages/MagicLinkErrorPage';
import { MagicLinkHandlerPage } from './pages/MagicLinkHandlerPage';

export default function App() {
  return (
    <AdminAuthProvider>
      <MenuProvider>
        <BrowserRouter>
          <Routes>
            {/* 1. Main Platform Domain - Clean Empty Platform Landing (No Restaurant Selected) */}
            <Route path="/" element={<HomePage />} />

            {/* 2. Super Admin Portal (Hidden, noindex, standalone) */}
            <Route path="/super-admin" element={<SuperAdminPage />} />

            {/* 3. Magic Link Handling Routes */}
            <Route path="/r/:token" element={<MagicLinkHandlerPage />} />
            <Route path="/magic-link-error" element={<MagicLinkErrorPage />} />

            {/* 4. Customer Facing Menu for Specific Restaurant */}
            <Route path="/menu/:slug" element={<CustomerMenuPage />} />

            {/* 5. Isolated Admin Control Panel for Specific Restaurant */}
            <Route path="/admin/:restaurantId" element={<AdminLayout />}>
              <Route index element={<AdminOverviewPage />} />
              <Route path="venue" element={<AdminVenuePage />} />
              <Route path="categories" element={<AdminCategoriesPage />} />
              <Route path="products" element={<AdminProductsPage />} />
              <Route path="filters" element={<AdminFiltersPage />} />
              <Route path="qr" element={<AdminQrPage />} />
            </Route>

            {/* General /admin without restaurant ID redirects to main domain */}
            <Route path="/admin" element={<Navigate to="/" replace />} />

            {/* Fallback 404 Route */}
            <Route path="*" element={<NotFoundMenuPage />} />
          </Routes>
        </BrowserRouter>
      </MenuProvider>
    </AdminAuthProvider>
  );
}
