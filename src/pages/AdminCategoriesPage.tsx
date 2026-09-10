import React, { useState } from 'react';
import { useMenu } from '../context/MenuContext';
import { Category } from '../types';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { EmptyState } from '../components/common/EmptyState';
import {
  Plus,
  FolderTree,
  ChevronUp,
  ChevronDown,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Layers,
} from 'lucide-react';

export const AdminCategoriesPage: React.FC = () => {
  const {
    categories,
    products,
    createCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    venue,
  } = useMenu();

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Deletion modal state
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteAlertMsg, setDeleteAlertMsg] = useState<string | null>(null);

  const openAddModal = () => {
    setEditingCategory(null);
    setName('');
    setDescription('');
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setDescription(cat.description || '');
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!venue) return;

    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMsg('اسم القسم مطلوب ولا يمكن أن يكون مسافات فارغة.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name: cleanName,
          description: description.trim() || undefined,
        });
        setSuccessMsg(`تم تحديث القسم "${cleanName}" بنجاح.`);
      } else {
        await createCategory({
          venueId: venue.id,
          name: cleanName,
          description: description.trim() || undefined,
          displayOrder: categories.length + 1,
        });
        setSuccessMsg(`تمت إضافة القسم "${cleanName}" بنجاح.`);
      }

      setIsModalOpen(false);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء حفظ القسم.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const promptDelete = (cat: Category) => {
    const attachedCount = products.filter((p) => p.categoryId === cat.id).length;
    if (attachedCount > 0) {
      setDeleteAlertMsg(
        `لا يمكن حذف قسم "${cat.name}" لأنه يحتوي على ${attachedCount} صنفًا حاليًا. يرجى نقل المنتجات إلى قسم آخر أو حذفها أولًا.`
      );
      return;
    }

    setDeleteTarget(cat);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      await deleteCategory(deleteTarget.id);
      setSuccessMsg(`تم حذف القسم "${deleteTarget.name}".`);
      setDeleteTarget(null);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل حذف القسم.';
      setErrorMsg(msg);
    }
  };

  // Reordering
  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const newOrder = [...categories];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(targetIndex, 0, moved);

    try {
      await reorderCategories(newOrder.map((c) => c.id));
      setSuccessMsg('تم تحديث ترتيب الأقسام.');
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err) {
      console.error('Failed to reorder categories:', err);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-neutral-900 tracking-tight">
            إدارة الأقسام
          </h2>
          <p className="text-sm text-neutral-500 mt-1">
            تنظيم قائمة الطعام، تحديد ترتيب الأقسام، وإضافة تصنيفات جديدة.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة قسم جديد</span>
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 p-4 rounded-xl text-sm font-semibold animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2 bg-rose-50 text-rose-800 border border-rose-200 p-4 rounded-xl text-sm font-semibold animate-in fade-in">
          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Categories List */}
      {categories.length === 0 ? (
        <EmptyState
          icon={<FolderTree className="w-8 h-8 text-neutral-400 stroke-1" />}
          title="لا توجد أي أقسام بعد"
          description="ابدأ بإضافة أول قسم لقائمة طعامك لتتمكن من إضافة المنتجات والأطباق داخله."
          action={{
            label: 'إضافة قسم الآن',
            onClick: openAddModal,
            icon: <Plus className="w-4 h-4" />,
          }}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xs overflow-hidden">
          <div className="p-4 bg-neutral-50/70 border-b border-neutral-200 flex items-center justify-between text-xs font-bold text-neutral-500">
            <span>القسم وترتيب الظهور</span>
            <span>عدد الأصناف والإجراءات</span>
          </div>

          <div className="divide-y divide-neutral-100">
            {categories.map((cat, idx) => {
              const productCount = products.filter((p) => p.categoryId === cat.id).length;
              const isFirst = idx === 0;
              const isLast = idx === categories.length - 1;

              return (
                <div
                  key={cat.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50/50 transition-colors"
                >
                  {/* Left: Reorder buttons & Name */}
                  <div className="flex items-center gap-3">
                    {/* Reorder Up / Down */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        disabled={isFirst}
                        onClick={() => handleMove(idx, 'up')}
                        className="p-1 text-neutral-400 hover:text-neutral-900 disabled:opacity-20 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                        title="تحريك لأعلى"
                        aria-label="تحريك لأعلى"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={isLast}
                        onClick={() => handleMove(idx, 'down')}
                        className="p-1 text-neutral-400 hover:text-neutral-900 disabled:opacity-20 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                        title="تحريك لأسفل"
                        aria-label="تحريك لأسفل"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="w-7 h-7 rounded-lg bg-neutral-100 text-neutral-700 font-mono text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-neutral-900">{cat.name}</h3>
                      {cat.description && (
                        <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">
                          {cat.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Products count & edit/delete */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-700">
                      {productCount} أصناف
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(cat)}
                        className="p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                        title="تعديل القسم"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => promptDelete(cat)}
                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="حذف القسم"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add / Edit Category Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCategory ? 'تعديل بيانات القسم' : 'إضافة قسم جديد'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1.5">
              اسم القسم *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: القهوة والمشروبات الساخنة"
              className="w-full text-sm px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:border-amber-600 focus:bg-white"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1.5">
              الوصف المختصر (اختياري)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="مثال: مخبوزات طازجة محضرة يوميًا بأجود أنواع الزبدة الفرنسية..."
              className="w-full text-sm px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:border-amber-600 focus:bg-white"
            />
          </div>

          {errorMsg && (
            <p className="text-xs text-rose-600 font-semibold">{errorMsg}</p>
          )}

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
              {isSubmitting ? 'جاري الحفظ...' : editingCategory ? 'حفظ التعديلات' : 'إضافة القسم'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Prevent Deletion Alert Modal */}
      {deleteAlertMsg && (
        <Modal
          isOpen={Boolean(deleteAlertMsg)}
          onClose={() => setDeleteAlertMsg(null)}
          title="تعذر حذف القسم"
          maxWidth="sm"
        >
          <div className="space-y-4 text-center sm:text-right">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto sm:mx-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <p className="text-sm text-neutral-700 leading-relaxed">{deleteAlertMsg}</p>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setDeleteAlertMsg(null)}
                className="px-4 py-2 bg-neutral-900 text-white text-xs font-bold rounded-xl"
              >
                حسنًا، فهمت
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal (when empty) */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="تأكيد حذف القسم"
        message={`هل أنت متأكد من حذف قسم "${deleteTarget?.name}" نهائيًا؟`}
        confirmLabel="حذف القسم"
        isDestructive={true}
      />
    </div>
  );
};
