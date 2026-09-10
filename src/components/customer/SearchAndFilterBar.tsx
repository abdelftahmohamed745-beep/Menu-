import React from 'react';
import { FilterTag } from '../../types';
import { FilterBadge } from '../common/FilterBadge';
import { Search, X, SlidersHorizontal } from 'lucide-react';

interface SearchAndFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterTags: FilterTag[];
  selectedTagIds: string[];
  onToggleTag: (tagId: string) => void;
  onClearFilters: () => void;
  resultCount: number;
  totalVisibleCount: number;
}

export const SearchAndFilterBar: React.FC<SearchAndFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  filterTags,
  selectedTagIds,
  onToggleTag,
  onClearFilters,
  resultCount,
  totalVisibleCount,
}) => {
  const hasActiveFilters = selectedTagIds.length > 0;
  const isFiltering = Boolean(searchQuery.trim()) || hasActiveFilters;

  return (
    <div className="w-full bg-white border-b border-neutral-200/80 shadow-2xs">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3">
        {/* Search input bar */}
        <div className="relative flex items-center">
          <div className="absolute start-3.5 flex items-center pointer-events-none text-neutral-400">
            <Search className="w-4 h-4" />
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="ابحث عن وجبة، مشروب، أو صنف بالاسم والوصف..."
            className="w-full ps-10 pe-10 py-2.5 bg-neutral-100/90 focus:bg-white text-sm text-neutral-900 placeholder:text-neutral-600 rounded-xl border border-transparent focus:border-amber-700/40 focus:ring-2 focus:ring-amber-500/15 outline-none transition-all"
            dir="rtl"
            aria-label="بحث في قائمة الطعام"
          />

          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute end-3 p-1 text-neutral-400 hover:text-neutral-700 rounded-full hover:bg-neutral-200/70 transition-colors cursor-pointer"
              aria-label="مسح البحث"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Dynamic Filter Tag Chips */}
        {filterTags.length > 0 && (
          <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <div className="flex-shrink-0 flex items-center text-xs text-neutral-600 font-medium me-1">
              <SlidersHorizontal className="w-3.5 h-3.5 me-1 text-neutral-600" />
              <span>فلاتر:</span>
            </div>

            {filterTags.map((tag) => {
              const isSelected = selectedTagIds.includes(tag.id);
              return (
                <FilterBadge
                  key={tag.id}
                  tag={tag}
                  interactive
                  isSelected={isSelected}
                  onClick={() => onToggleTag(tag.id)}
                  onRemove={isSelected ? () => onToggleTag(tag.id) : undefined}
                  size="sm"
                />
              );
            })}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={onClearFilters}
                className="flex-shrink-0 ms-auto text-xs text-amber-700 hover:text-amber-800 font-semibold px-2 py-1 rounded-md hover:bg-amber-50 transition-colors cursor-pointer"
              >
                مسح الفلاتر
              </button>
            )}
          </div>
        )}

        {/* Multi-select explanation & active results count */}
        {isFiltering && (
          <div className="mt-2 pt-2 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
            <div className="flex items-center gap-1.5">
              <span>تم العثور على</span>
              <strong className="font-bold text-neutral-900">{resultCount}</strong>
              <span>صنف من إجمالي {totalVisibleCount}</span>
            </div>

            {selectedTagIds.length > 1 && (
              <span className="text-[11px] text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-md">
                (يتم عرض المنتجات التي تطابق أي من الفلاتر المختارة)
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
