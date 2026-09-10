import React from 'react';
import { FilterTag } from '../../types';
import { getColorPreset } from '../../utils/colors';
import { X } from 'lucide-react';

interface FilterBadgeProps {
  tag: FilterTag;
  isSelected?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

export const FilterBadge: React.FC<FilterBadgeProps> = ({
  tag,
  isSelected = false,
  onClick,
  onRemove,
  size = 'md',
  interactive = false,
}) => {
  const preset = getColorPreset(tag.color);

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-1 text-xs sm:text-sm gap-1.5',
    lg: 'px-3.5 py-1.5 text-sm gap-2',
  }[size];

  // If used as a toggle chip in customer menu
  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={isSelected}
        className={`inline-flex items-center rounded-full font-medium transition-all duration-200 cursor-pointer select-none border whitespace-nowrap ${sizeClasses} ${
          isSelected
            ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
            : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
        }`}
      >
        {tag.emoji && <span className="text-sm leading-none">{tag.emoji}</span>}
        <span>{tag.name}</span>
        {isSelected && onRemove && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="ms-1 hover:text-red-300"
            role="button"
            aria-label={`إلغاء تصفية ${tag.name}`}
          >
            <X className="w-3 h-3" />
          </span>
        )}
      </button>
    );
  }

  // Display tag badge
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium border whitespace-nowrap ${sizeClasses} ${preset.badgeClass}`}
      style={{
        backgroundColor: preset.bg,
        color: preset.textColor,
        borderColor: preset.border,
      }}
    >
      {tag.emoji && <span className="leading-none">{tag.emoji}</span>}
      <span>{tag.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ms-1 p-0.5 hover:bg-black/10 rounded-full transition-colors cursor-pointer"
          aria-label={`حذف فلتر ${tag.name}`}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
};
