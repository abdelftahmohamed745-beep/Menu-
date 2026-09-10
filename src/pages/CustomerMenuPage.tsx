import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { MenuData, Product } from '../types';
import { menuRepository } from '../repositories';
import { CustomerHeader } from '../components/customer/CustomerHeader';
import { CategoryTabs } from '../components/customer/CategoryTabs';
import { SearchAndFilterBar } from '../components/customer/SearchAndFilterBar';
import { ProductCard } from '../components/customer/ProductCard';
import { ProductDetailModal } from '../components/customer/ProductDetailModal';
import { EmptyState } from '../components/common/EmptyState';
import { AdminLoginModal } from '../components/common/AdminLoginModal';
import { NotFoundMenuPage } from './NotFoundMenuPage';
import { arabicTextIncludes } from '../utils/arabic';
import { SearchX, Coffee, Utensils } from 'lucide-react';

export const CustomerMenuPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [menuData, setMenuData] = useState<MenuData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isNotFound, setIsNotFound] = useState<boolean>(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);

  // Search & Filters state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string>('');

  const categorySectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Load menu by slug
  const loadMenu = async () => {
    if (!slug) {
      setIsNotFound(true);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const data = await menuRepository.getMenuDataBySlug(slug);
      if (!data) {
        setIsNotFound(true);
      } else {
        setMenuData(data);
        setIsNotFound(false);
        // Set first non-empty category as default active
        const visibleCategories = data.categories.filter((cat) =>
          data.products.some((p) => p.categoryId === cat.id && p.isVisible)
        );
        if (visibleCategories.length > 0) {
          setActiveCategoryId(visibleCategories[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load menu:', err);
      setIsNotFound(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMenu();

    const handleDataChanged = () => {
      loadMenu();
    };

    window.addEventListener('menu_data_changed', handleDataChanged);
    return () => {
      window.removeEventListener('menu_data_changed', handleDataChanged);
    };
  }, [slug]);

  // Toggle filter tag
  const handleToggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleClearFilters = () => {
    setSelectedTagIds([]);
    setSearchQuery('');
  };

  // Filter products:
  // 1. Only visible products (`isVisible: true`)
  // 2. Matches search query in name or description (Arabic resilient)
  // 3. Matches selected tags with OR logic
  const filteredProducts = useMemo(() => {
    if (!menuData) return [];

    return menuData.products.filter((product) => {
      // 1. Must be visible
      if (!product.isVisible) return false;

      // 2. Search match (AND with tags)
      if (searchQuery.trim()) {
        const query = searchQuery.trim();
        const matchesName = arabicTextIncludes(product.name, query);
        const matchesDesc = product.description
          ? arabicTextIncludes(product.description, query)
          : false;

        if (!matchesName && !matchesDesc) {
          return false;
        }
      }

      // 3. Filter tags match (OR between selected tags)
      if (selectedTagIds.length > 0) {
        const hasAnyTag = selectedTagIds.some((tagId) =>
          product.filterTagIds?.includes(tagId)
        );
        if (!hasAnyTag) {
          return false;
        }
      }

      return true;
    });
  }, [menuData, searchQuery, selectedTagIds]);

  // Total visible products count (before search/tags)
  const totalVisibleCount = useMemo(() => {
    if (!menuData) return 0;
    return menuData.products.filter((p) => p.isVisible).length;
  }, [menuData]);

  // Categories that have at least 1 matching product
  const activeCategories = useMemo(() => {
    if (!menuData) return [];

    return menuData.categories.filter((category) => {
      return filteredProducts.some((p) => p.categoryId === category.id);
    });
  }, [menuData, filteredProducts]);

  // Product count map for tabs
  const productCountByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredProducts.forEach((p) => {
      counts[p.categoryId] = (counts[p.categoryId] || 0) + 1;
    });
    return counts;
  }, [filteredProducts]);

  // Scroll to category
  const handleScrollToCategory = (categoryId: string) => {
    setActiveCategoryId(categoryId);
    const element = categorySectionRefs.current[categoryId];
    if (element) {
      const yOffset = -140; // Offset for sticky category bar & search
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  // Intersection observer to update active category tab while scrolling
  useEffect(() => {
    if (activeCategories.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const categoryId = entry.target.getAttribute('data-category-id');
            if (categoryId) {
              setActiveCategoryId(categoryId);
            }
          }
        });
      },
      {
        rootMargin: '-20% 0px -70% 0px',
        threshold: 0,
      }
    );

    (Object.values(categorySectionRefs.current) as (HTMLElement | null)[]).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [activeCategories]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6 text-center" dir="rtl">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center animate-bounce mb-3">
          <Coffee className="w-6 h-6" />
        </div>
        <p className="text-sm font-medium text-neutral-600">جاري تحميل قائمة الطعام...</p>
      </div>
    );
  }

  if (isNotFound || !menuData) {
    return <NotFoundMenuPage />;
  }

  const { venue, filterTags } = menuData;
  const hasProducts = menuData.products.length > 0;

  return (
    <div className="min-h-screen bg-neutral-50/50 pb-20 selection:bg-amber-100" dir="rtl">
      {/* 1. Restaurant Header (Clean, visitor facing only) */}
      <CustomerHeader venue={venue} />

      {/* 2. Sticky Bar for Search and Categories (Only if products exist) */}
      {hasProducts && (
        <div className="sticky top-0 z-30 shadow-xs">
          <SearchAndFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filterTags={filterTags}
            selectedTagIds={selectedTagIds}
            onToggleTag={handleToggleTag}
            onClearFilters={handleClearFilters}
            resultCount={filteredProducts.length}
            totalVisibleCount={totalVisibleCount}
          />

          {activeCategories.length > 0 && (
            <CategoryTabs
              categories={activeCategories}
              activeCategoryId={activeCategoryId}
              onSelectCategory={handleScrollToCategory}
              productCountByCategory={productCountByCategory}
            />
          )}
        </div>
      )}

      {/* 3. Products List or Initial Empty State */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6">
        {!hasProducts ? (
          <div className="pt-12 pb-16">
            <EmptyState
              icon={<Utensils className="w-10 h-10 stroke-1 text-neutral-400" />}
              title="قائمة الطعام فارغة حالياً"
              description="لم تتم إضافة أي أطباق أو مشروبات بعد إلى هذه القائمة الرقمية."
            />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="pt-8">
            <EmptyState
              icon={<SearchX className="w-8 h-8 stroke-1 text-neutral-400" />}
              title="لم يتم العثور على أطباق مطابقة"
              description="جرب البحث بكلمات مختلفة أو قم بإلغاء بعض الفلاتر لعرض المزيد من الأصناف."
              action={{
                label: 'مسح البحث والفلاتر',
                onClick: handleClearFilters,
              }}
            />
          </div>
        ) : (
          <div className="space-y-10">
            {activeCategories.map((category) => {
              const categoryProducts = filteredProducts.filter(
                (p) => p.categoryId === category.id
              );

              if (categoryProducts.length === 0) return null;

              return (
                <section
                  key={category.id}
                  id={category.id}
                  data-category-id={category.id}
                  ref={(el) => {
                    categorySectionRefs.current[category.id] = el;
                  }}
                  className="scroll-mt-40"
                >
                  {/* Category Section Title */}
                  <div className="mb-4 pb-2 border-b border-neutral-200/80">
                    <h2 className="text-lg sm:text-xl font-extrabold text-neutral-900 tracking-tight flex items-center gap-2">
                      <span>{category.name}</span>
                      <span className="text-xs font-medium text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-full">
                        {categoryProducts.length}
                      </span>
                    </h2>
                    {category.description && (
                      <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
                        {category.description}
                      </p>
                    )}
                  </div>

                  {/* Grid of Product Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {categoryProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        currency={venue.currency}
                        filterTags={filterTags}
                        onClick={setSelectedProduct}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      {/* 4. Product Details Modal/Sheet */}
      <ProductDetailModal
        product={selectedProduct}
        isOpen={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        currency={venue.currency}
        filterTags={filterTags}
      />

      {/* 5. Minimalist Customer Footer with discreet tiny Admin entry */}
      <footer className="mt-16 pt-8 pb-12 border-t border-neutral-200/60 text-center text-xs text-neutral-500 max-w-4xl mx-auto px-4">
        <p className="text-neutral-700 font-semibold mb-1">
          منيو {venue.name} الرقمي
        </p>
        <p className="text-neutral-500 text-xs">
          تم تصميم هذه النسخة للاطلاع على قائمة الطعام والأسعار عبر رمز الـ QR مباشرة.
        </p>

        {/* Discreet tiny Admin text link */}
        <div className="mt-6 pt-4 border-t border-neutral-100 flex justify-center">
          <button
            type="button"
            onClick={() => setIsAdminModalOpen(true)}
            className="text-[11px] text-neutral-300 hover:text-neutral-600 transition-colors cursor-pointer select-none font-sans font-medium px-2 py-1 tracking-wider"
            aria-label="Admin"
          >
            Admin
          </button>
        </div>
      </footer>

      {/* Admin Login Dialog */}
      <AdminLoginModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        redirectPath="/admin"
      />
    </div>
  );
};
