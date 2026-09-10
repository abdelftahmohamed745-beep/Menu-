import React from 'react';
import { Product, FilterTag } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { FilterBadge } from '../common/FilterBadge';
import { Flame } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  currency: string;
  filterTags: FilterTag[];
  onClick: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  currency,
  filterTags,
  onClick,
}) => {
  const hasImage = Boolean(product.image && product.image.trim());
  const formattedPrice = formatCurrency(product.price, currency);

  // Match tags
  const matchedTags = filterTags.filter((t) =>
    product.filterTagIds?.includes(t.id)
  );

  return (
    <article
      onClick={() => onClick(product)}
      className="group relative bg-white rounded-2xl p-4 border border-neutral-200/80 hover:border-neutral-300 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden"
    >
      <div className="flex gap-4">
        {/* Text Info */}
        <div className="flex-1 flex flex-col justify-between min-w-0">
          <div>
            {/* Tag badges */}
            {matchedTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {matchedTags.map((tag) => (
                  <FilterBadge key={tag.id} tag={tag} size="sm" />
                ))}
              </div>
            )}

            {/* Product Name */}
            <h3 className="text-base font-bold text-neutral-900 group-hover:text-amber-800 transition-colors line-clamp-2 mb-1">
              {product.name}
            </h3>

            {/* Description */}
            {product.description && (
              <p className="text-xs sm:text-sm text-neutral-500 line-clamp-2 leading-relaxed mb-3">
                {product.description}
              </p>
            )}
          </div>

          {/* Bottom row: Price & optional calories */}
          <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-neutral-100">
            <span className="text-base font-extrabold text-neutral-900 tracking-tight">
              {formattedPrice}
            </span>

            {product.calories && (
              <span className="inline-flex items-center gap-1 text-xs text-neutral-600">
                <Flame className="w-3 h-3 text-amber-500" />
                <span>{product.calories} سعرة</span>
              </span>
            )}
          </div>
        </div>

        {/* Optional Image */}
        {hasImage && (
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden flex-shrink-0 bg-neutral-100 shadow-2xs">
            <ImageWithFallback
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              showPlaceholderIcon={false}
            />
          </div>
        )}
      </div>
    </article>
  );
};
