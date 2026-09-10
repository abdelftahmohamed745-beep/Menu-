import React from 'react';
import { Product, FilterTag } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { FilterBadge } from '../common/FilterBadge';
import { BottomSheet } from '../common/BottomSheet';
import { Flame, X } from 'lucide-react';

interface ProductDetailModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  currency: string;
  filterTags: FilterTag[];
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  isOpen,
  onClose,
  currency,
  filterTags,
}) => {
  if (!product) return null;

  const formattedPrice = formatCurrency(product.price, currency);
  const matchedTags = filterTags.filter((t) =>
    product.filterTagIds?.includes(t.id)
  );

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={product.name}>
      <div className="flex flex-col gap-4">
        {/* Full Image if available */}
        {product.image && (
          <div className="w-full h-52 sm:h-64 rounded-2xl overflow-hidden bg-neutral-100 shadow-inner">
            <ImageWithFallback
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover"
              showPlaceholderIcon={false}
            />
          </div>
        )}

        {/* Header with price and calories */}
        <div className="flex items-center justify-between gap-4 pt-1">
          <span className="text-2xl font-extrabold text-neutral-900 tracking-tight">
            {formattedPrice}
          </span>

          {product.calories && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 rounded-full text-xs font-semibold">
              <Flame className="w-3.5 h-3.5 text-amber-600" />
              <span>{product.calories} سعرة حرارية</span>
            </span>
          )}
        </div>

        {/* Filter Badges */}
        {matchedTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {matchedTags.map((tag) => (
              <FilterBadge key={tag.id} tag={tag} size="md" />
            ))}
          </div>
        )}

        {/* Full Description */}
        {product.description && (
          <div className="mt-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-600 mb-1.5">
              الوصف والتفاصيل
            </h4>
            <p className="text-sm sm:text-base text-neutral-700 leading-relaxed whitespace-pre-line">
              {product.description}
            </p>
          </div>
        )}

        {/* Bottom dismiss button */}
        <div className="mt-6 pt-4 border-t border-neutral-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-semibold rounded-xl text-sm transition-colors cursor-pointer"
          >
            إغلاق التفاصيل
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};
