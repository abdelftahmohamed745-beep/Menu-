import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Venue, Category, Product, FilterTag, MenuData, AdminStats } from '../types';
import { IMenuRepository } from './IMenuRepository';

export const CLEAN_DEFAULT_VENUE: Venue = {
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

function removeUndefined<T extends Record<string, any>>(obj: T): Record<string, any> {
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export class FirestoreMenuRepository implements IMenuRepository {
  // ----------------------------------------------------
  // Venue & Workspaces
  // ----------------------------------------------------
  async getAllVenues(): Promise<Venue[]> {
    const path = 'venues';
    try {
      const snapshot = await getDocs(collection(db, 'venues'));
      const venues: Venue[] = [];
      snapshot.forEach((d) => {
        venues.push(d.data() as Venue);
      });
      return venues.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }

  async createVenue(data?: Partial<Venue>): Promise<Venue> {
    const id = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const randomSuffix = Math.random().toString(36).slice(2, 7);
    const slug = data?.slug || `menu-${randomSuffix}`;
    const path = `venues/${id}`;

    const newVenue: Venue = {
      id,
      name: data?.name || 'مطعمي',
      slug,
      description: data?.description || 'مرحباً بكم في قائمتنا الرقمية',
      currency: data?.currency || 'SAR',
      currencySymbol: data?.currencySymbol || 'ر.س',
      coverImage: data?.coverImage || '',
      profileImage: data?.profileImage || '',
      phone: data?.phone || '',
      address: data?.address || '',
      openingHours: data?.openingHours || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
    };

    try {
      await setDoc(doc(db, 'venues', id), removeUndefined(newVenue));
      window.dispatchEvent(new CustomEvent('menu_data_changed'));
      return newVenue;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  async deleteVenue(id: string): Promise<void> {
    const path = `venues/${id}`;
    try {
      // 1. Delete all categories for this venue
      const catQuery = query(collection(db, 'categories'), where('venueId', '==', id));
      const catSnap = await getDocs(catQuery);
      const batch = writeBatch(db);
      catSnap.forEach((d) => batch.delete(doc(db, 'categories', d.id)));

      // 2. Delete all products for this venue
      const prodQuery = query(collection(db, 'products'), where('venueId', '==', id));
      const prodSnap = await getDocs(prodQuery);
      prodSnap.forEach((d) => batch.delete(doc(db, 'products', d.id)));

      // 3. Delete all filterTags for this venue
      const tagQuery = query(collection(db, 'filterTags'), where('venueId', '==', id));
      const tagSnap = await getDocs(tagQuery);
      tagSnap.forEach((d) => batch.delete(doc(db, 'filterTags', d.id)));

      // 4. Delete the venue document
      batch.delete(doc(db, 'venues', id));
      await batch.commit();

      window.dispatchEvent(new CustomEvent('menu_data_changed'));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  async getOrCreateUserWorkspace(): Promise<Venue> {
    const STORAGE_KEY = 'my_menu_workspace_id';
    let localId: string | null = null;
    try {
      localId = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage unavailable
    }

    if (localId) {
      const existing = await this.getVenueById(localId);
      if (existing) {
        return existing;
      }
    }

    // Otherwise create a completely clean, isolated, empty workspace for this new user
    const newVenue = await this.createVenue();
    try {
      localStorage.setItem(STORAGE_KEY, newVenue.id);
    } catch {
      // Fallback
    }
    return newVenue;
  }

  async getVenueById(id: string): Promise<Venue | null> {
    const path = `venues/${id}`;
    try {
      const docRef = doc(db, 'venues', id);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return snapshot.data() as Venue;
      }

      // If main venue doesn't exist yet, seed the clean default venue
      if (id === 'venue_main' || id === 'venue_al_areej') {
        const initialVenue: Venue = {
          ...CLEAN_DEFAULT_VENUE,
          id: id,
        };
        await setDoc(docRef, removeUndefined(initialVenue));
        return initialVenue;
      }

      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  async getVenueBySlug(slug: string): Promise<Venue | null> {
    const path = 'venues';
    try {
      const q = query(collection(db, 'venues'), where('slug', '==', slug));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        return snapshot.docs[0].data() as Venue;
      }

      // If fallback for initial default slug
      if (slug === 'my-restaurant') {
        return await this.getVenueById('venue_main');
      }

      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }

  async updateVenue(venue: Venue): Promise<Venue> {
    const path = `venues/${venue.id}`;
    try {
      const updated: Venue = {
        ...venue,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'venues', venue.id), removeUndefined(updated), { merge: true });
      window.dispatchEvent(new CustomEvent('menu_data_changed'));
      return updated;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async isSlugAvailable(slug: string, currentVenueId: string): Promise<boolean> {
    const path = 'venues';
    try {
      const q = query(collection(db, 'venues'), where('slug', '==', slug));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return true;
      return snapshot.docs.every((d) => d.id === currentVenueId);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }

  // ----------------------------------------------------
  // Categories
  // ----------------------------------------------------
  async getCategories(venueId: string): Promise<Category[]> {
    const path = 'categories';
    try {
      const q = query(collection(db, 'categories'), where('venueId', '==', venueId));
      const snapshot = await getDocs(q);
      const items: Category[] = [];
      snapshot.forEach((d) => {
        items.push(d.data() as Category);
      });
      return items.sort((a, b) => a.displayOrder - b.displayOrder);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }

  async createCategory(data: Omit<Category, 'id' | 'createdAt'>): Promise<Category> {
    const id = `cat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const path = `categories/${id}`;
    try {
      const newCategory: Category = {
        ...data,
        id,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'categories', id), removeUndefined(newCategory));
      window.dispatchEvent(new CustomEvent('menu_data_changed'));
      return newCategory;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  async updateCategory(id: string, updates: Partial<Category>): Promise<Category> {
    const path = `categories/${id}`;
    try {
      const docRef = doc(db, 'categories', id);
      await updateDoc(docRef, removeUndefined(updates));
      const updatedSnap = await getDoc(docRef);
      window.dispatchEvent(new CustomEvent('menu_data_changed'));
      return updatedSnap.data() as Category;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async deleteCategory(id: string): Promise<void> {
    const path = `categories/${id}`;
    try {
      await deleteDoc(doc(db, 'categories', id));
      window.dispatchEvent(new CustomEvent('menu_data_changed'));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  async reorderCategories(venueId: string, categoryIds: string[]): Promise<Category[]> {
    const path = 'categories';
    try {
      const batch = writeBatch(db);
      categoryIds.forEach((id, index) => {
        const ref = doc(db, 'categories', id);
        batch.update(ref, { displayOrder: index + 1 });
      });
      await batch.commit();
      window.dispatchEvent(new CustomEvent('menu_data_changed'));
      return await this.getCategories(venueId);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  // ----------------------------------------------------
  // Products
  // ----------------------------------------------------
  async getProducts(venueId: string): Promise<Product[]> {
    const path = 'products';
    try {
      const q = query(collection(db, 'products'), where('venueId', '==', venueId));
      const snapshot = await getDocs(q);
      const items: Product[] = [];
      snapshot.forEach((d) => {
        items.push(d.data() as Product);
      });
      return items.sort((a, b) => a.displayOrder - b.displayOrder);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }

  async createProduct(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    const id = `prod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const path = `products/${id}`;
    try {
      const newProduct: Product = {
        ...data,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'products', id), removeUndefined(newProduct));
      window.dispatchEvent(new CustomEvent('menu_data_changed'));
      return newProduct;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    const path = `products/${id}`;
    try {
      const docRef = doc(db, 'products', id);
      const payload = {
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      await updateDoc(docRef, removeUndefined(payload));
      const updatedSnap = await getDoc(docRef);
      window.dispatchEvent(new CustomEvent('menu_data_changed'));
      return updatedSnap.data() as Product;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async deleteProduct(id: string): Promise<void> {
    const path = `products/${id}`;
    try {
      await deleteDoc(doc(db, 'products', id));
      window.dispatchEvent(new CustomEvent('menu_data_changed'));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  async toggleProductVisibility(id: string): Promise<Product> {
    const path = `products/${id}`;
    try {
      const docRef = doc(db, 'products', id);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        throw new Error('المنتج غير موجود');
      }
      const current = snap.data() as Product;
      const isVisible = !current.isVisible;
      await updateDoc(docRef, { isVisible, updatedAt: new Date().toISOString() });
      window.dispatchEvent(new CustomEvent('menu_data_changed'));
      return { ...current, isVisible };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async reorderProducts(venueId: string, categoryId: string, productIds: string[]): Promise<Product[]> {
    const path = 'products';
    try {
      const batch = writeBatch(db);
      productIds.forEach((id, index) => {
        const ref = doc(db, 'products', id);
        batch.update(ref, { displayOrder: index + 1 });
      });
      await batch.commit();
      window.dispatchEvent(new CustomEvent('menu_data_changed'));
      return await this.getProducts(venueId);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  // ----------------------------------------------------
  // Filter Tags
  // ----------------------------------------------------
  async getFilterTags(venueId: string): Promise<FilterTag[]> {
    const path = 'filterTags';
    try {
      const q = query(collection(db, 'filterTags'), where('venueId', '==', venueId));
      const snapshot = await getDocs(q);
      const items: FilterTag[] = [];
      snapshot.forEach((d) => {
        items.push(d.data() as FilterTag);
      });
      return items.sort((a, b) => a.displayOrder - b.displayOrder);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }

  async createFilterTag(data: Omit<FilterTag, 'id' | 'createdAt'>): Promise<FilterTag> {
    const id = `tag_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const path = `filterTags/${id}`;
    try {
      const newTag: FilterTag = {
        ...data,
        id,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'filterTags', id), removeUndefined(newTag));
      window.dispatchEvent(new CustomEvent('menu_data_changed'));
      return newTag;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  async updateFilterTag(id: string, updates: Partial<FilterTag>): Promise<FilterTag> {
    const path = `filterTags/${id}`;
    try {
      const docRef = doc(db, 'filterTags', id);
      await updateDoc(docRef, removeUndefined(updates));
      const snap = await getDoc(docRef);
      window.dispatchEvent(new CustomEvent('menu_data_changed'));
      return snap.data() as FilterTag;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  async deleteFilterTag(id: string): Promise<void> {
    const path = `filterTags/${id}`;
    try {
      await deleteDoc(doc(db, 'filterTags', id));

      // Also clean up this tag from any products
      const productsSnap = await getDocs(collection(db, 'products'));
      const batch = writeBatch(db);
      let hasUpdates = false;

      productsSnap.forEach((d) => {
        const prod = d.data() as Product;
        if (prod.filterTagIds?.includes(id)) {
          const updatedTags = prod.filterTagIds.filter((t) => t !== id);
          batch.update(doc(db, 'products', prod.id), { filterTagIds: updatedTags });
          hasUpdates = true;
        }
      });

      if (hasUpdates) {
        await batch.commit();
      }

      window.dispatchEvent(new CustomEvent('menu_data_changed'));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  async reorderFilterTags(venueId: string, tagIds: string[]): Promise<FilterTag[]> {
    const path = 'filterTags';
    try {
      const batch = writeBatch(db);
      tagIds.forEach((id, index) => {
        const ref = doc(db, 'filterTags', id);
        batch.update(ref, { displayOrder: index + 1 });
      });
      await batch.commit();
      window.dispatchEvent(new CustomEvent('menu_data_changed'));
      return await this.getFilterTags(venueId);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }

  // ----------------------------------------------------
  // Aggregated
  // ----------------------------------------------------
  async getMenuDataBySlug(slug: string): Promise<MenuData | null> {
    const venue = await this.getVenueBySlug(slug);
    if (!venue) return null;

    const [categories, products, filterTags] = await Promise.all([
      this.getCategories(venue.id),
      this.getProducts(venue.id),
      this.getFilterTags(venue.id),
    ]);

    return {
      venue,
      categories,
      products,
      filterTags,
    };
  }

  async getAdminStats(venueId: string): Promise<AdminStats> {
    const [categories, products, filterTags] = await Promise.all([
      this.getCategories(venueId),
      this.getProducts(venueId),
      this.getFilterTags(venueId),
    ]);

    const visibleProductsCount = products.filter((p) => p.isVisible).length;
    const hiddenProductsCount = products.filter((p) => !p.isVisible).length;

    return {
      categoriesCount: categories.length,
      totalProductsCount: products.length,
      visibleProductsCount,
      hiddenProductsCount,
      filtersCount: filterTags.length,
    };
  }

  async resetToInitialData(): Promise<MenuData> {
    // Reset to clean empty database state for this venue
    const venue = await this.getVenueById('venue_main');
    if (!venue) {
      await setDoc(doc(db, 'venues', 'venue_main'), removeUndefined(CLEAN_DEFAULT_VENUE));
    }

    return {
      venue: venue || CLEAN_DEFAULT_VENUE,
      categories: [],
      products: [],
      filterTags: [],
    };
  }
}

export const firestoreMenuRepository = new FirestoreMenuRepository();
