import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  refreshData: () => Promise<void>;
  
  // Venue actions
  updateVenue: (venue: Venue) => Promise<Venue>;
  switchVenue: (venueId: string) => Promise<void>;
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
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async (targetVenueId?: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // 1. Fetch all venues
      const venuesList = await menuRepository.getAllVenues();
      setAllVenues(venuesList);

      // 2. Select active venue
      let activeVenue: Venue | null = null;
      const desiredId = targetVenueId || sessionStorage.getItem('active_admin_venue_id') || localStorage.getItem('my_menu_workspace_id');

      if (desiredId) {
        activeVenue = await menuRepository.getVenueById(desiredId);
      }

      if (!activeVenue && venuesList.length > 0) {
        activeVenue = venuesList[0];
      }

      if (!activeVenue) {
        activeVenue = await menuRepository.getOrCreateUserWorkspace();
      }

      setVenue(activeVenue);
      if (activeVenue) {
        sessionStorage.setItem('active_admin_venue_id', activeVenue.id);
        const [cats, prods, tags, calculatedStats] = await Promise.all([
          menuRepository.getCategories(activeVenue.id),
          menuRepository.getProducts(activeVenue.id),
          menuRepository.getFilterTags(activeVenue.id),
          menuRepository.getAdminStats(activeVenue.id),
        ]);

        setCategories(cats);
        setProducts(prods);
        setFilterTags(tags);
        setStats(calculatedStats);
      }
    } catch (err: unknown) {
      console.error('Error loading menu context data:', err);
      const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء تحميل البيانات';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();

    const handleDataChanged = () => {
      loadAll();
    };

    window.addEventListener('menu_data_changed', handleDataChanged);
    window.addEventListener('storage', handleDataChanged);

    return () => {
      window.removeEventListener('menu_data_changed', handleDataChanged);
      window.removeEventListener('storage', handleDataChanged);
    };
  }, [loadAll]);

  // Venue actions
  const updateVenue = async (newVenue: Venue): Promise<Venue> => {
    const updated = await menuRepository.updateVenue(newVenue);
    setVenue(updated);
    const list = await menuRepository.getAllVenues();
    setAllVenues(list);
    return updated;
  };

  const switchVenue = async (venueId: string): Promise<void> => {
    sessionStorage.setItem('active_admin_venue_id', venueId);
    await loadAll(venueId);
  };

  const createWorkspace = async (data?: Partial<Venue>): Promise<Venue> => {
    const created = await menuRepository.createVenue(data);
    await switchVenue(created.id);
    return created;
  };

  const deleteWorkspace = async (venueId: string): Promise<void> => {
    await menuRepository.deleteVenue(venueId);
    sessionStorage.removeItem('active_admin_venue_id');
    await loadAll();
  };

  // Category actions
  const createCategory = async (data: Omit<Category, 'id' | 'createdAt'>): Promise<Category> => {
    const created = await menuRepository.createCategory(data);
    await loadAll();
    return created;
  };

  const updateCategory = async (id: string, updates: Partial<Category>): Promise<Category> => {
    const updated = await menuRepository.updateCategory(id, updates);
    await loadAll();
    return updated;
  };

  const deleteCategory = async (id: string): Promise<void> => {
    await menuRepository.deleteCategory(id);
    await loadAll();
  };

  const reorderCategories = async (categoryIds: string[]): Promise<Category[]> => {
    if (!venue) return [];
    const reordered = await menuRepository.reorderCategories(venue.id, categoryIds);
    setCategories(reordered);
    return reordered;
  };

  // Product actions
  const createProduct = async (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> => {
    const created = await menuRepository.createProduct(data);
    await loadAll();
    return created;
  };

  const updateProduct = async (id: string, updates: Partial<Product>): Promise<Product> => {
    const updated = await menuRepository.updateProduct(id, updates);
    await loadAll();
    return updated;
  };

  const deleteProduct = async (id: string): Promise<void> => {
    await menuRepository.deleteProduct(id);
    await loadAll();
  };

  const toggleProductVisibility = async (id: string): Promise<Product> => {
    const updated = await menuRepository.toggleProductVisibility(id);
    await loadAll();
    return updated;
  };

  const reorderProducts = async (categoryId: string, productIds: string[]): Promise<Product[]> => {
    if (!venue) return [];
    const updated = await menuRepository.reorderProducts(venue.id, categoryId, productIds);
    await loadAll();
    return updated;
  };

  // Filter tag actions
  const createFilterTag = async (data: Omit<FilterTag, 'id' | 'createdAt'>): Promise<FilterTag> => {
    const created = await menuRepository.createFilterTag(data);
    await loadAll();
    return created;
  };

  const updateFilterTag = async (id: string, updates: Partial<FilterTag>): Promise<FilterTag> => {
    const updated = await menuRepository.updateFilterTag(id, updates);
    await loadAll();
    return updated;
  };

  const deleteFilterTag = async (id: string): Promise<void> => {
    await menuRepository.deleteFilterTag(id);
    await loadAll();
  };

  const reorderFilterTags = async (tagIds: string[]): Promise<FilterTag[]> => {
    if (!venue) return [];
    const reordered = await menuRepository.reorderFilterTags(venue.id, tagIds);
    setFilterTags(reordered);
    return reordered;
  };

  const resetToInitialData = async (): Promise<void> => {
    await menuRepository.resetToInitialData();
    await loadAll();
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
    refreshData: loadAll,
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
