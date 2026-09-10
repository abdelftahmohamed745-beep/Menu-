import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMenu } from '../context/MenuContext';
import { Product } from '../types';
import { formatCurrency } from '../utils/formatters';
import { ImageWithFallback } from '../components/common/ImageWithFallback';
import { FilterBadge } from '../components/common/FilterBadge';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { EmptyState } from '../components/common/EmptyState';
import {
  Plus,
  Search,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Flame,
  X,
} from 'lucide-react';

export const AdminProductsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    products,
    categories,
    filterTags,
    venue,
    createProduct,
    updateProduct,
    deleteProduct,
    toggleProductVisibility,
  } = useMenu();

  // Search & Filter controls
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'visible' | 'hidden'>('all');

  // Modal form state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [name, setName] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [image, setImage] = useState<string>('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [calories, setCalories] = useState<string>('');

  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Deletion target
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  // Auto-open new modal if URL has ?action=new
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      openAddModal();
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const openAddModal = () => {
    setEditingProduct(null);
    setName('');
    setCategoryId(categories.length > 0 ? categories[0].id : '');
    setPrice('');
    setDescription('');
    setImage('');
    setSelectedTagIds([]);
    setIsVisible(true);
    setCalories('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setCategoryId(product.categoryId);
    setPrice(product.price.toString());
    setDescription(product.description || '');
    setImage(product.image || '');
    setSelectedTagIds(product.filterTagIds || []);
    setIsVisible(product.isVisible);
    setCalories(product.calories ? product.calories.toString() : '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setFormError('حجم الصورة كبير جدًا (أقصى حد 2 ميغابايت).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const toggleTagInForm = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!venue) return;

    const cleanName = name.trim();
    if (!cleanName) {
      setFormError('اسم المنتج مطلوب.');
      return;
    }

    if (!categoryId) {
      setFormError('يرجى اختيار القسم المناسب للمنتج.');
      return;
    }

    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      setFormError('يرجى إدخال سعر صحيح وموجب.');
      return;
    }

    const numCalories = calories.trim() ? parseInt(calories.trim(), 10) : undefined;

    try {
      setIsSubmitting(true);
      setFormError(null);

      if (editingProduct) {
        await updateProduct(editingProduct.id, {
          name: cleanName,
          categoryId,
          price: numPrice,
          description: description.trim() || undefined,
          image: image.trim() || undefined,
          filterTagIds: selectedTagIds,
          isVisible,
          calories: numCalories,
        });
        setSuccessMsg(`تم تحديث بيانات "${cleanName}".`);
      } else {
        await createProduct({
          venueId: venue.id,
          categoryId,
          name: cleanName,
          price: numPrice,
          description: description.trim() || undefined,
          image: image.trim() || undefined,
          filterTagIds: selectedTagIds,
          isVisible,
          calories: numCalories,
          displayOrder: products.filter((p) => p.categoryId === categoryId).length + 1,
        });
        setSuccessMsg(`تمت إضافة صنف "${cleanName}" بنجاح.`);
      }

      setIsModalOpen(false);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء حفظ المنتج.';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProduct(deleteTarget.id);
      setSuccessMsg(`تم حذف صنف "${deleteTarget.name}".`);
      setDeleteTarget(null);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Failed to delete product:', err);
    }
  };

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // 1. Search text
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchDesc = p.description?.toLowerCase().includes(q);
        if (!matchName && !matchDesc) return false;
      }

      // 2. Category filter
      if (selectedCategoryFilter !== 'all' && p.categoryId !== selectedCategoryFilter) {
        return false;
      }

      // 3. Visibility filter
      if (visibilityFilter === 'visible' && !p.isVisible) return false;
      if (visibilityFilter === 'hidden' && p.isVisible) return false;

      return true;
    });
  }, [products, searchQuery, selectedCategoryFilter, visibilityFilter]);

  const currency = venue?.currency || 'SAR';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-neutral-900 tracking-tight">
            إدارة المنتجات والأصناف
          </h2>
          <p className="text-sm text-neutral-500 mt-1">
            إضافة وتعديل الأطباق والمشروبات، تحديد الأسعار، وإدارة حالة الظهور للزبائن.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          disabled={categories.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة صنف جديد</span>
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 p-4 rounded-xl text-sm font-semibold animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {categories.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-sm text-amber-900 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <span>يجب إنشاء قسم واحد على الأقل قبل إضافة أي منتج.</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-2xs flex flex-col md:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute start-3.5 top-3 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="البحث باسم الصنف أو الوصف..."
            className="w-full ps-10 pe-8 py-2 text-xs sm:text-sm bg-neutral-50 focus:bg-white border border-neutral-200 rounded-xl outline-none focus:border-amber-600"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute end-3 top-2.5 text-neutral-400 hover:text-neutral-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category filter */}
        <div className="w-full md:w-auto flex items-center gap-2">
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="w-full md:w-48 text-xs sm:text-sm px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:border-amber-600 cursor-pointer"
          >
            <option value="all">كافة الأقسام ({products.length})</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name} ({products.filter((p) => p.categoryId === cat.id).length})
              </option>
            ))}
          </select>

          {/* Visibility filter */}
          <select
            value={visibilityFilter}
            onChange={(e) => setVisibilityFilter(e.target.value as 'all' | 'visible' | 'hidden')}
            className="w-full md:w-36 text-xs sm:text-sm px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:border-amber-600 cursor-pointer"
          >
            <option value="all">كل الحالات</option>
            <option value="visible">ظاهر للزبائن</option>
            <option value="hidden">مخفي مؤقتًا</option>
          </select>
        </div>
      </div>

      {/* Products Content: Table on Desktop, Cards on Mobile */}
      {filteredProducts.length === 0 ? (
        <EmptyState
          title="لم يتم العثور على أي أصناف"
          description="لا توجد أطباق أو مشروبات تطابق معايير البحث والفلترة المحددة."
          action={
            categories.length > 0
              ? {
                  label: 'إضافة صنف جديد',
                  onClick: openAddModal,
                  icon: <Plus className="w-4 h-4" />,
                }
              : undefined
          }
        />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block bg-white rounded-2xl border border-neutral-200 shadow-2xs overflow-hidden">
            <table className="w-full text-right text-sm">
              <thead className="bg-neutral-50 text-neutral-500 text-xs font-bold border-b border-neutral-200">
                <tr>
                  <th className="p-4">الصنف</th>
                  <th className="p-4">القسم</th>
                  <th className="p-4">السعر</th>
                  <th className="p-4">الفلاتر المرفقة</th>
                  <th className="p-4 text-center">الظهور</th>
                  <th className="p-4 text-left">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredProducts.map((product) => {
                  const cat = categories.find((c) => c.id === product.categoryId);
                  const matchedTags = filterTags.filter((t) =>
                    product.filterTagIds?.includes(t.id)
                  );

                  return (
                    <tr key={product.id} className="hover:bg-neutral-50/60 transition-colors">
                      {/* Product Thumbnail & Name */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200 flex-shrink-0">
                            <ImageWithFallback
                              src={product.image}
                              alt={product.name}
                              className="w-full h-full object-cover"
                              showPlaceholderIcon={false}
                            />
                          </div>
                          <div>
                            <span className="font-bold text-neutral-900 block">
                              {product.name}
                            </span>
                            {product.description && (
                              <span className="text-xs text-neutral-500 line-clamp-1 max-w-xs">
                                {product.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="p-4 text-xs font-medium text-neutral-600">
                        {cat?.name || 'بدون قسم'}
                      </td>

                      {/* Price */}
                      <td className="p-4 font-bold text-neutral-900 whitespace-nowrap">
                        {formatCurrency(product.price, currency)}
                      </td>

                      {/* Filter Badges */}
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {matchedTags.length > 0 ? (
                            matchedTags.map((tag) => (
                              <FilterBadge key={tag.id} tag={tag} size="sm" />
                            ))
                          ) : (
                            <span className="text-xs text-neutral-400">-</span>
                          )}
                        </div>
                      </td>

                      {/* Visibility Toggle */}
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          onClick={() => toggleProductVisibility(product.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                            product.isVisible
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300'
                          }`}
                        >
                          {product.isVisible ? (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              <span>ظاهر</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              <span>مخفي</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-left">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(product)}
                            className="p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                            title="تعديل الصنف"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(product)}
                            className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="حذف الصنف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-3.5">
            {filteredProducts.map((product) => {
              const cat = categories.find((c) => c.id === product.categoryId);
              const matchedTags = filterTags.filter((t) =>
                product.filterTagIds?.includes(t.id)
              );

              return (
                <div
                  key={product.id}
                  className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-2xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start gap-3 mb-3">
                      {product.image && (
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200 flex-shrink-0">
                          <ImageWithFallback
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            showPlaceholderIcon={false}
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] font-semibold text-neutral-400 block mb-0.5">
                          {cat?.name}
                        </span>
                        <h4 className="text-sm font-bold text-neutral-900 truncate">
                          {product.name}
                        </h4>
                        <span className="text-sm font-extrabold text-amber-700 mt-1 block">
                          {formatCurrency(product.price, currency)}
                        </span>
                      </div>
                    </div>

                    {product.description && (
                      <p className="text-xs text-neutral-500 line-clamp-2 mb-3 leading-relaxed">
                        {product.description}
                      </p>
                    )}

                    {matchedTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {matchedTags.map((tag) => (
                          <FilterBadge key={tag.id} tag={tag} size="sm" />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => toggleProductVisibility(product.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                        product.isVisible
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-neutral-200 text-neutral-600'
                      }`}
                    >
                      {product.isVisible ? (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>ظاهر</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>مخفي</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(product)}
                        className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-lg"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(product)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProduct ? 'تعديل بيانات الصنف' : 'إضافة صنف جديد'}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                اسم الصنف *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: فلات وايت أريج"
                className="w-full text-sm px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:border-amber-600 focus:bg-white"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                القسم التابع له *
              </label>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:border-amber-600 focus:bg-white cursor-pointer"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                السعر ({venue?.currencySymbol || venue?.currency}) *
              </label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="مثال: 22"
                className="w-full text-sm px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:border-amber-600 focus:bg-white text-left font-mono"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                السعرات الحرارية (اختياري)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  placeholder="مثال: 140"
                  className="w-full text-sm px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:border-amber-600 focus:bg-white text-left font-mono"
                  dir="ltr"
                />
                <span className="absolute end-3 top-2.5 text-xs text-neutral-400 pointer-events-none">
                  سعرة
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1.5">
              الوصف والمكونات (اختياري)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="وصف تفصيلي للنكهات والمكونات..."
              className="w-full text-sm px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:border-amber-600 focus:bg-white leading-relaxed"
            />
          </div>

          {/* Image */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1.5">
              صورة المنتج (اختيارية)
            </label>
            <div className="flex items-center gap-3">
              {image && (
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200 relative flex-shrink-0">
                  <ImageWithFallback
                    src={image}
                    alt="معاينة صورة الصنف"
                    className="w-full h-full object-cover"
                    showPlaceholderIcon={false}
                  />
                  <button
                    type="button"
                    onClick={() => setImage('')}
                    className="absolute inset-0 bg-red-900/60 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                    title="حذف الصورة"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-xl cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>رفع صورة</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFile}
                      className="hidden"
                    />
                  </label>
                  <input
                    type="text"
                    placeholder="أو رابط صورة مباشر (URL)..."
                    value={image}
                    onChange={(e) => setImage(e.target.value)}
                    className="flex-1 text-xs px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:border-amber-600"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Filter Tags Checkbox Selection */}
          {filterTags.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                علامات التصنيف والفلاتر
              </label>
              <div className="flex flex-wrap gap-2 p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                {filterTags.map((tag) => {
                  const isChecked = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTagInForm(tag.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer border select-none ${
                        isChecked
                          ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                          : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      {tag.emoji && <span>{tag.emoji}</span>}
                      <span>{tag.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Visibility Checkbox */}
          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="product-visible-check"
              checked={isVisible}
              onChange={(e) => setIsVisible(e.target.checked)}
              className="w-4 h-4 text-amber-600 rounded border-neutral-300 focus:ring-amber-500 cursor-pointer"
            />
            <label
              htmlFor="product-visible-check"
              className="text-xs font-bold text-neutral-800 cursor-pointer select-none"
            >
              إظهار هذا الصنف مباشرة في المنيو أمام الزبائن
            </label>
          </div>

          {formError && (
            <p className="text-xs text-rose-600 font-semibold">{formError}</p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'جاري الحفظ...' : editingProduct ? 'حفظ التعديلات' : 'إضافة الصنف'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="تأكيد حذف الصنف"
        message={`هل أنت متأكد من حذف "${deleteTarget?.name}" من قائمة الطعام نهائيًا؟`}
        confirmLabel="حذف الصنف"
        isDestructive={true}
      />
    </div>
  );
};
