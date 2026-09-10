import { Venue, Category, Product, FilterTag, MenuData, AdminStats } from '../types';

export interface IMenuRepository {
  // Venue & Workspaces
  getAllVenues(): Promise<Venue[]>;
  getVenueBySlug(slug: string): Promise<Venue | null>;
  getVenueById(id: string): Promise<Venue | null>;
  createVenue(data?: Partial<Venue>): Promise<Venue>;
  updateVenue(venue: Venue): Promise<Venue>;
  deleteVenue(id: string): Promise<void>;
  isSlugAvailable(slug: string, currentVenueId: string): Promise<boolean>;
  getOrCreateUserWorkspace(): Promise<Venue>;

  // Categories
  getCategories(venueId: string): Promise<Category[]>;
  createCategory(category: Omit<Category, 'id' | 'createdAt'>): Promise<Category>;
  updateCategory(id: string, updates: Partial<Category>): Promise<Category>;
  deleteCategory(id: string): Promise<void>;
  reorderCategories(venueId: string, categoryIds: string[]): Promise<Category[]>;

  // Products
  getProducts(venueId: string): Promise<Product[]>;
  createProduct(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product>;
  updateProduct(id: string, updates: Partial<Product>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  toggleProductVisibility(id: string): Promise<Product>;
  reorderProducts(venueId: string, categoryId: string, productIds: string[]): Promise<Product[]>;

  // Filter Tags
  getFilterTags(venueId: string): Promise<FilterTag[]>;
  createFilterTag(tag: Omit<FilterTag, 'id' | 'createdAt'>): Promise<FilterTag>;
  updateFilterTag(id: string, updates: Partial<FilterTag>): Promise<FilterTag>;
  deleteFilterTag(id: string): Promise<void>;
  reorderFilterTags(venueId: string, tagIds: string[]): Promise<FilterTag[]>;

  // Aggregated
  getMenuDataBySlug(slug: string): Promise<MenuData | null>;
  getAdminStats(venueId: string): Promise<AdminStats>;
  resetToInitialData(venueId?: string): Promise<MenuData>;
}
