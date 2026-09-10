import React from 'react';
import { Venue } from '../../types';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { Clock, MapPin, Phone, Instagram, Coffee, Store } from 'lucide-react';

interface CustomerHeaderProps {
  venue: Venue;
}

export const CustomerHeader: React.FC<CustomerHeaderProps> = ({ venue }) => {
  const hasCover = Boolean(venue.coverImage && venue.coverImage.trim());
  const hasProfile = Boolean(venue.profileImage && venue.profileImage.trim());

  return (
    <header className="relative w-full bg-white border-b border-neutral-100 shadow-xs">
      {/* 1. Cover image container */}
      {hasCover ? (
        <div className="relative w-full h-44 sm:h-60 md:h-72 bg-neutral-200 overflow-hidden">
          <ImageWithFallback
            src={venue.coverImage}
            alt={`غلاف ${venue.name}`}
            className="w-full h-full object-cover"
            showPlaceholderIcon={false}
          />
          {/* Subtle gradient overlay at bottom of cover for text contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </div>
      ) : (
        // Minimal subtle banner pattern if no cover image
        <div className="w-full h-16 sm:h-24 bg-gradient-to-r from-amber-700/10 via-amber-600/10 to-amber-800/10 border-b border-amber-900/5 flex items-center justify-center">
          <Store className="w-8 h-8 text-amber-800/20 stroke-1" />
        </div>
      )}

      {/* 2. Content Info section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-5">
        <div className="relative flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
          
          {/* Profile Logo overlapping cover if cover exists */}
          <div className="flex items-end gap-3.5 -mt-10 sm:-mt-14 z-10">
            {hasProfile ? (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl p-1 bg-white shadow-md border border-neutral-100 flex-shrink-0">
                <ImageWithFallback
                  src={venue.profileImage}
                  alt={`شعار ${venue.name}`}
                  className="w-full h-full rounded-xl object-cover bg-neutral-50"
                  fallbackText={venue.name.slice(0, 2)}
                />
              </div>
            ) : (
              // If no profile image, but cover exists, show a refined monogram
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl p-1 bg-white shadow-md border border-neutral-100 flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-amber-600 to-amber-800 text-white font-bold text-2xl sm:text-3xl">
                {venue.name ? venue.name.trim().charAt(0) : <Coffee className="w-7 h-7" />}
              </div>
            )}

            <div className="pt-2">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-neutral-900 tracking-tight">
                {venue.name}
              </h1>
            </div>
          </div>

          {/* Quick info pills (phone, instagram) */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
            {venue.phone && (
              <a
                href={`tel:${venue.phone}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 rounded-full transition-colors text-neutral-700"
                aria-label="رقم الهاتف"
              >
                <Phone className="w-3.5 h-3.5 text-neutral-500" />
                <span dir="ltr">{venue.phone}</span>
              </a>
            )}
            {venue.socialLinks?.instagram && (
              <a
                href={`https://instagram.com/${venue.socialLinks.instagram}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 rounded-full transition-colors text-neutral-700"
                aria-label="انستغرام"
              >
                <Instagram className="w-3.5 h-3.5 text-pink-600" />
                <span dir="ltr">@{venue.socialLinks.instagram}</span>
              </a>
            )}
          </div>
        </div>

        {/* Description */}
        {venue.description && (
          <p className="mt-3.5 text-sm sm:text-base text-neutral-600 leading-relaxed max-w-3xl">
            {venue.description}
          </p>
        )}

        {/* Address and Opening Hours */}
        {(venue.address || venue.openingHours) && (
          <div className="mt-3 pt-3 border-t border-neutral-100 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-neutral-500">
            {venue.address && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
                <span>{venue.address}</span>
              </div>
            )}
            {venue.openingHours && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
                <span>{venue.openingHours}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
