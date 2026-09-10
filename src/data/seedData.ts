import { Venue, Category, Product, FilterTag, MenuData } from '../types';

export const INITIAL_VENUE: Venue = {
  id: 'venue_main',
  name: 'مطعمي',
  slug: 'my-restaurant',
  description: 'مرحباً بكم في قائمتنا الرقمية',
  currency: 'SAR',
  currencySymbol: 'ر.س',
  coverImage: '',
  profileImage: '',
  phone: '',
  address: '',
  openingHours: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const INITIAL_FILTER_TAGS: FilterTag[] = [];
export const INITIAL_CATEGORIES: Category[] = [];
export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_MENU_DATA: MenuData = {
  venue: INITIAL_VENUE,
  categories: INITIAL_CATEGORIES,
  products: INITIAL_PRODUCTS,
  filterTags: INITIAL_FILTER_TAGS,
};
