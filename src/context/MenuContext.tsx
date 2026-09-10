import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Venue, Category, Product, FilterTag, AdminStats } from '../types';
import { menuRepository } from '../repositories';

interface MenuContextValue {
  venue: Venue | null;
  allVenues: Venue[];
  categories: Category[];
  products: Product[];
  filterTags: FilterTag[];
  stats: AdminStats | null;
  isLoading: boolean;
  error: string | null;
  loadRestaurant: (idOrSlug: string) => Promise<boolean>;
  refreshData: () => Promise<void>;
  
  // Venue actions
  updateVenue: (venue: Venue) => Promise<Venue>;
  switchVenue: (venueId: string) => Promise<boolean>;
  createWorkspace: (data?: Partial<Venue>) => Promise<Venue>;
  deleteWorkspace: (venueId: string) => Promise<void>;
  
  // Category actions
  createCategory: (data: Omit<Category, 'id' | 'createdAt'>) => Promise<Category>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<Category>;
  deleteCategory: (id: string) => Promise<void>;
  reorderCategories: (categoryIds: string[]) => Promise<Category[]>;
  
  // Product actions
  createProduct: (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Product>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<Product>;
  deleteProduct: (id: string) => Promise<void>;
  toggleProductVisibility: (id: string) => Promise<Product>;
  reorderProducts: (categoryId: string, productIds: string[]) => Promise<Product[]>;
  
  // Filter tag actions
  createFilterTag: (data: Omit<FilterTag, 'id' | 'createdAt'>) => Promise<FilterTag>;
  updateFilterTag: (id: string, updates: Partial<FilterTag>) => Promise<FilterTag>;
  deleteFilterTag: (id: string) => Promise<void>;
  reorderFilterTags: (tagIds: string[]) => Promise<FilterTag[]>;

  // Reset
  resetToInitialData: () => Promise<void>;
}

const MenuContext = createContext<MenuContextValue | undefined>(undefined);

export const MenuProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [venue, setVenue] = useState<Venue | null>(null);
  const [allVenues, setAllVenues] = useState<Venue[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filterTags, setFilterTags] = useState<FilterTag[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const activeVenueIdRef = useRef<string | null>(null);
  activeVenueIdRef.current = venue?.id || null;

  // Explicitly load a specific restaurant by its ID or Slug without any fallback
  const loadRestaurant = useCallback(async (idOrSlug: string): Promise<boolean> => {
    if (!idOrSlug) {
      setVenue(null);
      setCategories([]);
      setProducts([]);
      setFilterTags([]);
      setStats(null);
      setIsLoading(false);
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);

      const targetVenue = await menuRepository.getVenueBySlug(idOrSlug);
      if (!targetVenue) {
        setVenue(null);
        setCategories([]);
        setProducts([]);
        setFilterTags([]);
        setStats(null);
        return false;
      }

      setVenue(targetVenue);

      // Strictly load subcollections belonging to this venueId only
      const [cats, prods, tags, calculatedStats] = await Promise.all([
        menuRepository.getCategories(targetVenue.id),
        menuRepository.getProducts(targetVenue.id),
        menuRepository.getFilterTags(targetVenue.id),
        menuRepository.getAdminStats(targetVenue.id),
      ]);

      setCategories(cats);
      setProducts(prods);
      setFilterTags(tags);
      setStats(calculatedStats);
      return true;
    } catch (err: unknown) {
      console.error('Error loading restaurant:', err);
      const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء تحميل بيانات المطعم';
      setError(msg);
      setVenue(null);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh current active restaurant's data
  const refreshData = useCallback(async (): Promise<void> => {
    const currentId = activeVenueIdRef.current;
    if (currentId) {
      await loadRestaurant(currentId);
    }
  }, [loadRestaurant]);

  // Load all venues list for the admin workspaces list if needed
  const fetchAllVenues = useCallback(async () => {
    try {
      const list = await menuRepository.getAllVenues();
      setAllVenues(list);
    } catch (err) {
      console.error('Failed to list all venues:', err);
    }
  }, []);

  useEffect(() => {
    fetchAllVenues();

    const handleDataChanged = () => {
      if (activeVenueIdRef.current) {
        loadRestaurant(activeVenueIdRef.current);
      }
      fetchAllVenues();
    };

    window.addEventListener('menu_data_changed', handleDataChanged);
    return () => {
      window.removeEventListener('menu_data_changed', handleDataChanged);
    };
  }, [fetchAllVenues, loadRestaurant]);

  // Venue actions
  const updateVenue = async (newVenue: Venue): Promise<Venue> => {
    const updated = await menuRepository.updateVenue(newVenue);
    setVenue(updated);
    await fetchAllVenues();
    return updated;
  };

  const switchVenue = async (venueId: string): Promise<boolean> => {
    return await loadRestaurant(venueId);
  };

  const createWorkspace = async (data?: Partial<Venue>): Promise<Venue> => {
    const created = await menuRepository.createVenue(data);
    await loadRestaurant(created.id);
    await fetchAllVenues();
    return created;
  };

  const deleteWorkspace = async (venueId: string): Promise<void> => {
    await menuRepository.deleteVenue(venueId);
    if (activeVenueIdRef.current === venueId) {
      setVenue(null);
      setCategories([]);
      setProducts([]);
      setFilterTags([]);
      setStats(null);
    }
    await fetchAllVenues();
  };

  // Category actions strictly scoped to active venue
  const createCategory = async (data: Omit<Category, 'id' | 'createdAt'>): Promise<Category> => {
    if (!venue) throw new Error('لا يوجد مطعم نشط لإضافة القسم');
    const created = await menuRepository.createCategory({
      ...data,
      venueId: data.venueId || venue.id,
    });
    await loadRestaurant(venue.id);
    return created;
  };

  const updateCategory = async (id: string, updates: Partial<Category>): Promise<Category> => {
    if (!venue) throw new Error('لا يوجد مطعم نشط لتعديل القسم');
    const updated = await menuRepository.updateCategory(id, updates);
    await loadRestaurant(venue.id);
    return updated;
  };

  const deleteCategory = async (id: string): Promise<void> => {
    if (!venue) throw new Error('لا يوجد مطعم نشط لحذف القسم');
    await menuRepository.deleteCategory(id);
    await loadRestaurant(venue.id);
  };

  const reorderCategories = async (categoryIds: string[]): Promise<Category[]> => {
    if (!venue) return [];
    const reordered = await menuRepository.reorderCategories(venue.id, categoryIds);
    setCategories(reordered);
    return reordered;
  };

  // Product actions strictly scoped to active venue
  const createProduct = async (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> => {
    if (!venue) throw new Error('لا يوجد مطعم نشط لإضافة الصنف');
    const created = await menuRepository.createProduct({
      ...data,
      venueId: data.venueId || venue.id,
    });
    await loadRestaurant(venue.id);
    return created;
  };

  const updateProduct = async (id: string, updates: Partial<Product>): Promise<Product> => {
    if (!venue) throw new Error('لا يوجد مطعم نشط لتعديل الصنف');
    const updated = await menuRepository.updateProduct(id, updates);
    await loadRestaurant(venue.id);
    return updated;
  };

  const deleteProduct = async (id: string): Promise<void> => {
    if (!venue) throw new Error('لا يوجد مطعم نشط لحذف الصنف');
    await menuRepository.deleteProduct(id);
    await loadRestaurant(venue.id);
  };

  const toggleProductVisibility = async (id: string): Promise<Product> => {
    if (!venue) throw new Error('لا يوجد مطعم نشط لتعديل الصنف');
    const updated = await menuRepository.toggleProductVisibility(id);
    await loadRestaurant(venue.id);
    return updated;
  };

  const reorderProducts = async (categoryId: string, productIds: string[]): Promise<Product[]> => {
    if (!venue) return [];
    const updated = await menuRepository.reorderProducts(venue.id, categoryId, productIds);
    await loadRestaurant(venue.id);
    return updated;
  };

  // Filter tag actions strictly scoped to active venue
  const createFilterTag = async (data: Omit<FilterTag, 'id' | 'createdAt'>): Promise<FilterTag> => {
    if (!venue) throw new Error('لا يوجد مطعم نشط لإضافة الفلتر');
    const created = await menuRepository.createFilterTag({
      ...data,
      venueId: data.venueId || venue.id,
    });
    await loadRestaurant(venue.id);
    return created;
  };

  const updateFilterTag = async (id: string, updates: Partial<FilterTag>): Promise<FilterTag> => {
    if (!venue) throw new Error('لا يوجد مطعم نشط لتعديل الفلتر');
    const updated = await menuRepository.updateFilterTag(id, updates);
    await loadRestaurant(venue.id);
    return updated;
  };

  const deleteFilterTag = async (id: string): Promise<void> => {
    if (!venue) throw new Error('لا يوجد مطعم نشط لحذف الفلتر');
    await menuRepository.deleteFilterTag(id);
    await loadRestaurant(venue.id);
  };

  const reorderFilterTags = async (tagIds: string[]): Promise<FilterTag[]> => {
    if (!venue) return [];
    const reordered = await menuRepository.reorderFilterTags(venue.id, tagIds);
    setFilterTags(reordered);
    return reordered;
  };

  const resetToInitialData = async (): Promise<void> => {
    if (!venue) throw new Error('لا يوجد مطعم نشط لإعادة التعيين');
    await menuRepository.resetToInitialData(venue.id);
    await loadRestaurant(venue.id);
  };

  const value: MenuContextValue = {
    venue,
    allVenues,
    categories,
    products,
    filterTags,
    stats,
    isLoading,
    error,
    loadRestaurant,
    refreshData,
    updateVenue,
    switchVenue,
    createWorkspace,
    deleteWorkspace,
    createCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    createProduct,
    updateProduct,
    deleteProduct,
    toggleProductVisibility,
    reorderProducts,
    createFilterTag,
    updateFilterTag,
    deleteFilterTag,
    reorderFilterTags,
    resetToInitialData,
  };

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
};

export const useMenu = (): MenuContextValue => {
  const context = useContext(MenuContext);
  if (!context) {
    throw new Error('useMenu must be used within a MenuProvider');
  }
  return context;
};
