import React, { useState } from 'react';
import { useMenu } from '../context/MenuContext';
import { FilterTag } from '../types';
import { FILTER_COLOR_PRESETS } from '../utils/colors';
import { FilterBadge } from '../components/common/FilterBadge';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { EmptyState } from '../components/common/EmptyState';
import {
  Plus,
  SlidersHorizontal,
  ChevronUp,
  ChevronDown,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Smile,
  Palette,
} from 'lucide-react';

const COMMON_EMOJIS = ['⭐', '🆕', '🌱', '🌶️', '🔥', '☕', '🥐', '🥇', '🥑', '🧀', '❄️', '🧁', '🥗'];

export const AdminFiltersPage: React.FC = () => {
  const {
    filterTags,
    products,
    createFilterTag,
    updateFilterTag,
    deleteFilterTag,
    reorderFilterTags,
    venue,
  } = useMenu();

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingTag, setEditingTag] = useState<FilterTag | null>(null);

  const [name, setName] = useState<string>('');
  const [emoji, setEmoji] = useState<string>('');
  const [colorPresetId, setColorPresetId] = useState<string>('amber');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Delete target
  const [deleteTarget, setDeleteTarget] = useState<FilterTag | null>(null);

  const openAddModal = () => {
    setEditingTag(null);
    setName('');
    setEmoji('⭐');
    setColorPresetId('amber');
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const openEditModal = (tag: FilterTag) => {
    setEditingTag(tag);
    setName(tag.name);
    setEmoji(tag.emoji || '');
    setColorPresetId(tag.color);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!venue) return;

    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMsg('اسم الفلتر مطلوب.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      if (editingTag) {
        await updateFilterTag(editingTag.id, {
          name: cleanName,
          emoji: emoji.trim() || undefined,
          color: colorPresetId,
        });
        setSuccessMsg(`تم تحديث الفلتر "${cleanName}".`);
      } else {
        await createFilterTag({
          venueId: venue.id,
          name: cleanName,
          emoji: emoji.trim() || undefined,
          color: colorPresetId,
          displayOrder: filterTags.length + 1,
        });
        setSuccessMsg(`تم إنشاء الفلتر "${cleanName}".`);
      }

      setIsModalOpen(false);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء حفظ الفلتر.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteFilterTag(deleteTarget.id);
      setSuccessMsg(
        `تم حذف فلتر "${deleteTarget.name}" وإزالته من جميع المنتجات المرتبطة به دون مساس بالمنتجات.`
      );
      setDeleteTarget(null);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Failed to delete tag:', err);
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= filterTags.length) return;

    const newOrder = [...filterTags];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(targetIndex, 0, moved);

    try {
      await reorderFilterTags(newOrder.map((t) => t.id));
      setSuccessMsg('تم تحديث ترتيب الفلاتر.');
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err) {
      console.error('Failed to reorder tags:', err);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-neutral-900 tracking-tight">
            الفلاتر وعلامات التصنيف الديناميكية
          </h2>
          <p className="text-sm text-neutral-500 mt-1">
            إدارة علامات التمييز مثل (الأكثر طلبًا، حار، نباتي، عروض) وربطها بالمنتجات لمساعدة العميل في التصفية.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إنشاء فلتر جديد</span>
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

      {/* Tags List */}
      {filterTags.length === 0 ? (
        <EmptyState
          icon={<SlidersHorizontal className="w-8 h-8 text-neutral-400 stroke-1" />}
          title="لا توجد فلاتر مضافة"
          description="أضف فلاتر مثل 'الأكثر طلبًا' أو 'نباتي' لتمييز أصناف قائمتك."
          action={{
            label: 'إنشاء أول فلتر',
            onClick: openAddModal,
            icon: <Plus className="w-4 h-4" />,
          }}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xs overflow-hidden">
          <div className="p-4 bg-neutral-50/70 border-b border-neutral-200 flex items-center justify-between text-xs font-bold text-neutral-500">
            <span>الفلتر والمعاينة</span>
            <span>المنتجات المرتبطة والإجراءات</span>
          </div>

          <div className="divide-y divide-neutral-100">
            {filterTags.map((tag, idx) => {
              const productCount = products.filter((p) =>
                p.filterTagIds?.includes(tag.id)
              ).length;
              const isFirst = idx === 0;
              const isLast = idx === filterTags.length - 1;

              return (
                <div
                  key={tag.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50/50 transition-colors"
                >
                  {/* Left: Reorder and Tag Badge */}
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        disabled={isFirst}
                        onClick={() => handleMove(idx, 'up')}
                        className="p-1 text-neutral-400 hover:text-neutral-900 disabled:opacity-20 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                        title="تحريك لأعلى"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={isLast}
                        onClick={() => handleMove(idx, 'down')}
                        className="p-1 text-neutral-400 hover:text-neutral-900 disabled:opacity-20 hover:bg-neutral-100 rounded transition-colors cursor-pointer"
                        title="تحريك لأسفل"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>

                    <FilterBadge tag={tag} size="lg" />
                  </div>

                  {/* Right: Product count and actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100">
                    <span className="text-xs font-medium text-neutral-600 bg-neutral-100 px-3 py-1 rounded-full">
                      مرتبط بـ {productCount} منتج
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(tag)}
                        className="p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                        title="تعديل الفلتر"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(tag)}
                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="حذف الفلتر"
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

      {/* Add / Edit Tag Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTag ? 'تعديل الفلتر' : 'إنشاء فلتر جديد'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1.5">
              اسم الفلتر *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: الأكثر طلبًا"
              className="w-full text-sm px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:border-amber-600 focus:bg-white"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1.5">
              رمز تعبيري (Emoji) اختياري
            </label>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder="⭐"
                className="w-20 text-center text-lg px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:border-amber-600 focus:bg-white"
              />
              <span className="text-xs text-neutral-500">اختر من الاقتراحات السريعة:</span>
            </div>
            <div className="flex flex-wrap gap-1.5 p-2 bg-neutral-50 rounded-xl border border-neutral-200">
              {COMMON_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setEmoji(em)}
                  className="w-8 h-8 rounded-lg hover:bg-white text-base flex items-center justify-center transition-colors cursor-pointer"
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1.5">
              لوحة الألوان المتباينة
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {FILTER_COLOR_PRESETS.map((preset) => {
                const isSelected = colorPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setColorPresetId(preset.id)}
                    className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'ring-2 ring-neutral-900 border-neutral-900 shadow-xs'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                    style={{ backgroundColor: preset.bg, color: preset.textColor }}
                  >
                    <span>{preset.name}</span>
                    {isSelected && <span className="text-xs">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Preview */}
          <div className="pt-2">
            <span className="block text-xs font-bold text-neutral-500 mb-1.5">
              معاينة مظهر الفلتر:
            </span>
            <FilterBadge
              tag={{
                id: 'preview',
                venueId: 'preview',
                name: name || 'اسم الفلتر',
                emoji: emoji || undefined,
                color: colorPresetId,
                displayOrder: 1,
                createdAt: '',
              }}
              size="lg"
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
              {isSubmitting ? 'جاري الحفظ...' : editingTag ? 'حفظ التعديلات' : 'إنشاء الفلتر'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="تأكيد حذف الفلتر"
        message={`هل أنت متأكد من حذف فلتر "${deleteTarget?.name}"؟ سيتم فك ارتباطه من كافة المنتجات مع الحفاظ على المنتجات دون حذف.`}
        confirmLabel="حذف الفلتر"
        isDestructive={true}
      />
    </div>
  );
};
