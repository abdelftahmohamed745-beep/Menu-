import React, { useState } from 'react';
import { Utensils } from 'lucide-react';

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackText?: string;
  showPlaceholderIcon?: boolean;
}

export const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  src,
  alt,
  className = '',
  fallbackText,
  showPlaceholderIcon = true,
  ...props
}) => {
  const [hasError, setHasError] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  if (!src || hasError) {
    return (
      <div
        className={`bg-neutral-100 flex flex-col items-center justify-center text-neutral-400 select-none overflow-hidden ${className}`}
        aria-label={alt || 'صورة غير متوفرة'}
      >
        {showPlaceholderIcon && <Utensils className="w-8 h-8 stroke-1 opacity-50 mb-1 text-neutral-400" />}
        {fallbackText && <span className="text-xs text-neutral-500 font-medium px-2 text-center">{fallbackText}</span>}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!isLoaded && (
        <div className="absolute inset-0 bg-neutral-200 animate-pulse" />
      )}
      <img
        src={src}
        alt={alt || ''}
        onError={() => setHasError(true)}
        onLoad={() => setIsLoaded(true)}
        loading="lazy"
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        {...props}
      />
    </div>
  );
};
