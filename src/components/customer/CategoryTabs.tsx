import React, { useRef, useEffect } from 'react';
import { Category } from '../../types';

interface CategoryTabsProps {
  categories: Category[];
  activeCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
  productCountByCategory?: Record<string, number>;
}

export const CategoryTabs: React.FC<CategoryTabsProps> = ({
  categories,
  activeCategoryId,
  onSelectCategory,
  productCountByCategory = {},
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeBtnRef = useRef<HTMLButtonElement>(null);

  // Keep active tab centered in horizontal scroll view on mobile
  useEffect(() => {
    if (activeBtnRef.current && containerRef.current) {
      const container = containerRef.current;
      const button = activeBtnRef.current;
      const containerRect = container.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();

      const scrollLeft =
        button.offsetLeft -
        container.offsetLeft -
        containerRect.width / 2 +
        buttonRect.width / 2;

      container.scrollTo({
        left: scrollLeft,
        behavior: 'smooth',
      });
    }
  }, [activeCategoryId]);

  if (categories.length === 0) return null;

  return (
    <div className="w-full bg-white/95 backdrop-blur-md border-b border-neutral-200/80 shadow-2xs">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div
          ref={containerRef}
          className="flex items-center gap-2 overflow-x-auto py-3 no-scrollbar scroll-smooth"
          role="tablist"
          aria-label="أقسام المنيو"
        >
          {categories.map((category) => {
            const isActive = category.id === activeCategoryId;
            const count = productCountByCategory[category.id];

            return (
              <button
                key={category.id}
                ref={isActive ? activeBtnRef : null}
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelectCategory(category.id)}
                className={`flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap select-none ${
                  isActive
                    ? 'bg-neutral-900 text-white shadow-xs'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900'
                }`}
              >
                <span>{category.name}</span>
                {count !== undefined && count > 0 && (
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-600'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
