import React, { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { formatShortDate, GALLERY_CATEGORIES } from '../constants';
import { createTranslator } from '../i18n';
import { apiRequest } from '../lib/api';
import { AuthUser, GalleryPhoto, Language } from '../types';

interface GalleryTabProps {
  user: AuthUser;
  lang: Language;
  photos: GalleryPhoto[];
  onRefresh: () => Promise<void>;
}

export const GalleryTab: React.FC<GalleryTabProps> = ({ user, lang, photos, onRefresh }) => {
  const t = createTranslator(lang);
  const isStaff = user.role === 'super_owner' || user.role === 'admin';

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [lightbox, setLightbox] = useState<GalleryPhoto | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<GalleryPhoto | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const [title, setTitle] = useState('');
  const [titleOr, setTitleOr] = useState('');
  const [caption, setCaption] = useState('');
  const [category, setCategory] = useState<'tournament' | 'event' | 'notice' | 'campus'>('event');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (categoryFilter === 'all') return photos;
    return photos.filter((p) => p.category === categoryFilter);
  }, [photos, categoryFilter]);

  const openAdd = () => {
    setEditing(null);
    setTitle('');
    setTitleOr('');
    setCaption('');
    setCategory('event');
    setFile(null);
    setError(null);
    setShowModal(true);
  };

  const openEdit = (p: GalleryPhoto) => {
    setEditing(p);
    setTitle(p.title);
    setTitleOr(p.title_or || '');
    setCaption(p.caption || '');
    setCategory(p.category);
    setFile(null);
    setError(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('title', title.trim());
      if (titleOr.trim()) fd.append('title_or', titleOr.trim());
      if (caption.trim()) fd.append('caption', caption.trim());
      fd.append('category', category);
      if (file) fd.append('photo', file);

      if (editing) {
        await apiRequest(`/api/gallery/${editing.id}`, { method: 'PUT', body: fd, isFormData: true });
      } else {
        await apiRequest('/api/gallery', { method: 'POST', body: fd, isFormData: true });
      }
      await onRefresh();
      setShowModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    await apiRequest(`/api/gallery/${id}`, { method: 'DELETE' });
    setConfirmDeleteId(null);
    await onRefresh();
  };

  const getCategoryName = (catId: string) => {
    const found = GALLERY_CATEGORIES.find((c) => c.id === catId);
    if (!found) return catId;
    return lang === 'or' ? found.or : found.en;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
            {lang === 'or' ? 'ବିଦ୍ୟାଳୟ ଫଟୋ ଗ୍ୟାଲେରୀ ଓ ଉତ୍ସବ' : 'School Photo Gallery & Events'}
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            {lang === 'or'
              ? 'କ୍ରୀଡ଼ା ପ୍ରତିଯୋଗିତା, ବିଜ୍ଞାନ ପ୍ରଦର୍ଶନୀ, ଉତ୍ସବ ଓ ବିଜ୍ଞପ୍ତି ଫଳକର ଫଟୋ।'
              : 'Tournament moments, science exhibitions, annual celebrations, and notice board photos.'}
          </p>
        </div>

        {isStaff && (
          <button
            type="button"
            onClick={openAdd}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-900 text-white text-sm font-semibold hover:bg-blue-800 inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('uploadPhoto')}</span>
          </button>
        )}
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {GALLERY_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setCategoryFilter(cat.id)}
            className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              categoryFilter === cat.id
                ? 'bg-blue-900 text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            {lang === 'or' ? cat.or : cat.en}
          </button>
        ))}
      </div>

      {/* Photo Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center text-sm text-slate-600">
          {t('noGallery')}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((photo) => (
            <article
              key={photo.id}
              className="rounded-2xl bg-white border border-slate-200 overflow-hidden flex flex-col"
            >
              <button
                type="button"
                onClick={() => setLightbox(photo)}
                className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden group cursor-pointer text-left"
              >
                <img
                  src={photo.image_url}
                  alt={photo.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
              </button>

              <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-blue-900">{getCategoryName(photo.category)}</span>
                    <span className="font-mono-num">{formatShortDate(photo.created_at)}</span>
                  </div>
                  <h2 className="mt-1.5 font-display text-base font-bold text-slate-900 leading-snug">
                    {lang === 'or' && photo.title_or ? photo.title_or : photo.title}
                  </h2>
                  {photo.caption && (
                    <p className="mt-1 text-xs text-slate-600 line-clamp-2 leading-relaxed">{photo.caption}</p>
                  )}
                </div>

                {isStaff && (
                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500 truncate">{photo.uploaded_by_name}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(photo)}
                        className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                        aria-label={t('edit')}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {confirmDeleteId === photo.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDelete(photo.id)}
                            className="min-h-[34px] px-2 rounded-lg bg-red-600 text-white text-xs font-semibold cursor-pointer"
                          >
                            {t('delete')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[34px] px-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
                          >
                            {t('cancel')}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(photo.id)}
                          className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                          aria-label={t('delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Lightbox Viewer */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          <div
            className="w-full max-w-4xl bg-white rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-display text-base font-bold text-slate-900 truncate">
                  {lang === 'or' && lightbox.title_or ? lightbox.title_or : lightbox.title}
                </h3>
                <p className="text-xs text-slate-500">
                  {getCategoryName(lightbox.category)} · {formatShortDate(lightbox.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-slate-950 flex items-center justify-center max-h-[65vh]">
              <img
                src={lightbox.image_url}
                alt={lightbox.title}
                referrerPolicy="no-referrer"
                className="max-h-[65vh] w-auto object-contain"
              />
            </div>
            {lightbox.caption && (
              <p className="p-4 text-sm text-slate-700 bg-white">{lightbox.caption}</p>
            )}
          </div>
        </div>
      )}

      {/* Upload / Edit Photo Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 shadow-xl my-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {editing ? t('editPhoto') : t('uploadPhoto')}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-sm text-red-800">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as 'tournament' | 'event' | 'notice' | 'campus')}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-sm"
                >
                  <option value="tournament">Sports &amp; Tournament</option>
                  <option value="event">School Events</option>
                  <option value="notice">Notice Board Photo</option>
                  <option value="campus">Campus Life</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Photo Title (English)</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Photo Title (Odia — Optional)</label>
                <input
                  type="text"
                  value={titleOr}
                  onChange={(e) => setTitleOr(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Caption</label>
                <textarea
                  rows={2}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Photo Image (JPG, PNG, WEBP){editing ? ' — leave empty to keep existing' : ''}
                </label>
                <input
                  type="file"
                  required={!editing}
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="min-h-[44px] px-4 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[44px] px-5 rounded-xl bg-blue-900 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
                >
                  {saving ? t('loading') : t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
