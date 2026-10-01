/**
 * Core Data Models & Types for Restaurant & Cafe Digital Menu
 */

export interface VenueSlugAlias {
  slug: string;
  isActive: boolean;
  createdAt: string;
}

export interface Venue {
  id: string; // Internal immutable ID (never changes)
  name: string;
  slug: string; // Changeable public ID
  previousSlugs?: VenueSlugAlias[]; // Old IDs preserved as redirect aliases
  description: string;
  currency: string; // e.g. "SAR", "AED", "KWD", "EGP", "USD"
  currencySymbol?: string; // Optional display symbol override
  coverImage?: string; // URL or Data URL
  profileImage?: string; // URL or Data URL
  phone?: string;
  address?: string;
  openingHours?: string;
  socialLinks?: {
    instagram?: string;
    whatsapp?: string;
    tiktok?: string;
    googleMaps?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface FilterTag {
  id: string;
  venueId: string;
  name: string;
  emoji?: string;
  color: string; // HEX or Tailwind color token
  textColor?: string;
  displayOrder: number;
  createdAt: string;
}

export interface Category {
  id: string;
  venueId: string;
  name: string;
  description?: string;
  displayOrder: number;
  createdAt: string;
}

export interface Product {
  id: string;
  venueId: string;
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  filterTagIds: string[];
  isVisible: boolean;
  displayOrder: number;
  calories?: number;
  allergens?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MenuData {
  venue: Venue;
  categories: Category[];
  products: Product[];
  filterTags: FilterTag[];
}

export interface AdminStats {
  categoriesCount: number;
  totalProductsCount: number;
  visibleProductsCount: number;
  hiddenProductsCount: number;
  filtersCount: number;
}
